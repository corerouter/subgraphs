import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Token } from "../../generated/schema";
import { SimplePriceOracle } from "../../generated/ibALPACA/SimplePriceOracle";
import { getTokenById } from "./token";
import { getUsdPricePerToken } from "../prices/index";
import {
  BIGDECIMAL_ONE,
  BIGDECIMAL_ZERO,
  BIGINT_ZERO,
  BLOCKS_PER_HOUR_BSC,
  BUSD_ADDRESS_BSC,
  PRICE_LIB_START_BLOCK_BSC,
  SIMPLE_PRICE_ORACLE_BSC,
  WBNB_ADDRESS_BSC,
} from "../utils/constants";
import { bigIntToBigDecimal } from "../utils/numbers";
import { DEFAULT_DECIMALS } from "../prices/common/constants";

export function amountInUSD(
  amount: BigInt,
  token: Token,
  blockNumber: BigInt
): BigDecimal {
  if (amount == BIGINT_ZERO) {
    return BIGDECIMAL_ZERO;
  }

  if (token.underlyingAsset) {
    return amountInUSD(
      amount,
      getTokenById(token.underlyingAsset!),
      blockNumber
    );
  }

  return bigIntToBigDecimal(amount, token.decimals).times(
    getTokenPrice(token, blockNumber)
  );
}

export function getTokenPrice(token: Token, blockNumber: BigInt): BigDecimal {
  if (
    token.lastPriceBlockNumber !== null &&
    token.lastPriceBlockNumber != BIGINT_ZERO &&
    token.lastPriceBlockNumber!.plus(BLOCKS_PER_HOUR_BSC).gt(blockNumber)
  ) {
    return token.lastPriceUSD!;
  }

  let priceUSD = BIGDECIMAL_ZERO;
  if (PRICE_LIB_START_BLOCK_BSC.gt(blockNumber)) {
    if (token.id == BUSD_ADDRESS_BSC) {
      priceUSD = BIGDECIMAL_ONE;
    } else if (token.id == WBNB_ADDRESS_BSC) {
      const contract = SimplePriceOracle.bind(
        Address.fromString(SIMPLE_PRICE_ORACLE_BSC)
      );
      const tryGetPrice = contract.try_getPrice(
        Address.fromString(token.id),
        Address.fromString(BUSD_ADDRESS_BSC)
      );
      if (!tryGetPrice.reverted) {
        priceUSD = bigIntToBigDecimal(
          tryGetPrice.value.getPrice(),
          DEFAULT_DECIMALS.toI32()
        );
      }
    }
  } else {
    // Use external oracle to get price.
    let customPrice = getUsdPricePerToken(Address.fromString(token.id));
    priceUSD = customPrice.usdPrice.div(customPrice.decimalsBaseTen);
  }

  token.lastPriceUSD = priceUSD;
  token.lastPriceBlockNumber = blockNumber;
  token.save();
  return priceUSD;
}
