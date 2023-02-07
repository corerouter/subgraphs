import { Address, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { getOrCreateProtocol } from "./protocol";
import {
  ActiveAccount,
  DerivPerpProtocol,
  LiquidityPool,
  LiquidityPoolDailySnapshot,
  UsageMetricsDailySnapshot,
  UsageMetricsHourlySnapshot,
  _TempUsageMetricsDailySnapshot,
  _TempUsageMetricsHourlySnapshot,
} from "../../generated/schema";
import {
  SECONDS_PER_DAY,
  INT_ZERO,
  SECONDS_PER_HOUR,
  INT_ONE,
  PositionSide,
} from "../utils/constants";
import { EventType } from "./event";

// export function getOrCreateUsageMetricsDailySnapshot(
//   event: ethereum.Event
// ): UsageMetricsDailySnapshot {
//   const protocol = getOrCreateProtocol();
//   // Number of days since Unix epoch
//   const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
//   // Create unique id for the day
//   let usageMetrics = UsageMetricsDailySnapshot.load(Bytes.fromI32(day));

//   if (!usageMetrics) {
//     usageMetrics = new UsageMetricsDailySnapshot(Bytes.fromI32(day));
//     usageMetrics.days = day;
//     usageMetrics.protocol = protocol.id;

//     usageMetrics.dailylongPositionCount = INT_ZERO;
//     usageMetrics.dailyshortPositionCount = INT_ZERO;
//     usageMetrics.dailyopenPositionCount = INT_ZERO;
//     usageMetrics.dailyclosedPositionCount = INT_ZERO;
//     usageMetrics.dailycumulativePositionCount = INT_ZERO;

//     usageMetrics.dailyTransactionCount = INT_ZERO;
//     usageMetrics.dailyDepositCount = INT_ZERO;
//     usageMetrics.dailyWithdrawCount = INT_ZERO;
//     usageMetrics.dailyBorrowCount = INT_ZERO;
//     usageMetrics.dailySwapCount = INT_ZERO;

//     usageMetrics.dailyActiveDepositors = INT_ZERO;
//     usageMetrics.dailyActiveBorrowers = INT_ZERO;
//     usageMetrics.dailyActiveLiquidators = INT_ZERO;
//     usageMetrics.dailyActiveLiquidatees = INT_ZERO;
//     usageMetrics.dailyActiveUsers = INT_ZERO;

//     usageMetrics.dailyCollateralIn = INT_ZERO;
//     usageMetrics.dailyCollateralOut = INT_ZERO;
//   }

//   usageMetrics.longPositionCount = protocol.longPositionCount;
//   usageMetrics.shortPositionCount = protocol.shortPositionCount;
//   usageMetrics.openPositionCount = protocol.openPositionCount;
//   usageMetrics.closedPositionCount = protocol.closedPositionCount;
//   usageMetrics.cumulativePositionCount = protocol.cumulativePositionCount;

//   usageMetrics.cumulativeUniqueDepositors =
//     protocol._cumulativeUniqueDepositors;
//   usageMetrics.cumulativeUniqueBorrowers = protocol.cumulativeUniqueBorrowers;
//   usageMetrics.cumulativeUniqueLiquidators =
//     protocol.cumulativeUniqueLiquidators;
//   usageMetrics.cumulativeUniqueLiquidatees =
//     protocol.cumulativeUniqueLiquidatees;
//   usageMetrics.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;

//   usageMetrics.cumulativeCollateralIn = protocol.collateralInCount;
//   usageMetrics.cumulativeCollateralOut = protocol.collateralOutCount;

//   usageMetrics.totalPoolCount = protocol.totalPoolCount;

//   usageMetrics.save();

//   return usageMetrics;
// }

// export function getOrCreateUsageMetricsHourlySnapshot(
//   event: ethereum.Event
// ): UsageMetricsHourlySnapshot {
//   const protocol = getOrCreateProtocol();
//   // Number of hours since Unix epoch
//   const hour = event.block.timestamp.toI32() / SECONDS_PER_HOUR;
//   const id = Bytes.fromI32(hour);
//   // Create unique id for the day
//   let usageMetrics = UsageMetricsHourlySnapshot.load(id);

//   if (!usageMetrics) {
//     usageMetrics = new UsageMetricsHourlySnapshot(id);
//     usageMetrics.hours = hour;
//     usageMetrics.protocol = protocol.id;

//     usageMetrics.hourlyActiveUsers = INT_ZERO;
//     usageMetrics.hourlyTransactionCount = INT_ZERO;
//     usageMetrics.hourlyDepositCount = INT_ZERO;
//     usageMetrics.hourlyWithdrawCount = INT_ZERO;
//     usageMetrics.hourlySwapCount = INT_ZERO;
//   }
//   usageMetrics.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;

//   usageMetrics.save();

//   return usageMetrics;
// }

export function updateUsageMetricsDailySnapshot(
  protocol: DerivPerpProtocol,
  day: i32
): void {
  // Create unique id for the day
  const id = Bytes.fromI32(day);
  if (UsageMetricsDailySnapshot.load(id)) {
    return;
  }

  const usageMetrics = new UsageMetricsDailySnapshot(Bytes.fromI32(day));
  usageMetrics.days = day;
  usageMetrics.protocol = protocol.id;

  const tempUsageMetrics = _TempUsageMetricsDailySnapshot.load(id);
  if (tempUsageMetrics) {
    usageMetrics.dailylongPositionCount =
      tempUsageMetrics.dailylongPositionCount;
    usageMetrics.dailyshortPositionCount =
      tempUsageMetrics.dailyshortPositionCount;
    usageMetrics.dailyopenPositionCount =
      tempUsageMetrics.dailyopenPositionCount;
    usageMetrics.dailyclosedPositionCount =
      tempUsageMetrics.dailyclosedPositionCount;
    usageMetrics.dailycumulativePositionCount =
      tempUsageMetrics.dailycumulativePositionCount;

    usageMetrics.dailyTransactionCount = tempUsageMetrics.dailyTransactionCount;
    usageMetrics.dailyDepositCount = tempUsageMetrics.dailyDepositCount;
    usageMetrics.dailyWithdrawCount = tempUsageMetrics.dailyWithdrawCount;
    usageMetrics.dailyBorrowCount = tempUsageMetrics.dailyBorrowCount;
    usageMetrics.dailySwapCount = tempUsageMetrics.dailySwapCount;

    usageMetrics.dailyActiveDepositors = tempUsageMetrics.dailyActiveDepositors;
    usageMetrics.dailyActiveBorrowers = tempUsageMetrics.dailyActiveBorrowers;
    usageMetrics.dailyActiveLiquidators =
      tempUsageMetrics.dailyActiveLiquidators;
    usageMetrics.dailyActiveLiquidatees =
      tempUsageMetrics.dailyActiveLiquidatees;
    usageMetrics.dailyActiveUsers = tempUsageMetrics.dailyActiveUsers;

    usageMetrics.dailyCollateralIn = tempUsageMetrics.dailyCollateralIn;
    usageMetrics.dailyCollateralOut = tempUsageMetrics.dailyCollateralOut;
  } else {
    usageMetrics.dailylongPositionCount = INT_ZERO;
    usageMetrics.dailyshortPositionCount = INT_ZERO;
    usageMetrics.dailyopenPositionCount = INT_ZERO;
    usageMetrics.dailyclosedPositionCount = INT_ZERO;
    usageMetrics.dailycumulativePositionCount = INT_ZERO;

    usageMetrics.dailyTransactionCount = INT_ZERO;
    usageMetrics.dailyDepositCount = INT_ZERO;
    usageMetrics.dailyWithdrawCount = INT_ZERO;
    usageMetrics.dailyBorrowCount = INT_ZERO;
    usageMetrics.dailySwapCount = INT_ZERO;

    usageMetrics.dailyActiveDepositors = INT_ZERO;
    usageMetrics.dailyActiveBorrowers = INT_ZERO;
    usageMetrics.dailyActiveLiquidators = INT_ZERO;
    usageMetrics.dailyActiveLiquidatees = INT_ZERO;
    usageMetrics.dailyActiveUsers = INT_ZERO;

    usageMetrics.dailyCollateralIn = INT_ZERO;
    usageMetrics.dailyCollateralOut = INT_ZERO;
  }

  usageMetrics.longPositionCount = protocol.longPositionCount;
  usageMetrics.shortPositionCount = protocol.shortPositionCount;
  usageMetrics.openPositionCount = protocol.openPositionCount;
  usageMetrics.closedPositionCount = protocol.closedPositionCount;
  usageMetrics.cumulativePositionCount = protocol.cumulativePositionCount;

  usageMetrics.cumulativeUniqueDepositors =
    protocol._cumulativeUniqueDepositors;
  usageMetrics.cumulativeUniqueBorrowers = protocol.cumulativeUniqueBorrowers;
  usageMetrics.cumulativeUniqueLiquidators =
    protocol.cumulativeUniqueLiquidators;
  usageMetrics.cumulativeUniqueLiquidatees =
    protocol.cumulativeUniqueLiquidatees;
  usageMetrics.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;

  usageMetrics.cumulativeCollateralIn = protocol.collateralInCount;
  usageMetrics.cumulativeCollateralOut = protocol.collateralOutCount;

  usageMetrics.totalPoolCount = protocol.totalPoolCount;

  usageMetrics.save();
}

export function UpdateUsageMetricsHourlySnapshot(
  protocol: DerivPerpProtocol,
  hour: i32
): void {
  // Create unique id for the hour
  const id = Bytes.fromI32(hour);
  if (UsageMetricsHourlySnapshot.load(id)) {
    return;
  }

  const usageMetrics = new UsageMetricsHourlySnapshot(id);
  usageMetrics.hours = hour;
  usageMetrics.protocol = protocol.id;

  let tempUsageMetrics = _TempUsageMetricsHourlySnapshot.load(id);
  if (tempUsageMetrics) {
    usageMetrics.hourlyActiveUsers = tempUsageMetrics.hourlyActiveUsers;
    usageMetrics.hourlyTransactionCount =
      tempUsageMetrics.hourlyTransactionCount;
    usageMetrics.hourlyDepositCount = tempUsageMetrics.hourlyDepositCount;
    usageMetrics.hourlyWithdrawCount = tempUsageMetrics.hourlyWithdrawCount;
    usageMetrics.hourlySwapCount = tempUsageMetrics.hourlySwapCount;
  } else {
    usageMetrics.hourlyActiveUsers = INT_ZERO;
    usageMetrics.hourlyTransactionCount = INT_ZERO;
    usageMetrics.hourlyDepositCount = INT_ZERO;
    usageMetrics.hourlyWithdrawCount = INT_ZERO;
    usageMetrics.hourlySwapCount = INT_ZERO;
  }

  usageMetrics.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers;

  usageMetrics.save();

  return;
}

export function getOrCreateTempUsageMetricsDailySnapshot(
  event: ethereum.Event
): _TempUsageMetricsDailySnapshot {
  const protocol = getOrCreateProtocol();
  // Number of days since Unix epoch
  const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  // Create unique id for the day
  const id = Bytes.fromI32(day);
  let usageMetrics = _TempUsageMetricsDailySnapshot.load(id);

  if (!usageMetrics) {
    usageMetrics = new _TempUsageMetricsDailySnapshot(id);
    usageMetrics.days = day;
    usageMetrics.protocol = protocol.id;

    usageMetrics.dailylongPositionCount = INT_ZERO;
    usageMetrics.dailyshortPositionCount = INT_ZERO;
    usageMetrics.dailyopenPositionCount = INT_ZERO;
    usageMetrics.dailyclosedPositionCount = INT_ZERO;
    usageMetrics.dailycumulativePositionCount = INT_ZERO;

    usageMetrics.dailyTransactionCount = INT_ZERO;
    usageMetrics.dailyDepositCount = INT_ZERO;
    usageMetrics.dailyWithdrawCount = INT_ZERO;
    usageMetrics.dailyBorrowCount = INT_ZERO;
    usageMetrics.dailySwapCount = INT_ZERO;

    usageMetrics.dailyActiveDepositors = INT_ZERO;
    usageMetrics.dailyActiveBorrowers = INT_ZERO;
    usageMetrics.dailyActiveLiquidators = INT_ZERO;
    usageMetrics.dailyActiveLiquidatees = INT_ZERO;
    usageMetrics.dailyActiveUsers = INT_ZERO;

    usageMetrics.dailyCollateralIn = INT_ZERO;
    usageMetrics.dailyCollateralOut = INT_ZERO;

    usageMetrics.save();
  }

  return usageMetrics;
}

export function getOrCreateTempUsageMetricsHourlySnapshot(
  event: ethereum.Event
): _TempUsageMetricsHourlySnapshot {
  const protocol = getOrCreateProtocol();
  // Number of hours since Unix epoch
  const hour = event.block.timestamp.toI32() / SECONDS_PER_HOUR;
  const id = Bytes.fromI32(hour);
  // Create unique id for the day
  let usageMetrics = _TempUsageMetricsHourlySnapshot.load(id);

  if (!usageMetrics) {
    usageMetrics = new _TempUsageMetricsHourlySnapshot(id);
    usageMetrics.hours = hour;
    usageMetrics.protocol = protocol.id;

    usageMetrics.hourlyActiveUsers = INT_ZERO;
    usageMetrics.hourlyTransactionCount = INT_ZERO;
    usageMetrics.hourlyDepositCount = INT_ZERO;
    usageMetrics.hourlyWithdrawCount = INT_ZERO;
    usageMetrics.hourlySwapCount = INT_ZERO;

    usageMetrics.save();
  }

  return usageMetrics;
}

// Update temp usage metrics entities
export function updateTempUsageMetrics(
  event: ethereum.Event,
  fromAddress: Address,
  eventType: EventType,
  openPositionCount: i32,
  positionSide: string | null
): void {
  const usageMetricsDaily = getOrCreateTempUsageMetricsDailySnapshot(event);
  const usageMetricsHourly = getOrCreateTempUsageMetricsHourlySnapshot(event);

  usageMetricsDaily.dailyTransactionCount += INT_ONE;
  usageMetricsHourly.hourlyTransactionCount += INT_ONE;

  switch (eventType) {
    case EventType.Deposit:
      usageMetricsDaily.dailyDepositCount += INT_ONE;
      usageMetricsHourly.hourlyDepositCount += INT_ONE;
      if (isUniqueDailyUser(event, fromAddress, eventType)) {
        usageMetricsDaily.dailyActiveDepositors += INT_ONE;
      }
      break;
    case EventType.Withdraw:
      usageMetricsDaily.dailyWithdrawCount += INT_ONE;
      usageMetricsHourly.hourlyWithdrawCount += INT_ONE;
      break;
    case EventType.CollateralIn:
      usageMetricsDaily.dailyCollateralIn += INT_ONE;
      usageMetricsDaily.dailyBorrowCount += INT_ONE;
      if (isUniqueDailyUser(event, fromAddress, eventType)) {
        usageMetricsDaily.dailyActiveBorrowers += INT_ONE;
      }
      break;
    case EventType.CollateralOut:
      usageMetricsDaily.dailyCollateralOut += INT_ONE;
      break;
    case EventType.Swap:
      usageMetricsDaily.dailySwapCount += INT_ONE;
      usageMetricsHourly.hourlySwapCount += INT_ONE;
      break;
    case EventType.Liquidate:
      if (isUniqueDailyUser(event, fromAddress, eventType)) {
        usageMetricsDaily.dailyActiveLiquidators += INT_ONE;
      }
      break;
    case EventType.Liquidated:
      if (isUniqueDailyUser(event, fromAddress, eventType)) {
        usageMetricsDaily.dailyActiveLiquidatees += INT_ONE;
      }
      break;
  }

  // Number of days since Unix epoch
  const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  const hour = event.block.timestamp.toI32() / SECONDS_PER_HOUR;

  // Combine the id and the user address to generate a unique user id for the day
  const dailyActiveAccountId = fromAddress.concatI32(day);
  let dailyActiveAccount = ActiveAccount.load(dailyActiveAccountId);
  if (!dailyActiveAccount) {
    dailyActiveAccount = new ActiveAccount(dailyActiveAccountId);
    usageMetricsDaily.dailyActiveUsers += INT_ONE;
    dailyActiveAccount.save();
  }

  const hourlyActiveAccountId = fromAddress.concatI32(hour);
  let hourlyActiveAccount = ActiveAccount.load(hourlyActiveAccountId);
  if (!hourlyActiveAccount) {
    hourlyActiveAccount = new ActiveAccount(hourlyActiveAccountId);
    usageMetricsHourly.hourlyActiveUsers += INT_ONE;
    hourlyActiveAccount.save();
  }

  if (openPositionCount > INT_ZERO) {
    if (PositionSide.LONG == positionSide) {
      usageMetricsDaily.dailylongPositionCount += INT_ONE;
    } else {
      usageMetricsDaily.dailyshortPositionCount += INT_ONE;
    }
    usageMetricsDaily.dailyopenPositionCount += INT_ONE;
    usageMetricsDaily.dailycumulativePositionCount += INT_ONE;
  } else if (openPositionCount < INT_ZERO) {
    usageMetricsDaily.dailyclosedPositionCount += INT_ONE;
  }

  usageMetricsDaily.save();
  usageMetricsHourly.save();
}

function isUniqueDailyUser(
  event: ethereum.Event,
  fromAddress: Address,
  eventType: EventType
): boolean {
  const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  // Combine the id, user address, and action to generate a unique user id for the day
  const dailyActionActiveAccountId = fromAddress
    .concatI32(day)
    .concat(Bytes.fromUTF8(eventType.toString()));
  let dailyActionActiveAccount = ActiveAccount.load(dailyActionActiveAccountId);
  if (!dailyActionActiveAccount) {
    dailyActionActiveAccount = new ActiveAccount(dailyActionActiveAccountId);
    dailyActionActiveAccount.save();
    return true;
  }
  return false;
}
