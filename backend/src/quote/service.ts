import { findBand } from '../engine/band';
import { scoreRisk } from '../engine/score';
import { interpolate } from '../engine/template';
import type { LoadedKb } from '../kb/types';
import { unscoredFields, type QuoteRequest } from './request';
import type { QuoteResponse } from './response';
import type { SummaryToken } from './summary-tokens';

// Calendar and currency facts, not scoring values: they never belong in the KB.
const MONTHS_PER_YEAR = 12;
const CENTS_PER_EURO = 100;
const toEuros = (n: number): number => Math.round(n * CENTS_PER_EURO) / CENTS_PER_EURO;

/**
 * Prices a validated request against the KB. The one place the brief's formula lives:
 * annualPremium = basePremium × riskMultiplier × coverageLoadFactor. Pure: no I/O, no clock.
 */
export const getQuote = (request: QuoteRequest, kb: LoadedKb): QuoteResponse => {
  const riskInput = Object.fromEntries(Object.entries(request).filter(([field]) => !unscoredFields.has(field))); // customerName never scored
  const { score, appliedFactors } = scoreRisk(riskInput, kb);
  const band = findBand(score, kb.orderedBands);
  const annual = kb.basePremium * band.riskMultiplier * kb.coverageLoadFactor;
  const summaryValues: Record<SummaryToken, string | number> = { score, factorCount: appliedFactors.length, label: band.label };

  return {
    monthlyPremium: toEuros(annual / MONTHS_PER_YEAR), // rounding happens only here, at the response boundary
    annualPremium: toEuros(annual),
    riskBand: band.id,
    riskBandLabel: band.label,
    riskScore: score,
    riskSummary: interpolate(band.summary, summaryValues),
    coverageDetails: {
      basePremium: kb.basePremium,
      riskMultiplier: band.riskMultiplier,
      coverageLoadFactor: kb.coverageLoadFactor,
      sumInsured: request.propertyValue,
      items: kb.coverage?.items ?? [],
    },
    appliedFactors,
    kbVersion: kb.version,
  };
};
