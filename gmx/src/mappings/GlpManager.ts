import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  GlpManager,
} from "../../generated/GlpManager/GlpManager";
import { incrementProtocolEventCount } from "../entities/protocol";
import {
  getOrCreateLiquidityPool,
  updatePoolTvl,
  updatePoolOutputToken,
} from "../entities/pool";
import { createDeposit, createWithdraw, EventType } from "../entities/event";
import {
  getOrCreateAccount,
  incrementAccountEventCount,
} from "../entities/account";
import { updateTempUsageMetrics } from "../entities/usage";
import { updateSnapshots } from "../entities/snapshot";
import { convertTokenToDecimal } from "../utils/numbers";
import { DEFAULT_DECIMALS, INT_ZERO } from "../utils/constants";

export function handleAddLiquidity(event: AddLiquidity): void {
  handleUpdateLiquidityEvent(
    event,
    event.params.account,
    event.params.token,
    event.params.amount,
    event.params.usdgAmount,
    event.params.mintAmount,
    event.params.glpSupply,
    event.params.aumInUsdg,
    EventType.Deposit
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleUpdateLiquidityEvent(
    event,
    event.params.account,
    event.params.token,
    event.params.amountOut,
    event.params.usdgAmount,
    event.params.glpAmount,
    event.params.glpSupply,
    event.params.aumInUsdg,
    EventType.Withdraw
  );
}

function handleUpdateLiquidityEvent(
  event: ethereum.Event,
  accountAddress: Address,
  inputTokenAddress: Address,
  inputTokenAmount: BigInt,
  usdgAmount: BigInt,
  glpAmount: BigInt,
  glpSupply: BigInt,
  aumInUsdg: BigInt,
  eventType: EventType
): void {
  updateSnapshots(event);

  const account = getOrCreateAccount(event, accountAddress);
  const pool = getOrCreateLiquidityPool(event);

  if (eventType == EventType.Deposit) {
    if (!pool.outputToken) {
      const glpManagerContract = GlpManager.bind(event.address);
      const tryGlp = glpManagerContract.try_glp();
      if (!tryGlp.reverted) {
        updatePoolOutputToken(event, pool, tryGlp.value);
      }
    }

    createDeposit(
      event,
      accountAddress,
      inputTokenAddress,
      inputTokenAmount,
      convertTokenToDecimal(usdgAmount, DEFAULT_DECIMALS),
      glpAmount
    );
  } else {
    createWithdraw(
      event,
      accountAddress,
      inputTokenAddress,
      inputTokenAmount,
      convertTokenToDecimal(usdgAmount, DEFAULT_DECIMALS),
      glpAmount
    );
  }

  incrementAccountEventCount(event, account, eventType);
  incrementProtocolEventCount(event, eventType);

  updatePoolTvl(
    event,
    pool,
    convertTokenToDecimal(aumInUsdg, DEFAULT_DECIMALS),
    glpSupply
  );

  updateTempUsageMetrics(event, accountAddress, eventType, INT_ZERO, null);
}
