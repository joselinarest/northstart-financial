export const recommendationActions = [
  "STRONG_BUY",
  "BUY",
  "BUY_PARTIAL",
  "ACCUMULATE",
  "HOLD",
  "WAIT",
  "WATCH",
  "TAKE_PARTIAL_PROFIT",
  "REDUCE",
  "SELL",
  "EXIT",
  "THESIS_REVIEW",
  "THESIS_BROKEN",
  "EVENT_RISK",
] as const;

export type RecommendationAction = (typeof recommendationActions)[number];
export type EvidenceState = "PASS" | "FAIL" | "MISSING" | "STALE";
export type RecommendationLifecycle =
  | "MONITORING"
  | "TRIGGERED"
  | "EXPIRED"
  | "CANCELLED"
  | "INVALIDATED"
  | "COMPLETED"
  | "MISSED";

export const requiredEvidenceKeys = [
  "companyQuality",
  "valuation",
  "technicalConfirmation",
  "newsAndEvents",
  "portfolioFit",
  "householdCapacity",
  "risk",
  "marketFreshness",
] as const;

export type RequiredEvidenceKey = (typeof requiredEvidenceKeys)[number];
export type RecommendationEvidence = Record<RequiredEvidenceKey, EvidenceState>;

export type RecommendationDecision = {
  accountId: string;
  symbol: string;
  action: RecommendationAction;
  suggestedQuantity: string;
  shareMode: "WHOLE" | "FRACTIONAL";
  entryRange: { low: number; high: number } | null;
  idealPrice: number | null;
  invalidation: number | null;
  targets: number[];
  confidence: number;
  reason: string;
  requiredChecks: RecommendationEvidence;
  actionable: boolean;
  evidenceAsOf: string;
  expiresAt: string;
  lifecycle: RecommendationLifecycle;
};

const actionableActions = new Set<RecommendationAction>([
  "STRONG_BUY",
  "BUY",
  "BUY_PARTIAL",
  "ACCUMULATE",
  "TAKE_PARTIAL_PROFIT",
  "REDUCE",
  "SELL",
  "EXIT",
]);

export function evaluateReadiness(
  action: RecommendationAction,
  evidence: RecommendationEvidence,
) {
  const blockers = requiredEvidenceKeys.filter((key) => evidence[key] !== "PASS");
  const actionable = actionableActions.has(action) && blockers.length === 0;
  const displayState = actionable
    ? "READY_TO_PREPARE"
    : blockers.some((key) => evidence[key] === "FAIL")
      ? "REJECT"
      : "WAIT_OR_MONITOR";

  return { actionable, blockers, displayState } as const;
}

export function createRecommendation(
  input: Omit<RecommendationDecision, "actionable">,
): RecommendationDecision {
  if (!input.accountId.trim()) throw new Error("Recommendation accountId is required");
  if (!/^[A-Z0-9.-]{1,12}$/.test(input.symbol)) throw new Error("Invalid recommendation symbol");
  if (!recommendationActions.includes(input.action)) throw new Error("Invalid recommendation action");
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 100) {
    throw new Error("Recommendation confidence must be between 0 and 100");
  }
  if (!input.reason.trim()) throw new Error("Recommendation reason is required");
  if (!Number.isFinite(Date.parse(input.evidenceAsOf))) throw new Error("Invalid evidence timestamp");
  if (!Number.isFinite(Date.parse(input.expiresAt))) throw new Error("Invalid expiration timestamp");

  const readiness = evaluateReadiness(input.action, input.requiredChecks);
  return { ...input, actionable: readiness.actionable };
}

