import {
  Address,
  BigDecimal,
  BigInt,
  Bytes,
  ethereum,
  log,
} from "@graphprotocol/graph-ts";
import {
  LiquidityPool,
  LiquidityPoolDailySnapshot,
  LiquidityPoolFee,
  LiquidityPoolHourlySnapshot,
  RewardToken,
  Token,
} from "../../generated/schema";
import { NetworkConfigs } from "../../configurations/configure";
import { EventType } from "./event";
import {
  increaseProtocolVolume,
  decrementProtocolOpenPositionCount,
  getOrCreateProtocol,
  incrementProtocolOpenPositionCount,
  updateProtocolTVL,
  increaseProtocolPremium,
  increaseProtocolTotalRevenue,
  increaseProtocolSideRevenue,
  increaseProtocolSupplySideRevenue,
  updateProtocolOpenInterestUSD,
} from "./protocol";
import { getOrCreateToken, updateTokenPrice } from "./token";
import {
  BIGDECIMAL_ZERO,
  INT_ZERO,
  BIGINT_ZERO,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  PositionSide,
  INT_ONE,
  DEFAULT_DECIMALS,
  BIGDECIMAL_HUNDRED,
  LiquidityPoolFeeType,
  BIGDECIMAL_THOUSAND,
} from "../utils/constants";
import { convertTokenToDecimal, multiArraySort } from "../utils/numbers";
import { Vault } from "../../generated/Vault/Vault";
import { enumToPrefix } from "../utils/strings";

export function getOrCreateLiquidityPool(event: ethereum.Event): LiquidityPool {
  const protocol = getOrCreateProtocol();
  const poolAddress = NetworkConfigs.getVaultAddress();
  let pool = LiquidityPool.load(poolAddress);

  if (!pool) {
    pool = new LiquidityPool(poolAddress);

    // Metadata
    pool.protocol = protocol.id;
    pool.name = "GMXVault";
    pool.symbol = "VAULT";
    pool.createdTimestamp = event.block.timestamp;
    pool.createdBlockNumber = event.block.number;

    // Tokens
    pool.inputTokens = [];
    pool.outputToken = null;
    pool.rewardTokens = [];

    pool.fees = createPoolFees(poolAddress);

    // Quantitative Revenue Data
    pool.totalValueLockedUSD = BIGDECIMAL_ZERO;
    pool.cumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;
    pool.cumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;

    pool.cumulativeEntryPremiumUSD = BIGDECIMAL_ZERO;
    pool.cumulativeExitPremiumUSD = BIGDECIMAL_ZERO;
    pool.cumulativeTotalPremiumUSD = BIGDECIMAL_ZERO;
    pool.cumulativeDepositPremiumUSD = BIGDECIMAL_ZERO;
    pool.cumulativeWithdrawPremiumUSD = BIGDECIMAL_ZERO;
    pool.cumulativeTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;

    pool.cumulativeUniqueBorrowers = INT_ZERO;
    pool.cumulativeUniqueLiquidators = INT_ZERO;
    pool.cumulativeUniqueLiquidatees = INT_ZERO;

    pool.openInterestUSD = BIGDECIMAL_ZERO;
    pool.longPositionCount = INT_ZERO;
    pool.shortPositionCount = INT_ZERO;
    pool.openPositionCount = INT_ZERO;
    pool.closedPositionCount = INT_ZERO;
    pool.cumulativePositionCount = INT_ZERO;

    // Quantitative Token Data
    pool.inputTokenBalances = [];
    pool.inputTokenWeights = [];
    pool.outputTokenSupply = BIGINT_ZERO;
    pool.outputTokenPriceUSD = BIGDECIMAL_ZERO;
    pool.stakedOutputTokenAmount = BIGINT_ZERO;
    pool.rewardTokenEmissionsAmount = [];
    pool.rewardTokenEmissionsUSD = [];

    pool.cumulativeVolumeUSD = BIGDECIMAL_ZERO;
    pool._cumulativeInflowVolumeUSD = BIGDECIMAL_ZERO;
    pool._cumulativeClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
    pool._cumulativeOutflowVolumeUSD = BIGDECIMAL_ZERO;

    pool._fundingrate = [];
    pool._lastSnapshotDayID = INT_ZERO;
    pool._lastSnapshotHourID = INT_ZERO;
    pool._lastUpdateTimestamp = BIGINT_ZERO;

    // update number of pools
    protocol.totalPoolCount += 1;
    protocol.save();

    pool.save();
  }

  return pool;
}

// export function getOrCreateLiquidityPoolDailySnapshot(
//   event: ethereum.Event
// ): LiquidityPoolDailySnapshot {
//   // Number of days since Unix epoch
//   const day = event.block.timestamp.toI32() / SECONDS_PER_DAY;
//   // Create unique id for the day
//   const dayId = Bytes.fromI32(day);
//   let poolMetrics = LiquidityPoolDailySnapshot.load(dayId);

//   if (!poolMetrics) {
//     poolMetrics = new LiquidityPoolDailySnapshot(dayId);
//     poolMetrics.days = day;
//     poolMetrics.protocol = getOrCreateProtocol().id;
//     const pool = getOrCreateLiquidityPool(event);
//     poolMetrics.pool = pool.id;

//     poolMetrics.totalValueLockedUSD = pool.totalValueLockedUSD;

//     poolMetrics.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD;
//     poolMetrics.cumulativeSupplySideRevenueUSD =
//       pool.cumulativeSupplySideRevenueUSD;
//     poolMetrics.cumulativeProtocolSideRevenueUSD =
//       pool.cumulativeProtocolSideRevenueUSD;
//     poolMetrics.dailyTotalRevenueUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailySupplySideRevenueUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;

//     poolMetrics.dailyFundingrate = [];
//     poolMetrics.dailyEntryPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeEntryPremiumUSD = pool.cumulativeEntryPremiumUSD;
//     poolMetrics.dailyExitPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeExitPremiumUSD = pool.cumulativeExitPremiumUSD;
//     poolMetrics.dailyTotalPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeTotalPremiumUSD = pool.cumulativeTotalPremiumUSD;
//     poolMetrics.dailyDepositPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeDepositPremiumUSD = pool.cumulativeDepositPremiumUSD;
//     poolMetrics.dailyWithdrawPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeWithdrawPremiumUSD =
//       pool.cumulativeWithdrawPremiumUSD;
//     poolMetrics.dailyTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeTotalLiquidityPremiumUSD =
//       pool.cumulativeTotalLiquidityPremiumUSD;

//     poolMetrics.dailyActiveBorrowers = INT_ZERO;
//     poolMetrics.cumulativeUniqueBorrowers = pool.cumulativeUniqueBorrowers;
//     poolMetrics.dailyActiveLiquidators = INT_ZERO;
//     poolMetrics.cumulativeUniqueLiquidators = pool.cumulativeUniqueLiquidators;
//     poolMetrics.dailyActiveLiquidatees = INT_ZERO;
//     poolMetrics.cumulativeUniqueLiquidatees = pool.cumulativeUniqueLiquidatees;

//     poolMetrics.dailylongPositionCount = INT_ZERO;
//     poolMetrics.longPositionCount = pool.longPositionCount;
//     poolMetrics.dailyshortPositionCount = INT_ZERO;
//     poolMetrics.shortPositionCount = pool.shortPositionCount;
//     poolMetrics.dailyopenPositionCount = INT_ZERO;
//     poolMetrics.openPositionCount = pool.openPositionCount;
//     poolMetrics.dailyclosedPositionCount = INT_ZERO;
//     poolMetrics.closedPositionCount = pool.closedPositionCount;
//     poolMetrics.dailycumulativePositionCount = INT_ZERO;
//     poolMetrics.cumulativePositionCount = pool.cumulativePositionCount;

//     poolMetrics.dailyVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailyVolumeByTokenAmount = [];
//     poolMetrics.dailyVolumeByTokenUSD = [];
//     poolMetrics.cumulativeVolumeUSD = pool.cumulativeVolumeUSD;
//     poolMetrics.dailyInflowVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailyInflowVolumeByTokenAmount = [];
//     poolMetrics.dailyInflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeInflowVolumeUSD = pool._cumulativeInflowVolumeUSD;
//     poolMetrics.dailyClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailyClosedInflowVolumeByTokenAmount = [];
//     poolMetrics.dailyClosedInflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeClosedInflowVolumeUSD =
//       pool._cumulativeClosedInflowVolumeUSD;
//     poolMetrics.dailyOutflowVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.dailyOutflowVolumeByTokenAmount = [];
//     poolMetrics.dailyOutflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD;

//     poolMetrics.inputTokenBalances = pool.inputTokenBalances;
//     poolMetrics.inputTokenWeights = pool.inputTokenWeights;
//     poolMetrics.outputTokenSupply = pool.outputTokenSupply;
//     poolMetrics.outputTokenPriceUSD = pool.outputTokenPriceUSD;
//     poolMetrics.stakedOutputTokenAmount = pool.stakedOutputTokenAmount;
//     poolMetrics.rewardTokenEmissionsAmount = pool.rewardTokenEmissionsAmount;
//     poolMetrics.rewardTokenEmissionsUSD = pool.rewardTokenEmissionsUSD;

//     poolMetrics.save();
//   }

//   return poolMetrics;
// }

// export function getOrCreateLiquidityPoolHourlySnapshot(
//   event: ethereum.Event
// ): LiquidityPoolHourlySnapshot {
//   // Number of hours since Unix epoch
//   const hour = event.block.timestamp.toI32() / SECONDS_PER_HOUR;
//   // Create unique id for the day
//   const hourId = Bytes.fromI32(hour);
//   let poolMetrics = LiquidityPoolHourlySnapshot.load(hourId);

//   if (!poolMetrics) {
//     poolMetrics = new LiquidityPoolHourlySnapshot(hourId);
//     poolMetrics.hours = hour;
//     poolMetrics.protocol = getOrCreateProtocol().id;
//     const pool = getOrCreateLiquidityPool(event);
//     poolMetrics.pool = pool.id;

//     poolMetrics.totalValueLockedUSD = pool.totalValueLockedUSD;

//     poolMetrics.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD;
//     poolMetrics.cumulativeSupplySideRevenueUSD =
//       pool.cumulativeSupplySideRevenueUSD;
//     poolMetrics.cumulativeProtocolSideRevenueUSD =
//       pool.cumulativeProtocolSideRevenueUSD;
//     poolMetrics.hourlyTotalRevenueUSD = BIGDECIMAL_ZERO;
//     poolMetrics.hourlySupplySideRevenueUSD = BIGDECIMAL_ZERO;
//     poolMetrics.hourlyProtocolSideRevenueUSD = BIGDECIMAL_ZERO;

//     poolMetrics.hourlyFundingrate = [];
//     poolMetrics.hourlyEntryPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeEntryPremiumUSD = pool.cumulativeEntryPremiumUSD;
//     poolMetrics.hourlyExitPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeExitPremiumUSD = pool.cumulativeExitPremiumUSD;
//     poolMetrics.hourlyTotalPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeTotalPremiumUSD = pool.cumulativeTotalPremiumUSD;
//     poolMetrics.hourlyDepositPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeDepositPremiumUSD = pool.cumulativeDepositPremiumUSD;
//     poolMetrics.hourlyWithdrawPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeWithdrawPremiumUSD =
//       pool.cumulativeWithdrawPremiumUSD;
//     poolMetrics.hourlyTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;
//     poolMetrics.cumulativeTotalLiquidityPremiumUSD =
//       pool.cumulativeTotalLiquidityPremiumUSD;

//     poolMetrics.hourlyVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.hourlyVolumeByTokenAmount = [];
//     poolMetrics.hourlyVolumeByTokenUSD = [];
//     poolMetrics.cumulativeVolumeUSD = pool.cumulativeVolumeUSD;
//     poolMetrics.hourlyInflowVolumeByTokenAmount = [];
//     poolMetrics.hourlyInflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeInflowVolumeUSD = pool._cumulativeInflowVolumeUSD;
//     poolMetrics.hourlyClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.hourlyClosedInflowVolumeByTokenAmount = [];
//     poolMetrics.hourlyClosedInflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeClosedInflowVolumeUSD =
//       pool._cumulativeClosedInflowVolumeUSD;
//     poolMetrics.hourlyOutflowVolumeUSD = BIGDECIMAL_ZERO;
//     poolMetrics.hourlyOutflowVolumeByTokenAmount = [];
//     poolMetrics.hourlyOutflowVolumeByTokenUSD = [];
//     poolMetrics.cumulativeOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD;

//     poolMetrics.inputTokenBalances = pool.inputTokenBalances;
//     poolMetrics.inputTokenWeights = pool.inputTokenWeights;
//     poolMetrics.outputTokenSupply = pool.outputTokenSupply;
//     poolMetrics.outputTokenPriceUSD = pool.outputTokenPriceUSD;
//     poolMetrics.stakedOutputTokenAmount = pool.stakedOutputTokenAmount;
//     poolMetrics.rewardTokenEmissionsAmount = pool.rewardTokenEmissionsAmount;
//     poolMetrics.rewardTokenEmissionsUSD = pool.rewardTokenEmissionsUSD;

//     poolMetrics.save();
//   }

//   return poolMetrics;
// }

export function updateLiquidityPoolDailySnapshot(
  pool: LiquidityPool,
  day: i32
): void {
  const id = pool.id.concatI32(day);

  // log.error(
  //   "update daily pool snapshot at day {} while _lastSnapshotDayID is {} ",
  //   [day.toString(), pool._lastSnapshotDayID.toString()]
  // );

  if (LiquidityPoolDailySnapshot.load(id)) {
    return;
  }
  const poolMetrics = new LiquidityPoolDailySnapshot(id);
  const prevPoolMetrics = LiquidityPoolDailySnapshot.load(
    pool.id.concatI32(pool._lastSnapshotDayID)
  );

  let prevCumulativeVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;

  let prevCumulativeEntryPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeExitPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeDepositPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeWithdrawPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;

  let prevCumulativeInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeOutflowVolumeUSD = BIGDECIMAL_ZERO;

  let prevCumulativeUniqueBorrowers = INT_ZERO;
  let prevCumulativeUniqueLiquidators = INT_ZERO;
  let prevCumulativeUniqueLiquidatees = INT_ZERO;

  let prevLongPositionCount = INT_ZERO;
  let prevShortPositionCount = INT_ZERO;
  let prevOpenPositionCount = INT_ZERO;
  let prevClosedPositionCount = INT_ZERO;
  let prevCumulativePositionCount = INT_ZERO;
  let prevCumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;

  if (prevPoolMetrics != null) {
    prevCumulativeVolumeUSD = prevPoolMetrics.cumulativeVolumeUSD;
    prevCumulativeSupplySideRevenueUSD =
      prevPoolMetrics.cumulativeSupplySideRevenueUSD;
    prevCumulativeProtocolSideRevenueUSD =
      prevPoolMetrics.cumulativeProtocolSideRevenueUSD;
    prevCumulativeTotalRevenueUSD = prevPoolMetrics.cumulativeTotalRevenueUSD;

    prevCumulativeEntryPremiumUSD = prevPoolMetrics.cumulativeEntryPremiumUSD;
    prevCumulativeExitPremiumUSD = prevPoolMetrics.cumulativeExitPremiumUSD;
    prevCumulativeTotalPremiumUSD = prevPoolMetrics.cumulativeTotalPremiumUSD;
    prevCumulativeDepositPremiumUSD =
      prevPoolMetrics.cumulativeDepositPremiumUSD;
    prevCumulativeWithdrawPremiumUSD =
      prevPoolMetrics.cumulativeWithdrawPremiumUSD;
    prevCumulativeTotalLiquidityPremiumUSD =
      prevPoolMetrics.cumulativeTotalLiquidityPremiumUSD;

    prevCumulativeInflowVolumeUSD = prevPoolMetrics.cumulativeInflowVolumeUSD;
    prevCumulativeClosedInflowVolumeUSD =
      prevPoolMetrics.cumulativeClosedInflowVolumeUSD;
    prevCumulativeOutflowVolumeUSD = prevPoolMetrics.cumulativeOutflowVolumeUSD;

    prevLongPositionCount = prevPoolMetrics.longPositionCount;
    prevShortPositionCount = prevPoolMetrics.shortPositionCount;
    prevOpenPositionCount = prevPoolMetrics.openPositionCount;
    prevClosedPositionCount = prevPoolMetrics.closedPositionCount;
    prevCumulativePositionCount = prevPoolMetrics.cumulativePositionCount;
  } else if (pool._lastSnapshotDayID > INT_ZERO) {
    log.error(
      "Missing daily pool snapshot at ID that has been snapped: Pool {}, ID {} ",
      [pool.id.toHexString(), pool._lastSnapshotDayID.toString()]
    );
  }

  poolMetrics.days = day;
  poolMetrics.protocol = pool.protocol;
  poolMetrics.pool = pool.id;

  poolMetrics.totalValueLockedUSD = pool.totalValueLockedUSD;
  poolMetrics.dailyOpenInterestUSD = pool.openInterestUSD;

  poolMetrics.cumulativeSupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD;
  poolMetrics.dailySupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD.minus(
      prevCumulativeSupplySideRevenueUSD
    );
  poolMetrics.cumulativeProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD;
  poolMetrics.dailyProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD.minus(
      prevCumulativeProtocolSideRevenueUSD
    );
  poolMetrics.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD;
  poolMetrics.dailyTotalRevenueUSD = pool.cumulativeTotalRevenueUSD.minus(
    prevCumulativeTotalRevenueUSD
  );

  poolMetrics.dailyFundingrate = pool._fundingrate;
  poolMetrics.dailyEntryPremiumUSD = pool.cumulativeEntryPremiumUSD.minus(
    prevCumulativeEntryPremiumUSD
  );
  poolMetrics.cumulativeEntryPremiumUSD = pool.cumulativeEntryPremiumUSD;
  poolMetrics.dailyExitPremiumUSD = pool.cumulativeExitPremiumUSD.minus(
    prevCumulativeExitPremiumUSD
  );
  poolMetrics.cumulativeExitPremiumUSD = pool.cumulativeExitPremiumUSD;
  poolMetrics.dailyTotalPremiumUSD = pool.cumulativeTotalPremiumUSD.minus(
    prevCumulativeTotalPremiumUSD
  );
  poolMetrics.cumulativeTotalPremiumUSD = pool.cumulativeTotalPremiumUSD;
  poolMetrics.dailyDepositPremiumUSD = pool.cumulativeDepositPremiumUSD.minus(
    prevCumulativeDepositPremiumUSD
  );
  poolMetrics.cumulativeDepositPremiumUSD = pool.cumulativeDepositPremiumUSD;
  poolMetrics.dailyWithdrawPremiumUSD = pool.cumulativeWithdrawPremiumUSD.minus(
    prevCumulativeWithdrawPremiumUSD
  );
  poolMetrics.cumulativeWithdrawPremiumUSD = pool.cumulativeWithdrawPremiumUSD;
  poolMetrics.dailyTotalLiquidityPremiumUSD =
    pool.cumulativeTotalLiquidityPremiumUSD.minus(
      prevCumulativeTotalLiquidityPremiumUSD
    );
  poolMetrics.cumulativeTotalLiquidityPremiumUSD =
    pool.cumulativeTotalLiquidityPremiumUSD;

  poolMetrics.dailyVolumeUSD = pool.cumulativeVolumeUSD.minus(
    prevCumulativeVolumeUSD
  );
  poolMetrics.dailyVolumeByTokenAmount = [];
  poolMetrics.dailyVolumeByTokenUSD = [];
  poolMetrics.cumulativeVolumeUSD = pool.cumulativeVolumeUSD;
  poolMetrics.dailyInflowVolumeUSD = pool._cumulativeInflowVolumeUSD.minus(
    prevCumulativeInflowVolumeUSD
  );
  poolMetrics.dailyInflowVolumeByTokenAmount = [];
  poolMetrics.dailyInflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeInflowVolumeUSD = pool._cumulativeInflowVolumeUSD;
  poolMetrics.dailyClosedInflowVolumeUSD =
    pool._cumulativeClosedInflowVolumeUSD.minus(
      prevCumulativeClosedInflowVolumeUSD
    );
  poolMetrics.dailyClosedInflowVolumeByTokenAmount = [];
  poolMetrics.dailyClosedInflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeClosedInflowVolumeUSD =
    pool._cumulativeClosedInflowVolumeUSD;
  poolMetrics.dailyOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD.minus(
    prevCumulativeOutflowVolumeUSD
  );
  poolMetrics.dailyOutflowVolumeByTokenAmount = [];
  poolMetrics.dailyOutflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD;

  poolMetrics.dailyActiveBorrowers =
    pool.cumulativeUniqueBorrowers - prevCumulativeUniqueBorrowers;
  poolMetrics.cumulativeUniqueBorrowers = pool.cumulativeUniqueBorrowers;
  poolMetrics.dailyActiveLiquidators =
    pool.cumulativeUniqueLiquidators - prevCumulativeUniqueLiquidators;
  poolMetrics.cumulativeUniqueLiquidators = pool.cumulativeUniqueLiquidators;
  poolMetrics.dailyActiveLiquidatees =
    pool.cumulativeUniqueLiquidatees - prevCumulativeUniqueLiquidatees;
  poolMetrics.cumulativeUniqueLiquidatees = pool.cumulativeUniqueLiquidatees;

  poolMetrics.dailylongPositionCount =
    pool.longPositionCount - prevLongPositionCount >= 0
      ? pool.longPositionCount - prevLongPositionCount
      : INT_ZERO;
  poolMetrics.longPositionCount = pool.longPositionCount;
  poolMetrics.dailyshortPositionCount =
    pool.shortPositionCount - prevShortPositionCount >= 0
      ? pool.shortPositionCount - prevShortPositionCount
      : INT_ZERO;
  poolMetrics.shortPositionCount = pool.shortPositionCount;
  poolMetrics.dailyopenPositionCount =
    pool.openPositionCount - prevOpenPositionCount >= 0
      ? pool.openPositionCount - prevOpenPositionCount
      : INT_ZERO;
  poolMetrics.openPositionCount = pool.openPositionCount;
  poolMetrics.dailyclosedPositionCount =
    pool.closedPositionCount - prevClosedPositionCount >= 0
      ? pool.closedPositionCount - prevClosedPositionCount
      : INT_ZERO;
  poolMetrics.closedPositionCount = pool.closedPositionCount;
  poolMetrics.dailycumulativePositionCount =
    pool.cumulativePositionCount - prevCumulativePositionCount >= 0
      ? pool.cumulativePositionCount - prevCumulativePositionCount
      : INT_ZERO;
  poolMetrics.cumulativePositionCount = pool.cumulativePositionCount;

  poolMetrics.inputTokenBalances = pool.inputTokenBalances;
  poolMetrics.inputTokenWeights = pool.inputTokenWeights;
  poolMetrics.outputTokenSupply = pool.outputTokenSupply;
  poolMetrics.outputTokenPriceUSD = pool.outputTokenPriceUSD;
  poolMetrics.stakedOutputTokenAmount = pool.stakedOutputTokenAmount;
  poolMetrics.rewardTokenEmissionsAmount = pool.rewardTokenEmissionsAmount;
  poolMetrics.rewardTokenEmissionsUSD = pool.rewardTokenEmissionsUSD;

  poolMetrics.save();
}

export function updateLiquidityPoolHourlySnapshot(
  pool: LiquidityPool,
  hour: i32
): void {
  const id = pool.id.concatI32(hour);
  // log.error(
  //   "update hourly pool snapshot at ID {} while _lastSnapshotHourID is {} ",
  //   [hour.toString(), pool._lastSnapshotHourID.toString()]
  // );

  if (LiquidityPoolHourlySnapshot.load(id)) {
    return;
  }
  const poolMetrics = new LiquidityPoolHourlySnapshot(id);
  const prevPoolMetrics = LiquidityPoolHourlySnapshot.load(
    pool.id.concatI32(pool._lastSnapshotHourID)
  );

  let prevCumulativeVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeSupplySideRevenueUSD = BIGDECIMAL_ZERO;
  let prevCumulativeProtocolSideRevenueUSD = BIGDECIMAL_ZERO;

  let prevCumulativeEntryPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeExitPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeDepositPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeWithdrawPremiumUSD = BIGDECIMAL_ZERO;
  let prevCumulativeTotalLiquidityPremiumUSD = BIGDECIMAL_ZERO;

  let prevCumulativeInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeClosedInflowVolumeUSD = BIGDECIMAL_ZERO;
  let prevCumulativeOutflowVolumeUSD = BIGDECIMAL_ZERO;

  let prevCumulativeTotalRevenueUSD = BIGDECIMAL_ZERO;

  if (prevPoolMetrics != null) {
    prevCumulativeVolumeUSD = prevPoolMetrics.cumulativeVolumeUSD;
    prevCumulativeSupplySideRevenueUSD =
      prevPoolMetrics.cumulativeSupplySideRevenueUSD;
    prevCumulativeProtocolSideRevenueUSD =
      prevPoolMetrics.cumulativeProtocolSideRevenueUSD;
    prevCumulativeTotalRevenueUSD = prevPoolMetrics.cumulativeTotalRevenueUSD;

    prevCumulativeEntryPremiumUSD = prevPoolMetrics.cumulativeEntryPremiumUSD;
    prevCumulativeExitPremiumUSD = prevPoolMetrics.cumulativeExitPremiumUSD;
    prevCumulativeTotalPremiumUSD = prevPoolMetrics.cumulativeTotalPremiumUSD;
    prevCumulativeDepositPremiumUSD =
      prevPoolMetrics.cumulativeDepositPremiumUSD;
    prevCumulativeWithdrawPremiumUSD =
      prevPoolMetrics.cumulativeWithdrawPremiumUSD;
    prevCumulativeTotalLiquidityPremiumUSD =
      prevPoolMetrics.cumulativeTotalLiquidityPremiumUSD;

    prevCumulativeInflowVolumeUSD = prevPoolMetrics.cumulativeInflowVolumeUSD;
    prevCumulativeClosedInflowVolumeUSD =
      prevPoolMetrics.cumulativeClosedInflowVolumeUSD;
    prevCumulativeOutflowVolumeUSD = prevPoolMetrics.cumulativeOutflowVolumeUSD;
  } else if (pool._lastSnapshotHourID > INT_ZERO) {
    log.error(
      "Missing hourly pool snapshot at ID that has been snapped: Pool {}, ID {} ",
      [pool.id.toHexString(), pool._lastSnapshotHourID.toString()]
    );
  }

  poolMetrics.hours = hour;
  poolMetrics.protocol = pool.protocol;
  poolMetrics.pool = pool.id;

  poolMetrics.totalValueLockedUSD = pool.totalValueLockedUSD;
  poolMetrics.hourlyOpenInterestUSD = pool.openInterestUSD;

  poolMetrics.cumulativeSupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD;
  poolMetrics.hourlySupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD.minus(
      prevCumulativeSupplySideRevenueUSD
    );
  poolMetrics.cumulativeProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD;
  poolMetrics.hourlyProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD.minus(
      prevCumulativeProtocolSideRevenueUSD
    );
  poolMetrics.cumulativeTotalRevenueUSD = pool.cumulativeTotalRevenueUSD;
  poolMetrics.hourlyTotalRevenueUSD = pool.cumulativeTotalRevenueUSD.minus(
    prevCumulativeTotalRevenueUSD
  );

  poolMetrics.hourlyFundingrate = pool._fundingrate;
  poolMetrics.hourlyEntryPremiumUSD = pool.cumulativeEntryPremiumUSD.minus(
    prevCumulativeEntryPremiumUSD
  );
  poolMetrics.cumulativeEntryPremiumUSD = pool.cumulativeEntryPremiumUSD;
  poolMetrics.hourlyExitPremiumUSD = pool.cumulativeExitPremiumUSD.minus(
    prevCumulativeExitPremiumUSD
  );
  poolMetrics.cumulativeExitPremiumUSD = pool.cumulativeExitPremiumUSD;
  poolMetrics.hourlyTotalPremiumUSD = pool.cumulativeTotalPremiumUSD.minus(
    prevCumulativeTotalPremiumUSD
  );
  poolMetrics.cumulativeTotalPremiumUSD = pool.cumulativeTotalPremiumUSD;
  poolMetrics.hourlyDepositPremiumUSD = pool.cumulativeDepositPremiumUSD.minus(
    prevCumulativeDepositPremiumUSD
  );
  poolMetrics.cumulativeDepositPremiumUSD = pool.cumulativeDepositPremiumUSD;
  poolMetrics.hourlyWithdrawPremiumUSD =
    pool.cumulativeWithdrawPremiumUSD.minus(prevCumulativeWithdrawPremiumUSD);
  poolMetrics.cumulativeWithdrawPremiumUSD = pool.cumulativeWithdrawPremiumUSD;
  poolMetrics.hourlyTotalLiquidityPremiumUSD =
    pool.cumulativeTotalLiquidityPremiumUSD.minus(
      prevCumulativeTotalLiquidityPremiumUSD
    );
  poolMetrics.cumulativeTotalLiquidityPremiumUSD =
    pool.cumulativeTotalLiquidityPremiumUSD;

  poolMetrics.hourlyVolumeUSD = pool.cumulativeVolumeUSD.minus(
    prevCumulativeVolumeUSD
  );
  poolMetrics.hourlyVolumeByTokenAmount = [];
  poolMetrics.hourlyVolumeByTokenUSD = [];
  poolMetrics.cumulativeVolumeUSD = pool.cumulativeVolumeUSD;
  poolMetrics.hourlyInflowVolumeUSD = pool._cumulativeInflowVolumeUSD.minus(
    prevCumulativeInflowVolumeUSD
  );
  poolMetrics.hourlyInflowVolumeByTokenAmount = [];
  poolMetrics.hourlyInflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeInflowVolumeUSD = pool._cumulativeInflowVolumeUSD;
  poolMetrics.hourlyClosedInflowVolumeUSD =
    pool._cumulativeClosedInflowVolumeUSD.minus(
      prevCumulativeClosedInflowVolumeUSD
    );
  poolMetrics.hourlyClosedInflowVolumeByTokenAmount = [];
  poolMetrics.hourlyClosedInflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeClosedInflowVolumeUSD =
    pool._cumulativeClosedInflowVolumeUSD;
  poolMetrics.hourlyOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD.minus(
    prevCumulativeOutflowVolumeUSD
  );
  poolMetrics.hourlyOutflowVolumeByTokenAmount = [];
  poolMetrics.hourlyOutflowVolumeByTokenUSD = [];
  poolMetrics.cumulativeOutflowVolumeUSD = pool._cumulativeOutflowVolumeUSD;

  poolMetrics.inputTokenBalances = pool.inputTokenBalances;
  poolMetrics.inputTokenWeights = pool.inputTokenWeights;
  poolMetrics.outputTokenSupply = pool.outputTokenSupply;
  poolMetrics.outputTokenPriceUSD = pool.outputTokenPriceUSD;
  poolMetrics.stakedOutputTokenAmount = pool.stakedOutputTokenAmount;
  poolMetrics.rewardTokenEmissionsAmount = pool.rewardTokenEmissionsAmount;
  poolMetrics.rewardTokenEmissionsUSD = pool.rewardTokenEmissionsUSD;

  poolMetrics.save();
}

export function increasePoolVolume(
  event: ethereum.Event,
  pool: LiquidityPool,
  amountUSD: BigDecimal,
  eventType: EventType
): void {
  switch (eventType) {
    case EventType.CollateralIn:
      pool._cumulativeInflowVolumeUSD =
        pool._cumulativeInflowVolumeUSD.plus(amountUSD);
      break;
    case EventType.CollateralOut:
      pool._cumulativeOutflowVolumeUSD =
        pool._cumulativeOutflowVolumeUSD.plus(amountUSD);
      break;
    case EventType.ClosePosition:
      pool._cumulativeClosedInflowVolumeUSD =
        pool._cumulativeClosedInflowVolumeUSD.plus(amountUSD);
      break;

    default:
      break;
  }
  pool.cumulativeVolumeUSD = pool.cumulativeVolumeUSD.plus(amountUSD);
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  increaseProtocolVolume(event, amountUSD, eventType);
}

export function increasePoolPremium(
  event: ethereum.Event,
  pool: LiquidityPool,
  amountUSD: BigDecimal,
  eventType: EventType
): void {
  switch (eventType) {
    case EventType.Deposit:
      pool.cumulativeDepositPremiumUSD =
        pool.cumulativeDepositPremiumUSD.plus(amountUSD);
      pool.cumulativeTotalLiquidityPremiumUSD =
        pool.cumulativeTotalLiquidityPremiumUSD.plus(amountUSD);
      break;
    case EventType.Withdraw:
      pool.cumulativeWithdrawPremiumUSD =
        pool.cumulativeWithdrawPremiumUSD.plus(amountUSD);
      pool.cumulativeTotalLiquidityPremiumUSD =
        pool.cumulativeTotalLiquidityPremiumUSD.plus(amountUSD);
      break;
    case EventType.CollateralIn:
      pool.cumulativeEntryPremiumUSD =
        pool.cumulativeEntryPremiumUSD.plus(amountUSD);
      pool.cumulativeTotalPremiumUSD =
        pool.cumulativeTotalPremiumUSD.plus(amountUSD);
      break;
    case EventType.CollateralOut:
      pool.cumulativeExitPremiumUSD =
        pool.cumulativeExitPremiumUSD.plus(amountUSD);
      pool.cumulativeTotalPremiumUSD =
        pool.cumulativeTotalPremiumUSD.plus(amountUSD);
      break;

    default:
      break;
  }
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  increaseProtocolPremium(event, amountUSD, eventType);
}

export function incrementPoolOpenPositionCount(
  event: ethereum.Event,
  pool: LiquidityPool,
  positionSide: string
): void {
  if (PositionSide.LONG == positionSide) {
    pool.longPositionCount += INT_ONE;
  } else {
    pool.shortPositionCount += INT_ONE;
  }
  pool.openPositionCount += INT_ONE;

  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  incrementProtocolOpenPositionCount(event, positionSide);
}

export function decrementPoolOpenPositionCount(
  event: ethereum.Event,
  pool: LiquidityPool,
  positionSide: string
): void {
  if (PositionSide.LONG == positionSide) {
    pool.longPositionCount -= INT_ONE;
  } else {
    pool.shortPositionCount -= INT_ONE;
  }
  pool.openPositionCount -= INT_ONE;
  pool.closedPositionCount += INT_ONE;

  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  decrementProtocolOpenPositionCount(event, positionSide);
}

export function updatePoolOutputToken(
  event: ethereum.Event,
  pool: LiquidityPool,
  outputTokenAddress: Address
): void {
  pool.outputToken = getOrCreateToken(event, outputTokenAddress).id;
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();
}

export function updatePoolTvl(
  event: ethereum.Event,
  pool: LiquidityPool,
  aumUSD: BigDecimal,
  outputTokenSupply: BigInt
): void {
  const prevPoolTVL = pool.totalValueLockedUSD;
  pool.totalValueLockedUSD = aumUSD;
  const tvlChangeUSD = pool.totalValueLockedUSD.minus(prevPoolTVL);

  pool.outputTokenSupply = outputTokenSupply;

  const outputToken = getOrCreateToken(
    event,
    Address.fromBytes(pool.outputToken!)
  );
  if (outputTokenSupply == BIGINT_ZERO) {
    pool.outputTokenPriceUSD = BIGDECIMAL_ZERO;
  } else {
    pool.outputTokenPriceUSD = pool.totalValueLockedUSD.div(
      convertTokenToDecimal(outputTokenSupply, outputToken.decimals)
    );
  }
  pool.stakedOutputTokenAmount = pool.outputTokenSupply;

  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  updateTokenPrice(event, outputToken, pool.outputTokenPriceUSD!);

  // Protocol
  updateProtocolTVL(event, tvlChangeUSD);
}

export function updatePoolOpenInterestUSD(
  event: ethereum.Event,
  pool: LiquidityPool,
  amountChangeUSD: BigDecimal
): void {
  pool.openInterestUSD = pool.openInterestUSD.plus(amountChangeUSD);
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  // Protocol
  updateProtocolOpenInterestUSD(event, amountChangeUSD);
}

export function updatePoolInputTokenBalance(
  event: ethereum.Event,
  inputToken: Token,
  inputTokenAmount: BigInt
): void {
  const pool = getOrCreateLiquidityPool(event);

  let inputTokens = pool.inputTokens;
  let inputTokenBalances = pool.inputTokenBalances;

  const inputTokenIndex = inputTokens.indexOf(inputToken.id);
  if (inputTokenIndex >= 0) {
    inputTokenBalances[inputTokenIndex] =
      inputTokenBalances[inputTokenIndex].plus(inputTokenAmount);
  } else {
    let inputTokenWeights = pool.inputTokenWeights;
    let fundingrates = pool._fundingrate;
    let tmpInputTokenBalances = new Array<BigInt>(inputTokens.length).fill(
      BIGINT_ZERO
    );

    inputTokens.push(inputToken.id);
    inputTokenBalances.push(inputTokenAmount);
    fundingrates.push(BIGDECIMAL_ZERO);
    inputTokenWeights.push(BIGDECIMAL_ZERO);

    multiArraySort(inputTokens, inputTokenBalances, fundingrates);

    const vaultContract = Vault.bind(event.address);
    for (let i = 0; i < inputTokens.length; i++) {
      const tryTokenWeights = vaultContract.try_tokenWeights(
        Address.fromBytes(inputTokens[i])
      );
      if (tryTokenWeights.reverted) {
        inputTokenWeights[i] = BIGDECIMAL_ZERO;
      } else {
        inputTokenWeights[i] =
          tryTokenWeights.value.divDecimal(BIGDECIMAL_THOUSAND);
      }
    }

    pool._fundingrate = fundingrates;
    pool.inputTokenWeights = inputTokenWeights;
  }

  pool.inputTokens = inputTokens;
  pool.inputTokenBalances = inputTokenBalances;

  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();
}

export function updatePoolRewardToken(
  event: ethereum.Event,
  rewardToken: RewardToken,
  tokensPerDay: BigInt,
  tokensPerDayUSD: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  let rewardTokens = pool.rewardTokens!;
  let rewardTokenEmissionsAmount = pool.rewardTokenEmissionsAmount!;
  let rewardTokenEmissionsUSD = pool.rewardTokenEmissionsUSD!;

  const rewardTokenIndex = rewardTokens.indexOf(rewardToken.id);
  if (rewardTokenIndex >= 0) {
    rewardTokenEmissionsAmount[rewardTokenIndex] =
      rewardTokenEmissionsAmount[rewardTokenIndex].plus(tokensPerDay);
    rewardTokenEmissionsUSD[rewardTokenIndex] =
      rewardTokenEmissionsUSD[rewardTokenIndex].plus(tokensPerDayUSD);
  } else {
    rewardTokens.push(rewardToken.id);
    rewardTokenEmissionsAmount.push(tokensPerDay);
    rewardTokenEmissionsUSD.push(tokensPerDayUSD);

    multiArraySort(
      rewardTokens,
      rewardTokenEmissionsAmount,
      rewardTokenEmissionsUSD
    );
  }
  pool.rewardTokens = rewardTokens;
  pool.rewardTokenEmissionsAmount = rewardTokenEmissionsAmount;
  pool.rewardTokenEmissionsUSD = rewardTokenEmissionsUSD;

  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();
}

export function updatePoolFundingRate(
  event: ethereum.Event,
  fundingToken: Token,
  fundingrate: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  let fundingTokens = pool.inputTokens;
  let fundingrates = pool._fundingrate;
  const fundingTokenIndex = fundingTokens.indexOf(fundingToken.id);
  if (fundingTokenIndex >= 0) {
    fundingrates[fundingTokenIndex] = fundingrate;
  }
  pool._fundingrate = fundingrates;
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();
}

export function increasePoolTotalRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  pool.cumulativeTotalRevenueUSD =
    pool.cumulativeTotalRevenueUSD.plus(amountChangeUSD);
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  // Protocol
  increaseProtocolTotalRevenue(event, amountChangeUSD);
}

export function increasePoolProtocolSideRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  pool.cumulativeProtocolSideRevenueUSD =
    pool.cumulativeProtocolSideRevenueUSD.plus(amountChangeUSD);
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  // Protocol
  increaseProtocolSideRevenue(event, amountChangeUSD);
}

export function increasePoolSupplySideRevenue(
  event: ethereum.Event,
  amountChangeUSD: BigDecimal
): void {
  const pool = getOrCreateLiquidityPool(event);
  pool.cumulativeSupplySideRevenueUSD =
    pool.cumulativeSupplySideRevenueUSD.plus(amountChangeUSD);
  pool._lastUpdateTimestamp = event.block.timestamp;
  pool.save();

  // Protocol
  increaseProtocolSupplySideRevenue(event, amountChangeUSD);
}

export function updatePoolSnapshotDayID(
  event: ethereum.Event,
  snapshotDayID: i32
): void {
  const pool = getOrCreateLiquidityPool(event);
  pool._lastSnapshotDayID = snapshotDayID;
  pool.save();
}

export function updatePoolSnapshotHourID(
  event: ethereum.Event,
  snapshotHourID: i32
): void {
  const pool = getOrCreateLiquidityPool(event);
  pool._lastSnapshotHourID = snapshotHourID;
  pool.save();
}

function createPoolFees(poolAddress: Bytes): Bytes[] {
  // get or create fee entities, set fee types
  const tradingFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.FIXED_TRADING_FEE)
  ).concat(poolAddress);
  const tradingFee = getOrCreateLiquidityPoolFee(
    tradingFeeId,
    LiquidityPoolFeeType.FIXED_TRADING_FEE
  );

  const protocolFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.FIXED_PROTOCOL_FEE)
  ).concat(poolAddress);
  const protocolFee = getOrCreateLiquidityPoolFee(
    protocolFeeId,
    LiquidityPoolFeeType.FIXED_PROTOCOL_FEE
  );

  const lpFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.FIXED_LP_FEE)
  ).concat(poolAddress);
  const lpFee = getOrCreateLiquidityPoolFee(
    lpFeeId,
    LiquidityPoolFeeType.FIXED_LP_FEE
  );

  const stakeFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.FIXED_STAKE_FEE)
  ).concat(poolAddress);
  const stakeFee = getOrCreateLiquidityPoolFee(
    stakeFeeId,
    LiquidityPoolFeeType.FIXED_STAKE_FEE
  );

  const depositFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.DEPOSIT_FEE)
  ).concat(poolAddress);
  const depositFee = getOrCreateLiquidityPoolFee(
    depositFeeId,
    LiquidityPoolFeeType.DEPOSIT_FEE
  );

  const withdrawalFeeId = Bytes.fromUTF8(
    enumToPrefix(LiquidityPoolFeeType.WITHDRAWAL_FEE)
  ).concat(poolAddress);
  const withdrawalFee = getOrCreateLiquidityPoolFee(
    withdrawalFeeId,
    LiquidityPoolFeeType.WITHDRAWAL_FEE
  );

  return [
    tradingFee.id,
    protocolFee.id,
    lpFee.id,
    stakeFee.id,
    depositFee.id,
    withdrawalFee.id,
  ];
}

function getOrCreateLiquidityPoolFee(
  feeId: Bytes,
  feeType: string,
  feePercentage: BigDecimal = BIGDECIMAL_ZERO
): LiquidityPoolFee {
  let fees = LiquidityPoolFee.load(feeId);

  if (!fees) {
    fees = new LiquidityPoolFee(feeId);

    fees.feeType = feeType;
    fees.feePercentage = feePercentage;

    fees.save();
  }

  if (feePercentage.notEqual(BIGDECIMAL_ZERO)) {
    fees.feePercentage = feePercentage;
    fees.save();
  }

  return fees;
}
