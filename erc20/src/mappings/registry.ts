import {
  Address,
  JSONValue,
  Value,
  log,
  ipfs,
  BigInt,
  BigDecimal,
} from "@graphprotocol/graph-ts";

import { Token } from "../../generated/schema";
import { ERC20 } from "../../generated/TokenRegistry/ERC20";
import { Unknown as UnknownEvent } from "../../generated/TokenRegistry/TokenRegistry";

import {
  BurnableToken,
  MintableToken,
  StandardToken,
} from "../../generated/templates";

import {
  DEFAULT_DECIMALS,
  BIGINT_ZERO,
  BIGDECIMAL_ZERO,
  ERC20_TOKENS_2017,
  ERC20_TOKENS_2022,
} from "../common/constants";

export function toDecimal(value: BigInt, decimals: u32): BigDecimal {
  let precision = BigInt.fromI32(10)
    .pow(<u8>decimals)
    .toBigDecimal();

  return value.divDecimal(precision);
}

export function initTokenList(event: UnknownEvent): void {
  log.debug("Initializing token registry, block={}", [
    event.block.number.toString(),
  ]);

  let erc20Tokens = ERC20_TOKENS_2022;
  let len = erc20Tokens.length;
  if (len > 0) {
    for (var i = 0; i < len; i++) {
      let contractAddress = Address.fromString(erc20Tokens[i]);

      // Persist token data if it didn't exist
      let token = Token.load(contractAddress.toHex());
      if (token == null) {
        token = new Token(contractAddress.toHex());
        token.name = "";
        token.symbol = "";
        token.decimals = DEFAULT_DECIMALS;

        token.currentHolderCount = BIGINT_ZERO;
        token.cumulativeHolderCount = BIGINT_ZERO;
        token.transferCount = BIGINT_ZERO;
        token.mintCount = BIGINT_ZERO;
        token.burnCount = BIGINT_ZERO;
        token.totalSupply = BIGDECIMAL_ZERO;
        token.totalMinted = BIGDECIMAL_ZERO;
        token.totalBurned = BIGDECIMAL_ZERO;
        token.lastMintTransactionHash = "";
        token.lastBurnTransactionHash = "";

        log.debug("Adding token to registry with address: {}", [token.id]);

        token.save();

        // Start indexing token events
        StandardToken.create(contractAddress);
        BurnableToken.create(contractAddress);
        MintableToken.create(contractAddress);
      }
    }
  }
}
