import type { AppliedFactor } from '../engine/score';

export type { AppliedFactor };

export interface CoverageDetails {
  readonly basePremium: number;
  readonly riskMultiplier: number;
  readonly coverageLoadFactor: number;
  readonly sumInsured: number;
  readonly items: ReadonlyArray<{ readonly id: string; readonly description: string }>;
}

/** The brief's response fields, plus `riskBandLabel` (badge wording from the KB) and `kbVersion` (bonus). */
export interface QuoteResponse {
  readonly monthlyPremium: number;
  readonly annualPremium: number;
  readonly riskBand: string;
  readonly riskBandLabel: string;
  readonly riskScore: number;
  readonly riskSummary: string;
  readonly coverageDetails: CoverageDetails;
  readonly appliedFactors: readonly AppliedFactor[];
  readonly kbVersion: string;
}
