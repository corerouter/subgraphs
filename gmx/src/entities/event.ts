import {
  BigInt,
  Address,
  ethereum,
  log,
  BigDecimal,
  Bytes,
} from "@graphprotocol/graph-ts";
import {
  Deposit,
  Withdraw,
  Swap,
  Token,
  Position,
  CollateralIn,
  CollateralOut,
  Liquidate,
} from "../../generated/schema";
import { getOrCreateLiquidityPool } from "./pool";
import { getOrCreateToken } from "./token";
import { getOrCreateProtocol } from "./protocol";
import { getOrCreateAccount } from "./account";
import {
  BIGINT_ZERO,
  LiquidityPoolFeeType,
  DEFAULT_DECIMALS,
} from "../utils/constants";
import { convertTokenToDecimal } from "../utils/numbers";

/**
 * Create the fee for a pool depending on the the protocol and network specific fee structure.
 * Specified in the typescript configuration file.
 */
// export function createPoolFees(
//   poolAddress: string,
//   blockNumber: BigInt
// ): string[] {
//   // get or create fee entities, set fee types
//   let poolLpFee = LiquidityPoolFee.load(poolAddress.concat("-lp-fee"));
//   if (!poolLpFee) {
//     poolLpFee = new LiquidityPoolFee(poolAddress.concat("-lp-fee"));
//     poolLpFee.feeType = LiquidityPoolFeeType.FIXED_LP_FEE;
//   }

//   let poolProtocolFee = LiquidityPoolFee.load(
//     poolAddress.concat("-protocol-fee")
//   );
//   if (!poolProtocolFee) {
//     poolProtocolFee = new LiquidityPoolFee(poolAddress.concat("-protocol-fee"));
//     poolProtocolFee.feeType = LiquidityPoolFeeType.FIXED_PROTOCOL_FEE;
//   }

//   let poolTradingFee = LiquidityPoolFee.load(
//     poolAddress.concat("-trading-fee")
//   );
//   if (!poolTradingFee) {
//     poolTradingFee = new LiquidityPoolFee(poolAddress.concat("-trading-fee"));
//     poolTradingFee.feeType = LiquidityPoolFeeType.FIXED_TRADING_FEE;
//   }

//   // set fees

//   poolLpFee.feePercentage = NetworkConfigs.getLPFeeToOff();
//   poolProtocolFee.feePercentage = NetworkConfigs.getProtocolFeeToOff();

//   poolTradingFee.feePercentage = NetworkConfigs.getTradeFee(blockNumber);

//   poolLpFee.save();
//   poolProtocolFee.save();
//   poolTradingFee.save();

//   return [poolLpFee.id, poolProtocolFee.id, poolTradingFee.id];
// }

export enum EventType {
  Deposit,
  Withdraw,
  CollateralIn,
  CollateralOut,
  ClosePosition,
  Swap,
  Liquidate,
  Liquidated,
}

// Create a Deposit entity and update deposit count on a liquid providing event for the specific pool..
export function createDeposit(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  inputTokenAmountUSD: BigDecimal,
  outputTokenAmount: BigInt
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();

  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const deposit = new Deposit(transactionHash.concatI32(logIndexI32));

  deposit.hash = transactionHash.toHexString();
  deposit.logIndex = logIndexI32;
  deposit.protocol = protocol.id;
  deposit.to = pool.id.toHexString();
  deposit.from = accountAddress.toHexString();
  deposit.account = accountAddress;
  deposit.blockNumber = event.block.number;
  deposit.timestamp = event.block.timestamp;
  deposit.inputTokens = pool.inputTokens;

  const inputTokenAmounts = new Array<BigInt>(deposit.inputTokens.length).fill(
    BIGINT_ZERO
  );
  const inputToken = getOrCreateToken(event, inputTokenAddress);
  const inputTokenIndex = deposit.inputTokens.indexOf(inputToken.id);
  if (inputTokenIndex >= 0) {
    inputTokenAmounts[inputTokenIndex] = inputTokenAmount;
  }
  deposit.inputTokenAmounts = inputTokenAmounts;

  deposit.outputToken = pool.outputToken;
  deposit.outputTokenAmount = outputTokenAmount;
  deposit.amountUSD = inputTokenAmountUSD;
  deposit.pool = pool.id;

  deposit.save();
}

export function createWithdraw(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  inputTokenAmountUSD: BigDecimal,
  outputTokenAmount: BigInt
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();
  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const withdrawal = new Withdraw(transactionHash.concatI32(logIndexI32));

  withdrawal.hash = transactionHash.toHexString();
  withdrawal.logIndex = logIndexI32;
  withdrawal.protocol = protocol.id;
  withdrawal.to = accountAddress.toHexString();
  withdrawal.from = pool.id.toHexString();
  withdrawal.account = accountAddress;
  withdrawal.blockNumber = event.block.number;
  withdrawal.timestamp = event.block.timestamp;
  withdrawal.inputTokens = pool.inputTokens;

  const inputTokenAmounts = new Array<BigInt>(
    withdrawal.inputTokens.length
  ).fill(BIGINT_ZERO);
  const inputToken = getOrCreateToken(event, inputTokenAddress);
  const inputTokenIndex = withdrawal.inputTokens.indexOf(inputToken.id);
  if (inputTokenIndex >= 0) {
    inputTokenAmounts[inputTokenIndex] = inputTokenAmount;
  }
  withdrawal.inputTokenAmounts = inputTokenAmounts;

  withdrawal.outputToken = pool.outputToken;
  withdrawal.outputTokenAmount = outputTokenAmount;
  withdrawal.amountUSD = inputTokenAmountUSD;
  withdrawal.pool = pool.id;

  withdrawal.save();
}

export function createCollateralIn(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  inputTokenAmountUSD: BigDecimal,
  outputTokenAmount: BigInt,
  position: Position
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();

  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const collateralIn = new CollateralIn(transactionHash.concatI32(logIndexI32));

  collateralIn.hash = transactionHash.toHexString();
  collateralIn.logIndex = logIndexI32;
  collateralIn.protocol = protocol.id;
  collateralIn.to = pool.id.toHexString();
  collateralIn.from = accountAddress.toHexString();
  collateralIn.account = accountAddress;
  collateralIn.blockNumber = event.block.number;
  collateralIn.timestamp = event.block.timestamp;
  collateralIn.inputTokens = pool.inputTokens;

  const inputTokenAmounts = new Array<BigInt>(
    collateralIn.inputTokens.length
  ).fill(BIGINT_ZERO);
  const inputToken = getOrCreateToken(event, inputTokenAddress);
  const inputTokenIndex = collateralIn.inputTokens.indexOf(inputToken.id);
  if (inputTokenIndex >= 0) {
    inputTokenAmounts[inputTokenIndex] = inputTokenAmount;
  }
  collateralIn.inputTokenAmounts = inputTokenAmounts;

  collateralIn.outputToken = pool.outputToken;
  collateralIn.outputTokenAmount = outputTokenAmount;
  collateralIn.amountUSD = inputTokenAmountUSD;
  collateralIn.pool = pool.id;

  collateralIn.position = position.id;

  collateralIn.save();
}

export function createCollateralOut(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  inputTokenAmountUSD: BigDecimal,
  outputTokenAmount: BigInt,
  position: Position
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();
  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const collateralOut = new CollateralOut(
    transactionHash.concatI32(logIndexI32)
  );

  collateralOut.hash = transactionHash.toHexString();
  collateralOut.logIndex = logIndexI32;
  collateralOut.protocol = protocol.id;
  collateralOut.to = accountAddress.toHexString();
  collateralOut.from = pool.id.toHexString();
  collateralOut.account = accountAddress;
  collateralOut.blockNumber = event.block.number;
  collateralOut.timestamp = event.block.timestamp;
  collateralOut.inputTokens = pool.inputTokens;

  const inputTokenAmounts = new Array<BigInt>(
    collateralOut.inputTokens.length
  ).fill(BIGINT_ZERO);
  const inputToken = getOrCreateToken(event, inputTokenAddress);
  const inputTokenIndex = collateralOut.inputTokens.indexOf(inputToken.id);
  if (inputTokenIndex >= 0) {
    inputTokenAmounts[inputTokenIndex] = inputTokenAmount;
  }
  collateralOut.inputTokenAmounts = inputTokenAmounts;

  collateralOut.outputToken = pool.outputToken;
  collateralOut.outputTokenAmount = outputTokenAmount;
  collateralOut.amountUSD = inputTokenAmountUSD;
  collateralOut.pool = pool.id;

  collateralOut.position = position.id;

  collateralOut.save();
}

export function createLiquidate(
  event: ethereum.Event,
  asset: Address,
  amountLiquidated: BigInt,
  amountLiquidatedUSD: BigDecimal,
  profitUSD: BigDecimal,
  liquidator: Address,
  liquidatee: Address,
  position: Position
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();
  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const liquidate = new Liquidate(transactionHash.concatI32(logIndexI32));

  liquidate.hash = transactionHash.toHexString();
  liquidate.logIndex = logIndexI32;
  liquidate.protocol = protocol.id;
  liquidate.position = position.id;
  liquidate.to = liquidator.toHexString();
  liquidate.from = liquidatee.toHexString();
  liquidate.blockNumber = event.block.number;
  liquidate.timestamp = event.block.timestamp;
  liquidate.liquidator = liquidator;
  liquidate.liquidatee = liquidatee;
  liquidate.asset = asset;
  liquidate.amount = amountLiquidated;
  liquidate.amountUSD = amountLiquidatedUSD;
  liquidate.profitUSD = profitUSD;
  liquidate.pool = pool.id;

  liquidate.save();
}

export function createSwap(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  inputTokenAmountUSD: BigDecimal,
  outputTokenAddress: Address,
  outputTokenAmount: BigInt,
  outputTokenAmountUSD: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  const protocol = getOrCreateProtocol();
  const transactionHash = event.transaction.hash;
  const logIndexI32 = event.logIndex.toI32();
  const swap = new Swap(transactionHash.concatI32(logIndexI32));

  swap.hash = transactionHash.toHexString();
  swap.logIndex = logIndexI32;
  swap.protocol = protocol.id;
  swap.to = pool.id.toHexString();
  swap.from = accountAddress.toHexString();
  swap.account = getOrCreateAccount(event, accountAddress).id;
  swap.blockNumber = event.block.number;
  swap.timestamp = event.block.timestamp;
  swap.tokenIn = getOrCreateToken(event, inputTokenAddress).id;
  swap.amountIn = inputTokenAmount;
  swap.amountInUSD = inputTokenAmountUSD;
  swap.tokenOut = getOrCreateToken(event, outputTokenAddress).id;
  swap.amountOut = outputTokenAmount;
  swap.amountOutUSD = outputTokenAmountUSD;
  swap.tradingPair = pool.id;
  swap.pool = pool.id;

  swap.save();
}
