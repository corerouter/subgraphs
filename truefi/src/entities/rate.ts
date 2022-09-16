import { BigDecimal } from "@graphprotocol/graph-ts";
import { InterestRate } from "../../generated/schema";
import { InterestRateSide, InterestRateType } from "../utils/constants";

export function createBorrowerStableRate(
  marketId: string,
  interestRate: BigDecimal,
  timestamp: string
): InterestRate {
  const rate = new InterestRate(
    `${InterestRateSide.BORROWER}-${InterestRateType.STABLE}-${marketId}-${timestamp}`
  );
  rate.rate = interestRate;
  rate.side = InterestRateSide.BORROWER;
  rate.type = InterestRateType.STABLE;
  rate.save();
  return rate;
}
