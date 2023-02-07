import {
  ethereum,
  BigInt,
  Bytes,
  Address,
  log,
  store,
  BigDecimal,
} from "@graphprotocol/graph-ts";
import {
  Account,
  LiquidityPool,
  Position,
  PositionSnapshot,
} from "../../generated/schema";
import {
  decrementAccountOpenPositionCount,
  incrementAccountOpenPositionCount,
} from "./account";
import {
  decrementPoolOpenPositionCount,
  incrementPoolOpenPositionCount,
} from "./pool";
import { EventType } from "./event";
import { getOrCreateToken } from "./token";
import {
  BIGDECIMAL_ZERO,
  BIGINT_ZERO,
  INT_ONE,
  INT_ZERO,
} from "../utils/constants";
import { bigDecimalToBigInt, exponentToBigDecimal } from "../utils/numbers";

export function getUserPosition(
  account: Account,
  pool: LiquidityPool,
  collateralTokenAddress: Address,
  indexTokenAddress: Address,
  positionSide: string
): Position | null {
  const positionId = account.id
    .concat(pool.id)
    .concat(Bytes.fromUTF8(positionSide))
    .concat(collateralTokenAddress)
    .concat(indexTokenAddress);
  return Position.load(positionId);
}

export function createUserPosition(
  event: ethereum.Event,
  account: Account,
  pool: LiquidityPool,
  collateralTokenAddress: Address,
  indexTokenAddress: Address,
  positionSide: string
): Position {
  const positionId = account.id
    .concat(pool.id)
    .concat(Bytes.fromUTF8(positionSide))
    .concat(collateralTokenAddress)
    .concat(indexTokenAddress);
  const position = new Position(positionId);
  position.account = account.id;
  position.liquidityPool = pool.id;
  position.collateral = collateralTokenAddress;
  position.asset = indexTokenAddress;
  position.side = positionSide;
  position.fundingrateOpen = BIGDECIMAL_ZERO;
  position.fundingrateClosed = BIGDECIMAL_ZERO;
  position.leverage = BIGDECIMAL_ZERO;
  position.balance = BIGINT_ZERO;
  position.collateralBalance = BIGINT_ZERO;
  position.balanceUSD = BIGDECIMAL_ZERO;
  position.collateralBalanceUSD = BIGDECIMAL_ZERO;
  position.collateralInCount = INT_ZERO;
  position.collateralOutCount = INT_ZERO;
  position._timestampClosed = BIGINT_ZERO;
  position.save();

  incrementAccountOpenPositionCount(account, positionSide);
  incrementPoolOpenPositionCount(event, pool, positionSide);

  return position;
}

export function getOrCreateUserPosition(
  event: ethereum.Event,
  account: Account,
  pool: LiquidityPool,
  collateralTokenAddress: Address,
  indexTokenAddress: Address,
  positionSide: string
): Position {
  const positionId = account.id
    .concat(pool.id)
    .concat(Bytes.fromUTF8(positionSide))
    .concat(collateralTokenAddress)
    .concat(indexTokenAddress);
  let position = Position.load(positionId);
  if (position) {
    return position;
  }

  return createUserPosition(
    event,
    account,
    pool,
    collateralTokenAddress,
    indexTokenAddress,
    positionSide
  );
}

export function updateUserPosition(
  event: ethereum.Event,
  account: Account,
  pool: LiquidityPool,
  collateralTokenAddress: Address,
  collateralTokenAmountUSD: BigDecimal,
  indexTokenAddress: Address,
  indexTokenAmountUSD: BigDecimal,
  positionSide: string,
  eventType: EventType
): Position {
  let position = getUserPosition(
    account,
    pool,
    collateralTokenAddress,
    indexTokenAddress,
    positionSide
  );

  switch (eventType) {
    case EventType.CollateralIn:
      if (!position) {
        position = createUserPosition(
          event,
          account,
          pool,
          collateralTokenAddress,
          indexTokenAddress,
          positionSide
        );

        const fundingTokenIndex = pool.inputTokens.indexOf(
          collateralTokenAddress
        );
        if (fundingTokenIndex >= 0) {
          position.fundingrateOpen = pool._fundingrate[fundingTokenIndex];
        }
      }

      position.balanceUSD = position.balanceUSD.plus(indexTokenAmountUSD);
      position.collateralBalanceUSD = position.collateralBalanceUSD.plus(
        collateralTokenAmountUSD
      );
      position.collateralInCount += INT_ONE;
      if (position._timestampClosed > BIGINT_ZERO) {
        position._timestampClosed = BIGINT_ZERO;
      }
      break;
    case EventType.CollateralOut:
    case EventType.Liquidated:
      if (position) {
        position.balanceUSD = position.balanceUSD.minus(indexTokenAmountUSD);
        position.collateralBalanceUSD = position.collateralBalanceUSD.minus(
          collateralTokenAmountUSD
        );
        position.collateralOutCount += INT_ONE;

        if (position.balanceUSD.le(BIGDECIMAL_ZERO)) {
          closePosition(event, account, pool, position);
        }
      }

      break;

    default:
      break;
  }

  if (position) {
    const indexToken = getOrCreateToken(event, indexTokenAddress);
    if (indexToken.lastPriceUSD && indexToken.lastPriceUSD != BIGDECIMAL_ZERO) {
      position.balance = bigDecimalToBigInt(
        position.balanceUSD
          .times(exponentToBigDecimal(indexToken.decimals))
          .div(indexToken.lastPriceUSD!)
      );
    }

    const collateralToken = getOrCreateToken(event, collateralTokenAddress);
    if (
      collateralToken.lastPriceUSD &&
      collateralToken.lastPriceUSD != BIGDECIMAL_ZERO
    ) {
      position.collateralBalance = bigDecimalToBigInt(
        position.collateralBalanceUSD
          .times(exponentToBigDecimal(collateralToken.decimals))
          .div(collateralToken.lastPriceUSD!)
      );
    }

    if (position.collateralBalanceUSD != BIGDECIMAL_ZERO) {
      position.leverage = position.balanceUSD.div(
        position.collateralBalanceUSD
      );
    }

    position.save();

    createPositionSnapshot(event, position);
  } else {
    position = createUserPosition(
      event,
      account,
      pool,
      collateralTokenAddress,
      indexTokenAddress,
      positionSide
    );
  }

  return position;
}

export function createPositionSnapshot(
  event: ethereum.Event,
  position: Position
): void {
  const id = position.id
    .concat(event.transaction.hash)
    .concatI32(event.transactionLogIndex.toI32());
  const snapshot = new PositionSnapshot(id);

  snapshot.account = position.account;
  snapshot.position = position.id;
  snapshot.fundingrate = position.fundingrateOpen;
  snapshot.balance = position.balance;
  snapshot.collateralBalance = position.collateralBalance;
  snapshot.balanceUSD = position.balanceUSD;
  snapshot.collateralBalanceUSD = position.collateralBalanceUSD;
  snapshot.blockNumber = event.block.number;
  snapshot.timestamp = event.block.timestamp;

  snapshot.save();
}

export function incrementPositionEventCount(
  position: Position,
  eventType: EventType
): void {
  switch (eventType) {
    case EventType.CollateralIn:
      position.collateralInCount += INT_ONE;
      break;
    case EventType.CollateralOut:
      position.collateralOutCount += INT_ONE;
      break;
    default:
      break;
  }

  position.save();
}

export function closePosition(
  event: ethereum.Event,
  account: Account,
  pool: LiquidityPool,
  position: Position
): boolean {
  if (position.balanceUSD.lt(BIGDECIMAL_ZERO)) {
    log.error(
      "Negative balanceUSD in position {}, balanceUSD: {}, setting to zero",
      [position.id.toHexString(), position.balanceUSD.toString()]
    );
  }
  const fundingTokenIndex = pool.inputTokens.indexOf(position.collateral);
  if (fundingTokenIndex >= 0) {
    position.fundingrateClosed = pool._fundingrate[fundingTokenIndex];
  }
  position.balance = BIGINT_ZERO;
  position.balanceUSD = BIGDECIMAL_ZERO;
  position.collateralBalance = BIGINT_ZERO;
  position.collateralBalanceUSD = BIGDECIMAL_ZERO;
  position.collateralInCount = INT_ZERO;
  position.collateralOutCount = INT_ZERO;
  position._timestampClosed = event.block.timestamp;
  position.save();

  decrementAccountOpenPositionCount(account, position.side);
  decrementPoolOpenPositionCount(event, pool, position.side);

  return true;
}
