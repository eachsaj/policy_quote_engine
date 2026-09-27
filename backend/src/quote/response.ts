import type { AppliedFactor } from '../engine/score';
import type { Currency } from './market';

export type { AppliedFactor };

/** How the premium was built, so the UI can show the formula's inputs next to the result. */
export interface CoverageDetails {
  readonly basePremium: number;        // from the KB
  readonly riskMultiplier: number;     // from the matched band
  readonly coverageLoadFactor: number; // from the KB
  readonly sumInsured: number;         // the request's propertyValue
  readonly items: ReadonlyArray<{ readonly id: string; readonly description: string }>;
}

/** The brief's response fields, plus `currency` (from the postcode's market), `riskBandLabel` (badge wording from the KB) and `kbVersion` (bonus). */
export interface QuoteResponse {
  readonly monthlyPremium: number;
  readonly annualPremium: number;
  readonly currency: Currency; // GBP for a UK postcode, EUR for an Eircode; amounts are not converted
  readonly riskBand: string;
  readonly riskBandLabel: string;
  readonly riskScore: number;
  readonly riskSummary: string;
  readonly coverageDetails: CoverageDetails;
  readonly appliedFactors: readonly AppliedFactor[];
  readonly kbVersion: string;
}
