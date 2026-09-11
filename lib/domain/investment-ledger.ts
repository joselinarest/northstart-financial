export const investmentTransactionTypes = [
  "BUY",
  "SELL",
  "DIVIDEND",
  "DEPOSIT",
  "WITHDRAWAL",
  "INTEREST",
  "FEE",
  "TRANSFER",
  "SPLIT",
] as const;

export type InvestmentTransactionType = (typeof investmentTransactionTypes)[number];
export const quantityScale = 100_000_000n;

export function parseQuantity(value: unknown): bigint {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,8})?$/.test(text)) throw new Error("Quantity must be a positive number with at most 8 decimals");
  const [whole, decimal = ""] = text.split(".");
  const scaled = BigInt(whole) * quantityScale + BigInt((decimal + "00000000").slice(0, 8));
  if (scaled <= 0n) throw new Error("Quantity must be greater than zero");
  return scaled;
}

export function formatQuantity(value: bigint): string {
  const whole = value / quantityScale;
  const fraction = String(value % quantityScale).padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

export function quantityPriceAmount(quantity: bigint, priceCents: bigint): bigint {
  if (quantity <= 0n || priceCents < 0n) throw new Error("Invalid quantity or price");
  return (quantity * priceCents + quantityScale / 2n) / quantityScale;
}

export function requireWholeShares(quantity: bigint, shareMode: "WHOLE" | "FRACTIONAL") {
  if (shareMode === "WHOLE" && quantity % quantityScale !== 0n) throw new Error("This account accepts whole shares only");
}

export function parseInvestmentTransaction(value: Record<string, unknown>, shareMode: "WHOLE" | "FRACTIONAL") {
  const transactionType = String(value.transactionType || "").toUpperCase() as InvestmentTransactionType;
  if (!investmentTransactionTypes.includes(transactionType)) throw new Error("Invalid investment transaction type");
  const securityRequired = ["BUY", "SELL", "DIVIDEND", "SPLIT"].includes(transactionType);
  const quantityRequired = ["BUY", "SELL"].includes(transactionType);
  const priceRequired = ["BUY", "SELL"].includes(transactionType);
  const symbol = String(value.symbol || "").trim().toUpperCase();
  if (securityRequired && !/^[A-Z0-9.-]{1,12}$/.test(symbol)) throw new Error("A valid symbol is required");
  const quantity = quantityRequired ? parseQuantity(value.quantity) : null;
  if (quantity) requireWholeShares(quantity, shareMode);
  const priceCents = priceRequired ? BigInt(String(value.priceCents ?? "")) : value.priceCents == null ? null : BigInt(String(value.priceCents));
  if (priceRequired && (priceCents == null || priceCents <= 0n)) throw new Error("A positive price is required");
  const feeCents = BigInt(String(value.feeCents ?? 0));
  if (feeCents < 0n) throw new Error("Fees cannot be negative");
  const calculatedAmount = quantity && priceCents ? quantityPriceAmount(quantity, priceCents) : null;
  const amountCents = calculatedAmount ?? BigInt(String(value.amountCents ?? 0));
  if (!["SPLIT"].includes(transactionType) && amountCents <= 0n) throw new Error("A positive amount is required");
  const tradeAt = new Date(String(value.tradeAt || new Date().toISOString()));
  if (!Number.isFinite(tradeAt.getTime())) throw new Error("Invalid transaction date");
  const splitNumerator = transactionType === "SPLIT" ? parseQuantity(value.splitNumerator) : null;
  const splitDenominator = transactionType === "SPLIT" ? parseQuantity(value.splitDenominator) : null;

  return {
    transactionType,
    symbol: securityRequired ? symbol : null,
    securityName: String(value.securityName || symbol).trim().slice(0, 160),
    quantity,
    quantityText: quantity ? formatQuantity(quantity) : null,
    priceCents,
    amountCents,
    feeCents,
    tradeAt: tradeAt.toISOString(),
    settleAt: value.settleAt ? new Date(String(value.settleAt)).toISOString() : null,
    transferAccountId: value.transferAccountId ? String(value.transferAccountId) : null,
    splitNumerator: splitNumerator ? formatQuantity(splitNumerator) : null,
    splitDenominator: splitDenominator ? formatQuantity(splitDenominator) : null,
    notes: value.notes ? String(value.notes).trim().slice(0, 1000) : null,
  };
}
