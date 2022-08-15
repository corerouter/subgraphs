import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'


// Constants
export const REGISTRY_HASH = "Qme8SzDxviNBjEJTTKtkm5Q4RNrNv9RFekWTXgLydcQXLb" // data/tokens.json
export const DEFAULT_DECIMALS = 18
export const SECONDS_PER_DAY = 60 * 60 * 24
export const SECONDS_PER_HOUR = 60 * 60

export const GENESIS_ADDRESS = '0x0000000000000000000000000000000000000000'

export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGDECIMAL_ZERO = new BigDecimal(BIGINT_ZERO);
export const BIGDECIMAL_ONE = new BigDecimal(BIGINT_ONE);

// Flags
export const DETAILED_TOKEN = 1 << 0
export const BURN_EVENT = 1 << 1
export const MINT_EVENT = 1 << 2
export const BURN_TRANSFER = 1 << 3
export const MINT_TRANSFER = 1 << 4
export const PAUSABLE_TOKEN = 1 << 5
