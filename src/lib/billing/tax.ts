/**
 * Pure billing/tax helpers shared by the server (authoritative) and the
 * checkout UI (display only). All money is integer paise; rates are
 * percentages with up to two decimals and are converted to basis points
 * before any arithmetic, so no floating-point value ever reaches a total.
 *
 * This module intentionally has no imports so it can be unit-tested with
 * `node --test` directly.
 */

export type IndianState = { code: string; name: string; gstCode: string };

/** States and union territories. `code` is the canonical value stored in the database. */
export const INDIAN_STATES: readonly IndianState[] = [
  { code: "AN", name: "Andaman and Nicobar Islands", gstCode: "35" },
  { code: "AP", name: "Andhra Pradesh", gstCode: "37" },
  { code: "AR", name: "Arunachal Pradesh", gstCode: "12" },
  { code: "AS", name: "Assam", gstCode: "18" },
  { code: "BR", name: "Bihar", gstCode: "10" },
  { code: "CH", name: "Chandigarh", gstCode: "04" },
  { code: "CG", name: "Chhattisgarh", gstCode: "22" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu", gstCode: "26" },
  { code: "DL", name: "Delhi", gstCode: "07" },
  { code: "GA", name: "Goa", gstCode: "30" },
  { code: "GJ", name: "Gujarat", gstCode: "24" },
  { code: "HR", name: "Haryana", gstCode: "06" },
  { code: "HP", name: "Himachal Pradesh", gstCode: "02" },
  { code: "JK", name: "Jammu and Kashmir", gstCode: "01" },
  { code: "JH", name: "Jharkhand", gstCode: "20" },
  { code: "KA", name: "Karnataka", gstCode: "29" },
  { code: "KL", name: "Kerala", gstCode: "32" },
  { code: "LA", name: "Ladakh", gstCode: "38" },
  { code: "LD", name: "Lakshadweep", gstCode: "31" },
  { code: "MP", name: "Madhya Pradesh", gstCode: "23" },
  { code: "MH", name: "Maharashtra", gstCode: "27" },
  { code: "MN", name: "Manipur", gstCode: "14" },
  { code: "ML", name: "Meghalaya", gstCode: "17" },
  { code: "MZ", name: "Mizoram", gstCode: "15" },
  { code: "NL", name: "Nagaland", gstCode: "13" },
  { code: "OD", name: "Odisha", gstCode: "21" },
  { code: "PY", name: "Puducherry", gstCode: "34" },
  { code: "PB", name: "Punjab", gstCode: "03" },
  { code: "RJ", name: "Rajasthan", gstCode: "08" },
  { code: "SK", name: "Sikkim", gstCode: "11" },
  { code: "TN", name: "Tamil Nadu", gstCode: "33" },
  { code: "TG", name: "Telangana", gstCode: "36" },
  { code: "TR", name: "Tripura", gstCode: "16" },
  { code: "UP", name: "Uttar Pradesh", gstCode: "09" },
  { code: "UK", name: "Uttarakhand", gstCode: "05" },
  { code: "WB", name: "West Bengal", gstCode: "19" },
];

export const COUNTRIES = [{ code: "IN", name: "India" }] as const;

function squash(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const STATE_ALIASES: Record<string, string> = {
  ORISSA: "OD",
  OR: "OD",
  CT: "CG",
  CHATTISGARH: "CG",
  CHHATISGARH: "CG",
  UT: "UK",
  UTTARANCHAL: "UK",
  TS: "TG",
  PONDICHERRY: "PY",
  "NEW DELHI": "DL",
  "NCT OF DELHI": "DL",
  "DELHI NCT": "DL",
  "NATIONAL CAPITAL TERRITORY OF DELHI": "DL",
  TAMILNADU: "TN",
  "J AND K": "JK",
  JAMMU: "JK",
  "ANDAMAN AND NICOBAR": "AN",
  "ANDAMAN NICOBAR": "AN",
  DN: "DH",
  DD: "DH",
  "DADRA AND NAGAR HAVELI": "DH",
  "DAMAN AND DIU": "DH",
};

const STATE_LOOKUP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const state of INDIAN_STATES) {
    map.set(state.code, state.code);
    map.set(squash(state.name), state.code);
    map.set(squash(state.name).replace(/ /g, ""), state.code);
  }
  for (const [alias, code] of Object.entries(STATE_ALIASES)) map.set(squash(alias), code);
  return map;
})();

/** Maps "Haryana", "HR", " haryana ", "Orissa" … to a canonical code, or null if unknown. */
export function normalizeStateCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = squash(input);
  if (!key) return null;
  return STATE_LOOKUP.get(key) ?? STATE_LOOKUP.get(key.replace(/ /g, "")) ?? null;
}

export function stateName(code: string | null | undefined): string {
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code ?? "";
}

// ---------------------------------------------------------------------------
// GSTIN
// ---------------------------------------------------------------------------

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Validates the GSTIN structure and its mod-36 check character. */
export function isValidGstin(value: string): boolean {
  const gstin = normalizeGstin(value);
  if (!GSTIN_PATTERN.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARSET.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const check = GSTIN_CHARSET[(36 - (sum % 36)) % 36];
  return check === gstin[14];
}

/** State code (canonical) that a GSTIN is registered in, if recognised. */
export function gstinStateCode(value: string): string | null {
  const prefix = normalizeGstin(value).slice(0, 2);
  return INDIAN_STATES.find((s) => s.gstCode === prefix)?.code ?? null;
}

// ---------------------------------------------------------------------------
// Tax calculation
// ---------------------------------------------------------------------------

export type TaxType = "intra_state" | "inter_state";

export type TaxConfig = {
  /** Total GST rate in percent, e.g. 18. Split equally into CGST/SGST for intra-state supply. */
  gstRate: number;
  /** Seller's state code; a matching customer state is taxed as intra-state. */
  homeStateCode: string;
  otherTaxName: string;
  /** Percent, e.g. 4. Zero disables the line. */
  otherTaxRate: number;
};

export type TaxBreakdown = {
  baseAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxType: TaxType;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  otherTaxName: string;
  otherTaxRate: number;
  otherTaxAmount: number;
  totalTax: number;
  totalAmount: number;
};

/** Percent (max two decimals) → integer basis points. */
export function toBasisPoints(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("Tax rates must be between 0 and 100 percent.");
  }
  return Math.round(percent * 100);
}

/** round-half-up(amount × bps / divisor) using integer arithmetic only. */
function applyRate(amount: number, bps: number, divisor: number): number {
  return Math.floor((amount * bps * 2 + divisor) / (divisor * 2));
}

export function calculateTax(input: {
  baseAmount: number;
  discountAmount?: number;
  stateCode: string;
  config: TaxConfig;
}): TaxBreakdown {
  const { baseAmount, config } = input;
  const discountAmount = input.discountAmount ?? 0;
  if (!Number.isSafeInteger(baseAmount) || baseAmount < 0) throw new Error("Base amount must be a whole number of paise.");
  if (!Number.isSafeInteger(discountAmount) || discountAmount < 0 || discountAmount > baseAmount) {
    throw new Error("Invalid discount amount.");
  }
  const stateCode = normalizeStateCode(input.stateCode);
  const homeStateCode = normalizeStateCode(config.homeStateCode);
  if (!stateCode) throw new Error("A valid billing state is required to calculate tax.");
  if (!homeStateCode) throw new Error("The seller state for tax calculation is not configured.");

  const gstBps = toBasisPoints(config.gstRate);
  const otherBps = toBasisPoints(config.otherTaxRate);
  const taxableAmount = baseAmount - discountAmount;
  const taxType: TaxType = stateCode === homeStateCode ? "intra_state" : "inter_state";

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (taxType === "intra_state") {
    // Each half is rounded independently so CGST and SGST are always equal.
    cgstAmount = applyRate(taxableAmount, gstBps, 20_000);
    sgstAmount = cgstAmount;
  } else {
    igstAmount = applyRate(taxableAmount, gstBps, 10_000);
  }
  const otherTaxAmount = applyRate(taxableAmount, otherBps, 10_000);
  const totalTax = cgstAmount + sgstAmount + igstAmount + otherTaxAmount;

  return {
    baseAmount,
    discountAmount,
    taxableAmount,
    taxType,
    gstRate: gstBps / 100,
    cgstRate: taxType === "intra_state" ? gstBps / 200 : 0,
    sgstRate: taxType === "intra_state" ? gstBps / 200 : 0,
    igstRate: taxType === "inter_state" ? gstBps / 100 : 0,
    cgstAmount,
    sgstAmount,
    igstAmount,
    otherTaxName: config.otherTaxName,
    otherTaxRate: otherBps / 100,
    otherTaxAmount,
    totalTax,
    totalAmount: taxableAmount + totalTax,
  };
}

/** "9", "4.5", "18" — trims trailing zeros for labels such as "CGST 9%". */
export function formatRate(rate: number): string {
  return String(Math.round(rate * 100) / 100);
}
