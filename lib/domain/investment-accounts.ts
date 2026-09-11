export const strategyTypes = [
  "SWING",
  "GROWTH_5_7",
  "RETIREMENT",
  "CHILD_GROWTH",
  "COLLEGE",
  "AGGRESSIVE_GROWTH",
  "DIVIDEND_INCOME",
  "HOUSE_FUND",
  "CAPITAL_PRESERVATION",
  "CUSTOM",
] as const;

export const shareModes = ["WHOLE", "FRACTIONAL"] as const;
export const riskProfiles = ["CONSERVATIVE", "BALANCED", "GROWTH", "AGGRESSIVE"] as const;

export type StrategyType = (typeof strategyTypes)[number];
export type ShareMode = (typeof shareModes)[number];
export type RiskProfile = (typeof riskProfiles)[number];

export type InvestmentAccountSettingsInput = {
  strategyType: StrategyType;
  shareMode: ShareMode;
  benchmarkSymbol: string | null;
  goalName: string;
  horizonMonths: number | null;
  riskProfile: RiskProfile;
  maximumPositionBps: number;
  maximumRiskBps: number;
  availableCashCents: bigint;
  policy: Record<string, unknown>;
};

export function parseInvestmentAccountSettings(value: Record<string, unknown>): InvestmentAccountSettingsInput {
  const strategyType = String(value.strategyType || "").toUpperCase() as StrategyType;
  const shareMode = String(value.shareMode || "WHOLE").toUpperCase() as ShareMode;
  const riskProfile = String(value.riskProfile || "BALANCED").toUpperCase() as RiskProfile;
  const benchmark = value.benchmarkSymbol == null ? null : String(value.benchmarkSymbol).trim().toUpperCase();
  const goalName = String(value.goalName || "").trim();
  const horizonMonths = value.horizonMonths == null || value.horizonMonths === "" ? null : Number(value.horizonMonths);
  const maximumPositionBps = Number(value.maximumPositionBps ?? 1000);
  const maximumRiskBps = Number(value.maximumRiskBps ?? 50);
  const availableCashCents = BigInt(String(value.availableCashCents ?? 0));
  const policy = value.policy && typeof value.policy === "object" && !Array.isArray(value.policy)
    ? value.policy as Record<string, unknown>
    : {};

  if (!strategyTypes.includes(strategyType)) throw new Error("Invalid investment strategy");
  if (!shareModes.includes(shareMode)) throw new Error("Invalid share mode");
  if (!riskProfiles.includes(riskProfile)) throw new Error("Invalid risk profile");
  if (!goalName || goalName.length > 120) throw new Error("Goal name is required and must be 120 characters or fewer");
  if (benchmark && !/^[A-Z0-9.-]{1,12}$/.test(benchmark)) throw new Error("Invalid benchmark symbol");
  if (horizonMonths !== null && (!Number.isInteger(horizonMonths) || horizonMonths < 1 || horizonMonths > 1200)) throw new Error("Invalid investment horizon");
  if (!Number.isInteger(maximumPositionBps) || maximumPositionBps < 0 || maximumPositionBps > 10000) throw new Error("Invalid maximum position limit");
  if (!Number.isInteger(maximumRiskBps) || maximumRiskBps < 0 || maximumRiskBps > 10000) throw new Error("Invalid maximum risk limit");
  if (availableCashCents < 0n) throw new Error("Available cash cannot be negative");

  return { strategyType, shareMode, benchmarkSymbol: benchmark, goalName, horizonMonths, riskProfile, maximumPositionBps, maximumRiskBps, availableCashCents, policy };
}

