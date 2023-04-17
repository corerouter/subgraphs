import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  AddRewardInfo,
  ComplexRewarderPerSec,
} from "../../generated/ComplexRewarderPerSec/ComplexRewarderPerSec";
import { getOrCreateToken, getOrCreateRewardToken } from "../entities/token";
import { updatePoolRewardToken } from "../entities/pool";
import { takeSnapshots } from "../entities/snapshots";
import { convertTokenToDecimal } from "../utils/numbers";
import {
  ESVELA_ADDRESS,
  SECONDS_PER_DAY,
  VELA_ADDRESS,
} from "../utils/constants";

export function handleAddRewardInfo(event: AddRewardInfo): void {
  takeSnapshots(event);

  const complexRewarderPerSecContract = ComplexRewarderPerSec.bind(
    event.address
  );
  const tryRewardToken = complexRewarderPerSecContract.try_rewardToken();
  if (tryRewardToken.reverted) {
    return;
  }
  const rewardTokenAddress = tryRewardToken.value;

  // Based on the emissions rate for the pool, calculate the rewards per day for the pool.
  const tokensPerDay = event.params.rewardPerSec.times(
    BigInt.fromI32(SECONDS_PER_DAY)
  );
  const rewardToken = getOrCreateRewardToken(event, rewardTokenAddress);
  const token = getOrCreateToken(event, rewardTokenAddress);
  const tokensPerDayUSD = convertTokenToDecimal(
    tokensPerDay,
    token.decimals
  ).times(token.lastPriceUSD!);
  // Reward token of $esVELA can be deposited into the vesting contract in order to claim
  // the same amount of $VELA which is unlocked continuously throughout a 6 months linear vesting period.
  // $esVELA has no price data. As a result, here we use $VELA token price as its approximation.
  // if (rewardTokenAddress == Address.fromString(ESVELA_ADDRESS)) {
  //   log.warning("rewardTokenAddress == Address.fromString(ESVELA_ADDRESS)", []);
  //   const velaToken = getOrCreateToken(event, Address.fromString(VELA_ADDRESS));
  //   tokensPerDayUSD = convertTokenToDecimal(
  //     tokensPerDay,
  //     velaToken.decimals
  //   ).times(velaToken.lastPriceUSD!);
  // }

  updatePoolRewardToken(event, rewardToken, tokensPerDay, tokensPerDayUSD);
}
