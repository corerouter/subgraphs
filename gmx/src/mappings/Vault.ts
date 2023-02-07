import {
  Address,
  BigDecimal,
  BigInt,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  Swap,
  IncreasePoolAmount,
  DecreasePoolAmount,
  IncreasePosition,
  DecreasePosition,
  CollectSwapFees,
  CollectMarginFees,
  UpdatePosition,
  ClosePosition,
  LiquidatePosition,
  UpdateFundingRate,
} from "../../generated/Vault/Vault";
import {
  createCollateralIn,
  createCollateralOut,
  createLiquidate,
  createSwap,
  EventType,
} from "../entities/event";
import { getOrCreateToken, updateTokenPrice } from "../entities/token";
import {
  getOrCreateAccount,
  incrementAccountEventCount,
} from "../entities/account";
import {
  getOrCreateUserPosition,
  getUserPosition,
  incrementPositionEventCount,
  updateUserPosition,
} from "../entities/position";
import {
  increaseProtocolStakeSideRevenue,
  incrementProtocolEventCount,
} from "../entities/protocol";
import {
  getOrCreateLiquidityPool,
  increasePoolTotalRevenue,
  increasePoolProtocolSideRevenue,
  increasePoolSupplySideRevenue,
  updatePoolOpenInterestUSD,
  increasePoolPremium,
  increasePoolVolume,
  updatePoolInputTokenBalance,
  updatePoolFundingRate,
} from "../entities/pool";
import { updateTempUsageMetrics } from "../entities/usage";
import { updateSnapshots } from "../entities/snapshot";
import {
  BIGDECIMAL_ZERO,
  BIGINT_NEGONE,
  BIGINT_ZERO,
  DEFAULT_DECIMALS,
  FUNDING_PRECISION,
  INT_NEGATIVE_ONE,
  INT_ONE,
  INT_ZERO,
  PositionSide,
  PRICE_PRECISION,
  PROTOCOL_SIDE_REVENUE_PERCENT,
} from "../utils/constants";
import {
  bigDecimalToBigInt,
  convertTokenToDecimal,
  exponentToBigDecimal,
} from "../utils/numbers";

// The transfers are either occur as a part of the Mint or Burn event process.
// The tokens being transferred in these events are the LP tokens from the liquidity pool that emitted this event.
// export function handleTransfer(event: Transfer): void {
//   const pool = getLiquidityPool(
//     event.address.toHexString(),
//     event.block.number
//   );

//   // ignore initial transfers for first adds
//   if (
//     event.params.to.toHexString() == ZERO_ADDRESS &&
//     event.params.value.equals(BIGINT_THOUSAND) &&
//     pool.outputTokenSupply == BIGINT_ZERO
//   ) {
//     return;
//   }
//   // mints
//   if (event.params.from.toHexString() == ZERO_ADDRESS) {
//     handleTransferMint(
//       event,
//       pool,
//       event.params.value,
//       event.params.to.toHexString()
//     );
//   }
//   // Case where direct send first on native token withdrawls.
//   // For burns, mint tokens are first transferred to the pool before transferred for burn.
//   // This gets the EOA that made the burn loaded into the _Transfer.

//   if (event.params.to == event.address) {
//     handleTransferToPoolBurn(event, event.params.from.toHexString());
//   }
//   // burn
//   if (
//     event.params.to.toHexString() == ZERO_ADDRESS &&
//     event.params.from == event.address
//   ) {
//     handleTransferBurn(
//       event,
//       pool,
//       event.params.value,
//       event.params.from.toHexString()
//     );
//   }
// }

// Handle Sync event.
// Emitted after every Swap, Mint, and Burn event.
// Gives information about the rebalancing of tokens used to update tvl, balances, and token pricing
// export function handleSync(event: Sync): void {
//   updateInputTokenBalances(
//     event.address.toHexString(),
//     event.params.reserve0,
//     event.params.reserve1,
//     event.block.number
//   );
//   updateProtocolAndPoolTvl(event.address.toHexString(), event.block.number);
// }

// Handle a mint event emitted from a pool contract. Considered a deposit into the given liquidity pool.
// export function handleMint(event: Mint): void {
//   createDeposit(event, event.params.amount0, event.params.amount1);
//   updateUsageMetrics(event, event.params.sender, UsageType.DEPOSIT);
//   updateFinancials(event);
//   updatePoolMetrics(event);
// }

// Handle a burn event emitted from a pool contract. Considered a withdraw into the given liquidity pool.
// export function handleBurn(event: Burn): void {
//   createWithdraw(event, event.params.amount0, event.params.amount1);
//   updateUsageMetrics(event, event.transaction.from, UsageType.WITHDRAW);
//   updateFinancials(event);
//   updatePoolMetrics(event);
// }

export function handleUpdateFundingRate(event: UpdateFundingRate): void {
  const token = getOrCreateToken(event, event.params.token);
  updatePoolFundingRate(
    event,
    token,
    event.params.fundingRate.divDecimal(FUNDING_PRECISION)
  );
}
// Handle a swap event emitted from a vault contract.
export function handleSwap(event: Swap): void {
  updateSnapshots(event);

  getOrCreateAccount(event, event.params.account);
  createSwap(
    event,
    event.params.account,
    event.params.tokenIn,
    event.params.amountIn,
    BIGDECIMAL_ZERO,
    event.params.tokenOut,
    event.params.amountOutAfterFees,
    BIGDECIMAL_ZERO
  );
  updateTempUsageMetrics(
    event,
    event.params.account,
    EventType.Swap,
    INT_ZERO,
    null
  );
}

export function handleIncreasePosition(event: IncreasePosition): void {
  handleUpdatePositionEvent(
    event,
    event.params.account,
    event.params.collateralToken,
    event.params.collateralDelta,
    event.params.indexToken,
    event.params.sizeDelta,
    event.params.price,
    event.params.fee,
    event.params.isLong,
    EventType.CollateralIn,
    BIGINT_ZERO
  );
}

export function handleDecreasePosition(event: DecreasePosition): void {
  handleUpdatePositionEvent(
    event,
    event.params.account,
    event.params.collateralToken,
    event.params.collateralDelta,
    event.params.indexToken,
    event.params.sizeDelta,
    event.params.price,
    event.params.fee,
    event.params.isLong,
    EventType.CollateralOut,
    BIGINT_ZERO
  );
}

export function handleLiquidatePosition(event: LiquidatePosition): void {
  handleUpdatePositionEvent(
    event,
    event.params.account,
    event.params.collateralToken,
    event.params.collateral,
    event.params.indexToken,
    event.params.size,
    event.params.markPrice,
    BIGINT_ZERO,
    event.params.isLong,
    EventType.Liquidated,
    event.params.realisedPnl
  );
}

export function handleUpdatePositionEvent(
  event: ethereum.Event,
  accountAddress: Address,
  collateralTokenAddress: Address,
  collateralTokenUSDDelta: BigInt,
  indexTokenAddress: Address,
  indexTokenUSDDelta: BigInt,
  indexTokenPrice: BigInt,
  fee: BigInt,
  isLong: boolean,
  eventType: EventType,
  liqudateProfitUSD: BigInt
): void {
  updateSnapshots(event);

  const account = getOrCreateAccount(event, accountAddress);

  let positionSide = PositionSide.SHORT;
  if (isLong) {
    positionSide = PositionSide.LONG;
  }

  const pool = getOrCreateLiquidityPool(event);
  let OpenPositionCount = INT_ZERO;
  if (eventType == EventType.CollateralIn) {
    if (
      !getUserPosition(
        account,
        pool,
        collateralTokenAddress,
        indexTokenAddress,
        positionSide
      )
    ) {
      OpenPositionCount = INT_ONE;
    }
  }
  const indexToken = getOrCreateToken(event, indexTokenAddress);
  updateTokenPrice(
    event,
    indexToken,
    indexTokenPrice.div(PRICE_PRECISION).toBigDecimal()
  );
  const collateralToken = getOrCreateToken(event, collateralTokenAddress);
  let collateralTokenAmountDelta = BIGINT_ZERO;
  if (
    collateralToken.lastPriceUSD &&
    collateralToken.lastPriceUSD != BIGDECIMAL_ZERO
  ) {
    collateralTokenAmountDelta = bigDecimalToBigInt(
      collateralTokenUSDDelta
        .toBigDecimal()
        .times(exponentToBigDecimal(collateralToken.decimals))
        .div(collateralToken.lastPriceUSD!)
    );
  }

  const position = updateUserPosition(
    event,
    account,
    pool,
    collateralTokenAddress,
    collateralTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
    indexTokenAddress,
    indexTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
    positionSide,
    eventType
  );

  if (eventType == EventType.CollateralIn) {
    createCollateralIn(
      event,
      accountAddress,
      collateralTokenAddress,
      collateralTokenAmountDelta,
      collateralTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
      BIGINT_ZERO,
      position
    );
  } else if (eventType == EventType.CollateralOut) {
    createCollateralOut(
      event,
      accountAddress,
      collateralTokenAddress,
      collateralTokenAmountDelta,
      collateralTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
      BIGINT_ZERO,
      position
    );
  } else if (eventType == EventType.Liquidated) {
    createLiquidate(
      event,
      indexTokenAddress,
      collateralTokenAmountDelta,
      collateralTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
      liqudateProfitUSD.div(PRICE_PRECISION).toBigDecimal(),
      event.transaction.from,
      accountAddress,
      position
    );
  }

  incrementAccountEventCount(event, account, eventType);
  incrementProtocolEventCount(event, eventType);
  incrementPositionEventCount(position, eventType);

  if (eventType == EventType.CollateralIn) {
    updatePoolOpenInterestUSD(
      event,
      pool,
      indexTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal()
    );
  } else if (
    eventType == EventType.CollateralOut ||
    eventType == EventType.Liquidated
  ) {
    updatePoolOpenInterestUSD(
      event,
      pool,
      BIGINT_NEGONE.times(indexTokenUSDDelta)
        .div(PRICE_PRECISION)
        .toBigDecimal()
    );
    if (eventType == EventType.CollateralOut) {
      if (position && position._timestampClosed > BIGINT_ZERO) {
        OpenPositionCount = INT_NEGATIVE_ONE;
      }
    }
  }

  increasePoolVolume(
    event,
    pool,
    indexTokenUSDDelta.div(PRICE_PRECISION).toBigDecimal(),
    eventType
  );

  increasePoolPremium(
    event,
    pool,
    fee.div(PRICE_PRECISION).toBigDecimal(),
    eventType
  );

  if (eventType == EventType.Liquidated) {
    updateTempUsageMetrics(
      event,
      event.transaction.from,
      EventType.Liquidate,
      INT_NEGATIVE_ONE,
      positionSide
    );
    updateTempUsageMetrics(
      event,
      accountAddress,
      EventType.Liquidated,
      INT_NEGATIVE_ONE,
      positionSide
    );
  } else {
    updateTempUsageMetrics(
      event,
      accountAddress,
      eventType,
      OpenPositionCount,
      positionSide
    );
  }
}

export function handleClosePosition(event: ClosePosition): void {
  if (event.params.realisedPnl < BIGINT_ZERO) {
    updateSnapshots(event);
    const pool = getOrCreateLiquidityPool(event);
    increasePoolVolume(
      event,
      pool,
      BIGINT_NEGONE.times(event.params.realisedPnl)
        .div(PRICE_PRECISION)
        .toBigDecimal(),
      EventType.ClosePosition
    );
  }
  // updatePoolOpenInterestUSD(
  //   event,
  //   BIGINT_NEGONE.times(event.params.size).div(PRICE_PRECISION).toBigDecimal()
  // );
}

export function handleCollectSwapFees(event: CollectSwapFees): void {
  handleCollectFees(event, event.params.feeUsd);
}

export function handleCollectMarginFees(event: CollectMarginFees): void {
  handleCollectFees(event, event.params.feeUsd);
}

export function handleIncreasePoolAmount(event: IncreasePoolAmount): void {
  handleChangePoolAmount(event.params.token, event.params.amount, event, true);
}

export function handleDecreasePoolAmount(event: DecreasePoolAmount): void {
  handleChangePoolAmount(event.params.token, event.params.amount, event, false);
}

function handleChangePoolAmount(
  token: Address,
  amount: BigInt,
  event: ethereum.Event,
  isIncreasePoolAmount: boolean
): void {
  updateSnapshots(event);

  const inputToken = getOrCreateToken(event, token);
  if (isIncreasePoolAmount) {
    updatePoolInputTokenBalance(event, inputToken, amount);
  } else {
    updatePoolInputTokenBalance(event, inputToken, amount.times(BIGINT_NEGONE));
  }
}

function handleCollectFees(event: ethereum.Event, feeUsd: BigInt): void {
  updateSnapshots(event);

  const totalFee = feeUsd.div(PRICE_PRECISION).toBigDecimal();

  increasePoolTotalRevenue(event, totalFee);
  increasePoolProtocolSideRevenue(
    event,
    totalFee.times(PROTOCOL_SIDE_REVENUE_PERCENT)
  );
  increasePoolSupplySideRevenue(
    event,
    totalFee.minus(totalFee.times(PROTOCOL_SIDE_REVENUE_PERCENT))
  );
  increaseProtocolStakeSideRevenue(
    event,
    totalFee.minus(totalFee.times(PROTOCOL_SIDE_REVENUE_PERCENT))
  );
}
