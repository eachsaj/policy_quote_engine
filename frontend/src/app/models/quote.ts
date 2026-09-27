// Generated from the backend contract (see AGENT_LOG): backend/src/quote/request.ts (Zod schema), quote/market.ts,
// backend/src/quote/response.ts and backend/src/engine/score.ts (AppliedFactor), backend/src/handler.ts (error bodies).
// Keep in step with those files; change both in the same turn.

/** Exactly the backend's `propertyTypes` enum, which is the brief's form options. */
export const propertyTypes = ['House', 'Flat', 'Bungalow'] as const;
export type PropertyType = (typeof propertyTypes)[number];

/** Mirrors backend/src/quote/market.ts: the postcode's format picks the market, and the market the currency. */
export type Currency = 'GBP' | 'EUR';
export const markets: readonly { readonly pattern: RegExp; readonly currency: Currency }[] = [
  { pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, currency: 'GBP' },               // UK postcode, e.g. SW1A 1AA
  { pattern: /^[ACDEFHKNPRTVWXY]\d[\dW] ?[\dACDEFHKNPRTVWXY]{4}$/i, currency: 'EUR' }, // Irish Eircode, e.g. D02 X285
];
export const currencyOf = (postcode: string): Currency | undefined =>
  markets.find((m) => m.pattern.test(postcode.trim()))?.currency;

/** Mirrors `z.infer<typeof quoteRequestSchema>`: the brief's six form fields. */
export interface QuoteRequest {
  readonly customerName: string;  // 1–100 chars after trim; never scored
  readonly age: number;           // integer 18–120
  readonly propertyType: PropertyType;
  readonly propertyValue: number; // > 0, in the postcode's currency (£ or €, no conversion)
  readonly postcode: string;      // UK postcode or Irish Eircode; the backend upper-cases it
  readonly previousClaims: number; // integer 0–20, in the last 5 years
}

export interface AppliedFactor {
  readonly id: string;
  readonly description: string; // KB wording, shown verbatim
  readonly points: number;      // awarded, after perOccurrence
  readonly occurrences: number;
}

export interface CoverageDetails {
  readonly basePremium: number;
  readonly riskMultiplier: number;
  readonly coverageLoadFactor: number;
  readonly sumInsured: number;
  readonly items: readonly { readonly id: string; readonly description: string }[];
}

export interface QuoteResponse {
  readonly monthlyPremium: number;
  readonly annualPremium: number;
  readonly currency: Currency;    // GBP for a UK postcode, EUR for an Eircode
  readonly riskBand: string;      // KB band id; a string, not a union, so a new KB band needs no frontend change
  readonly riskBandLabel: string; // KB badge wording
  readonly riskScore: number;
  readonly riskSummary: string;   // KB summary template, filled by the backend
  readonly coverageDetails: CoverageDetails;
  readonly appliedFactors: readonly AppliedFactor[];
  readonly kbVersion: string;
}

/** Error bodies from handler.ts: 400 `{ error, issues? }`, 404 `{ error }`, 500 `{ error, requestId }`. */
export interface ApiIssue {
  readonly field: string;
  readonly message: string;
}
