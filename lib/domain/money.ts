const decimalPattern = /^-?\d+(?:\.\d+)?$/;

export function dollarsToCents(value: string): bigint {
  const normalized = value.trim().replaceAll(",", "");
  if (!decimalPattern.test(normalized)) throw new Error("Invalid dollar amount");
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ""] = unsigned.split(".");
  const rounded = BigInt((fraction + "00").slice(0, 2));
  const cents = BigInt(whole) * 100n + rounded;
  return negative ? -cents : cents;
}

export function centsToDollars(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function calculateWholeSharePosition(input: {
  accountValueCents: bigint;
  availableCashCents: bigint;
  maximumRiskBps: bigint;
  entryCents: bigint;
  stopCents: bigint;
  remainingAllocationCents: bigint;
}) {
  if (input.accountValueCents < 0n || input.availableCashCents < 0n) throw new Error("Account values cannot be negative");
  if (input.maximumRiskBps <= 0n || input.maximumRiskBps > 10_000n) throw new Error("Invalid maximum risk");
  if (input.entryCents <= 0n || input.stopCents <= 0n || input.stopCents >= input.entryCents) throw new Error("A long-position stop must be below entry");

  const maximumLossCents = (input.accountValueCents * input.maximumRiskBps) / 10_000n;
  const riskPerShareCents = input.entryCents - input.stopCents;
  const riskLimitedShares = maximumLossCents / riskPerShareCents;
  const cashLimit = input.availableCashCents / input.entryCents;
  const allocationLimit = input.remainingAllocationCents > 0n
    ? input.remainingAllocationCents / input.entryCents
    : 0n;
  const shares = [riskLimitedShares, cashLimit, allocationLimit].reduce((smallest, value) => value < smallest ? value : smallest);

  return {
    shares,
    exposureCents: shares * input.entryCents,
    maximumPlannedLossCents: shares * riskPerShareCents,
    bindingConstraint: shares === allocationLimit
      ? "ALLOCATION"
      : shares === cashLimit
        ? "CASH"
        : "RISK",
  } as const;
}

