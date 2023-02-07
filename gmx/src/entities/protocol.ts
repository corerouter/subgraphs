import { BigDecimal, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import {
  DerivPerpProtocol,
  FinancialsDailySnapshot,
} from "../../generated/schema";
import { Versions } from "../versions";
import { NetworkConfigs } from "../../configurations/configure";
import { EventType } from "./event";
import {
  BIGDECIMAL_ONE,
  BIGDECIMAL_ZERO,
  BIGINT_ZERO,
  INT_ONE,
  INT_ZERO,
  PositionSide,
  ProtocolType,
  PROTOCOL_NAME,
  PROTOCOL_SLUG,
  SECONDS_PER_DAY,
} from "../utils/constants";

export function getOrCreateProtocol(): DerivPerpProtocol {
  let protocol = DerivPerpProtocol.load(NetworkConfigs.getVaultAddress());

  if (!protocol) {
    protocol = new DerivPerpProtocol(NetworkConfigs.getVaultAddress());
    protocol.name = PROTOCOL_NAME;
    protocol.slug = PROTOCOL_SLUG;
    protocol.network = NetworkConfigs.getNetwork();
    protocol.type = ProtocolType.PERPETUAL;

    protocol.totalValueLockedUSD = BIGDECIMAL_ZERO;
    protocol.protocolControlledValueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeVolumeUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeStakeSideRevenueUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;

    protocol.cumulativeEntryPremiumUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeExitPremiumUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeTotalPremiumUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeDepositPremiumUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeWithdrawPremiumUSD = BIGDECIMAL_ZERO;
    protocol.cumulativeTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;

    protocol.cumulativeUniqueUsers = INT_ZERO;
    protocol.cumulativeUniqueBorrowers = INT_ZERO;
    protocol.cumulativeUniqueLiquidators = INT_ZERO;
    protocol.cumulativeUniqueLiquidatees = INT_ZERO;
    protocol._cumulativeUniqueDepositors = INT_ZERO;

    protocol.openInterestUSD = BIGDECIMAL_ZERO;
    protocol.longPositionCount = INT_ZERO;
    protocol.shortPositionCount = INT_ZERO;
    protocol.openPositionCount = INT_ZERO;
    protocol.closedPositionCount = INT_ZERO;
    protocol.cumulativePositionCount = INT_ZERO;

    protocol.transactionCount = INT_ZERO;
    protocol.depositCount = INT_ZERO;
    protocol.withdrawCount = INT_ZERO;
    protocol.collateralInCount = INT_ZERO;
    protocol.collateralOutCount = INT_ZERO;
    protocol.borrowCount = INT_ZERO;

    protocol.totalPoolCount = INT_ZERO;

    protocol._cumulativeInflowVolumeUSD = BIGDECIMAL_ZERO;
    protocol._cumulativeClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
    protocol._cumulativeOutflowVolumeUSD = BIGDECIMAL_ZERO;
    protocol._lastSnapshotDayID = INT_ZERO;
    protocol._lastUpdateTimestamp = BIGINT_ZERO;
  }

  protocol.schemaVersion = Versions.getSchemaVersion();
  protocol.subgraphVersion = Versions.getSubgraphVersion();
  protocol.methodologyVersion = Versions.getMethodologyVersion();
  protocol.save();

  return protocol;
}

// export function getOrCreateFinancialsDailySnapshot(
//   event: ethereum.Event
// ): FinancialsDailySnapshot {
//   // Number of days since Unix epoch
//   const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
//   // Create unique id for the day
//   const dayId = Bytes.fromI32(day);
//   let financialMetrics = FinancialsDailySnapshot.load(dayId);

//   if (!financialMetrics) {
//     financialMetrics = new FinancialsDailySnapshot(dayId);
//     financialMetrics.days = day;
//     const protocol = getOrCreateProtocol();
//     financialMetrics.protocol = protocol.id;

//     financialMetrics.totalValueLockedUSD = protocol.totalValueLockedUSD;

//     financialMetrics.dailyVolumeUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeVolumeUSD = protocol.cumulativeVolumeUSD;
//     financialMetrics.dailyInflowVolumeUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeInflowVolumeUSD =
//       protocol._cumulativeInflowVolumeUSD;
//     financialMetrics.dailyClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeClosedInflowVolumeUSD =
//       protocol._cumulativeClosedInflowVolumeUSD;
//     financialMetrics.dailyOutflowVolumeUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeOutflowVolumeUSD =
//       protocol._cumulativeOutflowVolumeUSD;

//     financialMetrics.dailyTotalRevenueUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeTotalRevenueUSD =
//       protocol.cumulativeTotalRevenueUSD;
//     financialMetrics.dailySupplySideRevenueUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeSupplySideRevenueUSD =
//       protocol.cumulativeSupplySideRevenueUSD;
//     financialMetrics.dailyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeProtocolSideRevenueUSD =
//       protocol.cumulativeProtocolSideRevenueUSD;
//     financialMetrics.dailyStakeSideRevenueUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeStakeSideRevenueUSD =
//       protocol.cumulativeStakeSideRevenueUSD;

//     financialMetrics.dailyEntryPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeEntryPremiumUSD =
//       protocol.cumulativeEntryPremiumUSD;
//     financialMetrics.dailyExitPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeExitPremiumUSD =
//       protocol.cumulativeExitPremiumUSD;
//     financialMetrics.dailyTotalPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeTotalPremiumUSD =
//       protocol.cumulativeTotalPremiumUSD;
//     financialMetrics.dailyDepositPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeDepositPremiumUSD =
//       protocol.cumulativeDepositPremiumUSD;
//     financialMetrics.dailyWithdrawPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeWithdrawPremiumUSD =
//       protocol.cumulativeWithdrawPremiumUSD;
//     financialMetrics.dailyTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;
//     financialMetrics.cumulativeTotalLiquidityPremiumUSD =
//       protocol.cumulativeTotalLiquidityPremiumUSD;

//     financialMetrics.save();
//   }

//   return financialMetrics;
// }

export function updateFinancialDailySnapshot(
  protocol: DerivPerpProtocol,
  day: i32
): void {
  const id = Bytes.fromI32(day);

  // log.error(
  //   "update protocol snapshot at day {} while _lastSnapshotDayID is {} ",
  //   [day.toString(), protocol._lastSnapshotDayID.toString()]
  // );

  if (FinancialsDailySnapshot.load(id)) {
    return;
  }

  const financialMetrics = new FinancialsDailySnapshot(id);
  const prevFinancialMetrics = FinancialsDailySnapshot.load(
    Bytes.fromI32(protocol._lastSnapshotDayID)
  );

  let prevCumulativeVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeOutflowVolumeUSD = BIGDECIMAL_ZERO;

  let prevCumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeStakeSideRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeEntryPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeExitPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeDepositPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeWithdrawPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;

  if (prevFinancialMetrics != null) {
    prevCumulativeVolumeUSD = prevFinancialMetrics.cumulativeVolumeUSD;
    prevCumulativeInflowVolumeUSD =
      prevFinancialMetrics.cumulativeInflowVolumeUSD;
    prevCumulativeClosedInflowVolumeUSD =
      prevFinancialMetrics.cumulativeClosedInflowVolumeUSD;
    prevCumulativeOutflowVolumeUSD =
      prevFinancialMetrics.cumulativeOutflowVolumeUSD;
    prevCumulativeSupplySideRevenueUSD =
      prevFinancialMetrics.cumulativeSupplySideRevenueUSD;
    prevCumulativeProtocolSideRevenueUSD =
      prevFinancialMetrics.cumulativeProtocolSideRevenueUSD;
    prevCumulativeStakeSideRevenueUSD =
      prevFinancialMetrics.cumulativeStakeSideRevenueUSD;
    prevCumulativeTotalRevenueUSD =
      prevFinancialMetrics.cumulativeTotalRevenueUSD;
    prevCumulativeEntryPremiumUSD =
      prevFinancialMetrics.cumulativeEntryPremiumUSD;
    prevCumulativeExitPremiumUSD =
      prevFinancialMetrics.cumulativeExitPremiumUSD;
    prevCumulativeTotalPremiumUSD =
      prevFinancialMetrics.cumulativeTotalPremiumUSD;
    prevCumulativeDepositPremiumUSD =
      prevFinancialMetrics.cumulativeDepositPremiumUSD;
    prevCumulativeWithdrawPremiumUSD =
      prevFinancialMetrics.cumulativeWithdrawPremiumUSD;
    prevCumulativeTotalLiquidityPremiumUSD =
      prevFinancialMetrics.cumulativeTotalLiquidityPremiumUSD;
  } else if (protocol._lastSnapshotDayID > INT_ZERO) {
    log.error(
      "Missing protocol snapshot at ID that has been snapped: Protocol {}, ID {} ",
      [protocol.id.toHexString(), protocol._lastSnapshotDayID.toString()]
    );
  }

  financialMetrics.days = day;
  financialMetrics.protocol = protocol.id;
  financialMetrics.totalValueLockedUSD = protocol.totalValueLockedUSD;
  financialMetrics.protocolControlledValueUSD =
    protocol.protocolControlledValueUSD;
  financialMetrics.cumulativeVolumeUSD = protocol.cumulativeVolumeUSD;
  financialMetrics.dailyVolumeUSD = protocol.cumulativeVolumeUSD.minus(
    prevCumulativeVolumeUSD
  );
  financialMetrics.cumulativeInflowVolumeUSD =
    protocol._cumulativeInflowVolumeUSD;
  financialMetrics.dailyInflowVolumeUSD =
    protocol._cumulativeInflowVolumeUSD.minus(prevCumulativeInflowVolumeUSD);
  financialMetrics.cumulativeClosedInflowVolumeUSD =
    protocol._cumulativeClosedInflowVolumeUSD;
  financialMetrics.dailyClosedInflowVolumeUSD =
    protocol._cumulativeClosedInflowVolumeUSD.minus(
      prevCumulativeClosedInflowVolumeUSD
    );
  financialMetrics.cumulativeOutflowVolumeUSD =
    protocol._cumulativeOutflowVolumeUSD;
  financialMetrics.dailyOutflowVolumeUSD =
    protocol._cumulativeOutflowVolumeUSD.minus(prevCumulativeOutflowVolumeUSD);
  financialMetrics.cumulativeSupplySideRevenueUSD =
    protocol.cumulativeSupplySideRevenueUSD;
  financialMetrics.dailySupplySideRevenueUSD =
    protocol.cumulativeSupplySideRevenueUSD.minus(
      prevCumulativeSupplySideRevenueUSD
    );
  financialMetrics.cumulativeProtocolSideRevenueUSD =
    protocol.cumulativeProtocolSideRevenueUSD;
  financialMetrics.dailyProtocolSideRevenueUSD =
    protocol.cumulativeProtocolSideRevenueUSD.minus(
      prevCumulativeProtocolSideRevenueUSD
    );
  financialMetrics.cumulativeTotalRevenueUSD =
    protocol.cumulativeTotalRevenueUSD;
  financialMetrics.dailyTotalRevenueUSD =
    protocol.cumulativeTotalRevenueUSD.minus(prevCumulativeTotalRevenueUSD);
  financialMetrics.cumulativeStakeSideRevenueUSD =
    protocol.cumulativeStakeSideRevenueUSD;
  financialMetrics.dailyStakeSideRevenueUSD =
    protocol.cumulativeStakeSideRevenueUSD.minus(
      prevCumulativeStakeSideRevenueUSD
    );
  financialMetrics.dailyEntryPremiumUSD =
    protocol.cumulativeEntryPremiumUSD.minus(prevCumulativeEntryPremiumUSD);
  financialMetrics.cumulativeEntryPremiumUSD =
    protocol.cumulativeEntryPremiumUSD;
  financialMetrics.dailyExitPremiumUSD =
    protocol.cumulativeExitPremiumUSD.minus(prevCumulativeExitPremiumUSD);
  financialMetrics.cumulativeExitPremiumUSD = protocol.cumulativeExitPremiumUSD;
  financialMetrics.dailyTotalPremiumUSD =
    protocol.cumulativeTotalPremiumUSD.minus(prevCumulativeTotalPremiumUSD);
  financialMetrics.cumulativeTotalPremiumUSD =
    protocol.cumulativeTotalPremiumUSD;
  financialMetrics.dailyDepositPremiumUSD =
    protocol.cumulativeDepositPremiumUSD.minus(prevCumulativeDepositPremiumUSD);
  financialMetrics.cumulativeDepositPremiumUSD =
    protocol.cumulativeDepositPremiumUSD;
  financialMetrics.dailyWithdrawPremiumUSD =
    protocol.cumulativeWithdrawPremiumUSD.minus(
      prevCumulativeWithdrawPremiumUSD
    );
  financialMetrics.cumulativeWithdrawPremiumUSD =
    protocol.cumulativeWithdrawPremiumUSD;
  financialMetrics.dailyTotalLiquidityPremiumUSD =
    protocol.cumulativeTotalLiquidityPremiumUSD.minus(
      prevCumulativeTotalLiquidityPremiumUSD
    );
  financialMetrics.cumulativeTotalLiquidityPremiumUSD =
    protocol.cumulativeTotalLiquidityPremiumUSD;
  financialMetrics.dailyOpenInterestUSD = protocol.openInterestUSD;

  financialMetrics.save();
}

export function increaseSupplySideRevenue(
  event: ethereum.Event,
  revenueAmountUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeSupplySideRevenueUSD =
    protocol.cumulativeSupplySideRevenueUSD.plus(revenueAmountUSD);
  protocol.cumulativeTotalRevenueUSD =
    protocol.cumulativeTotalRevenueUSD.plus(revenueAmountUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolVolume(
  event: ethereum.Event,
  amountUSD: BigDecimal,
  eventType: EventType
): void {
  const protocol = getOrCreateProtocol();
  switch (eventType) {
    case EventType.CollateralIn:
      protocol._cumulativeInflowVolumeUSD =
        protocol._cumulativeInflowVolumeUSD.plus(amountUSD);
      break;
    case EventType.ClosePosition:
      protocol._cumulativeClosedInflowVolumeUSD =
        protocol._cumulativeClosedInflowVolumeUSD.plus(amountUSD);
      break;
    case EventType.CollateralOut:
      protocol._cumulativeOutflowVolumeUSD =
        protocol._cumulativeOutflowVolumeUSD.plus(amountUSD);
      break;
    default:
      break;
  }
  protocol.cumulativeVolumeUSD = protocol.cumulativeVolumeUSD.plus(amountUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolPremium(
  event: ethereum.Event,
  amountUSD: BigDecimal,
  eventType: EventType
): void {
  const protocol = getOrCreateProtocol();
  switch (eventType) {
    case EventType.Deposit:
      protocol.cumulativeDepositPremiumUSD =
        protocol.cumulativeDepositPremiumUSD.plus(amountUSD);
      protocol.cumulativeTotalLiquidityPremiumUSD =
        protocol.cumulativeTotalLiquidityPremiumUSD.plus(amountUSD);
      break;
    case EventType.Withdraw:
      protocol.cumulativeWithdrawPremiumUSD =
        protocol.cumulativeWithdrawPremiumUSD.plus(amountUSD);
      protocol.cumulativeTotalLiquidityPremiumUSD =
        protocol.cumulativeTotalLiquidityPremiumUSD.plus(amountUSD);
      break;
    case EventType.CollateralIn:
      protocol.cumulativeEntryPremiumUSD =
        protocol.cumulativeEntryPremiumUSD.plus(amountUSD);
      protocol.cumulativeTotalPremiumUSD =
        protocol.cumulativeTotalPremiumUSD.plus(amountUSD);
      break;
    case EventType.CollateralOut:
      protocol.cumulativeExitPremiumUSD =
        protocol.cumulativeExitPremiumUSD.plus(amountUSD);
      protocol.cumulativeTotalPremiumUSD =
        protocol.cumulativeTotalPremiumUSD.plus(amountUSD);
      break;

    default:
      break;
  }

  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function updateProtocolTVL(
  event: ethereum.Event,
  tvlChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.totalValueLockedUSD =
    protocol.totalValueLockedUSD.plus(tvlChangeUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function updateProtocolOpenInterestUSD(
  event: ethereum.Event,
  openInterestChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.openInterestUSD = protocol.openInterestUSD.plus(
    openInterestChangeUSD
  );
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolEventCount(
  event: ethereum.Event,
  eventType: EventType
): void {
  const protocol = getOrCreateProtocol();
  switch (eventType) {
    case EventType.Deposit:
      protocol.depositCount += INT_ONE;
      break;
    case EventType.Withdraw:
      protocol.withdrawCount += INT_ONE;
      break;
    case EventType.CollateralIn:
      protocol.collateralInCount += INT_ONE;
      protocol.borrowCount += INT_ONE;
      break;
    case EventType.CollateralOut:
      protocol.collateralOutCount += INT_ONE;
      break;
    default:
      break;
  }

  protocol.transactionCount += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolUniqueUsers(event: ethereum.Event): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeUniqueUsers += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolUniqueBorrowers(event: ethereum.Event): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeUniqueBorrowers += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolUniqueLiquidators(
  event: ethereum.Event
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeUniqueLiquidators += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolUniqueLiquidatees(
  event: ethereum.Event
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeUniqueLiquidatees += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolOpenPositionCount(
  event: ethereum.Event,
  positionSide: string
): void {
  const protocol = getOrCreateProtocol();
  if (PositionSide.LONG == positionSide) {
    protocol.longPositionCount += INT_ONE;
  } else {
    protocol.shortPositionCount += INT_ONE;
  }
  protocol.openPositionCount += INT_ONE;
  protocol.cumulativePositionCount += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function decrementProtocolOpenPositionCount(
  event: ethereum.Event,
  positionSide: string
): void {
  const protocol = getOrCreateProtocol();
  if (PositionSide.LONG == positionSide) {
    protocol.longPositionCount -= INT_ONE;
  } else {
    protocol.shortPositionCount -= INT_ONE;
  }
  protocol.openPositionCount -= INT_ONE;
  protocol.closedPositionCount += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function incrementProtocolTotalPoolCount(event: ethereum.Event): void {
  const protocol = getOrCreateProtocol();
  protocol.totalPoolCount += INT_ONE;
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolTotalRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeTotalRevenueUSD =
    protocol.cumulativeTotalRevenueUSD.plus(amountChangeUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolSideRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeProtocolSideRevenueUSD =
    protocol.cumulativeProtocolSideRevenueUSD.plus(amountChangeUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolSupplySideRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeSupplySideRevenueUSD =
    protocol.cumulativeSupplySideRevenueUSD.plus(amountChangeUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function increaseProtocolStakeSideRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const protocol = getOrCreateProtocol();
  protocol.cumulativeStakeSideRevenueUSD =
    protocol.cumulativeStakeSideRevenueUSD.plus(amountChangeUSD);
  protocol._lastUpdateTimestamp = event.block.timestamp;
  protocol.save();
}

export function updateProtocolSnapshotDayID(snapshotDayID: i32): void {
  const protocol = getOrCreateProtocol();
  protocol._lastSnapshotDayID = snapshotDayID;
  protocol.save();
}
