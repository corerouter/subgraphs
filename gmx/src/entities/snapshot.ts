import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  getOrCreateProtocol,
  updateFinancialDailySnapshot,
  updateProtocolSnapshotDayID,
} from "./protocol";
import {
  getOrCreateLiquidityPool,
  updateLiquidityPoolDailySnapshot,
  updateLiquidityPoolHourlySnapshot,
  updatePoolSnapshotDayID,
  updatePoolSnapshotHourID,
} from "./pool";
import {
  updateUsageMetricsDailySnapshot,
  UpdateUsageMetricsHourlySnapshot,
} from "./usage";
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from "../utils/constants";

// Positions are only snapped once per interval to save space
export function updateSnapshots(event: ethereum.Event): void {
  const dayID = event.block.timestamp.toI32() / SECONDS_PER_DAY;
  const hourID = event.block.timestamp.toI32() / SECONDS_PER_HOUR;

  const protocol = getOrCreateProtocol();
  const protocolSnapshotDayID =
    protocol._lastUpdateTimestamp.toI32() / SECONDS_PER_DAY;
  const protocolSnapshotHourID =
    protocol._lastUpdateTimestamp.toI32() / SECONDS_PER_HOUR;
  if (protocolSnapshotDayID != dayID) {
    updateFinancialDailySnapshot(protocol, protocolSnapshotDayID);
    updateUsageMetricsDailySnapshot(protocol, protocolSnapshotDayID);
    updateProtocolSnapshotDayID(protocolSnapshotDayID);
  }
  if (protocolSnapshotHourID != hourID) {
    UpdateUsageMetricsHourlySnapshot(protocol, protocolSnapshotHourID);
  }

  const pool = getOrCreateLiquidityPool(event);
  const poolSnapshotDayID = pool._lastUpdateTimestamp.toI32() / SECONDS_PER_DAY;
  const poolSnapshotHourID =
    pool._lastUpdateTimestamp.toI32() / SECONDS_PER_HOUR;
  if (poolSnapshotDayID != dayID) {
    updateLiquidityPoolDailySnapshot(pool, poolSnapshotDayID);
    updatePoolSnapshotDayID(event, poolSnapshotDayID);
  }
  if (poolSnapshotHourID != hourID) {
    updateLiquidityPoolHourlySnapshot(pool, poolSnapshotHourID);
    updatePoolSnapshotHourID(event, poolSnapshotHourID);
  }
}
