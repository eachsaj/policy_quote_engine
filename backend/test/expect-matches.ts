import type { QuoteResponse } from '../src/quote/response';
import type { Expectation } from './scenario-schema';

/** Shared by the scenario and configurability runners. A plain module, so no spec's tests register twice. */
export const expectMatches = (res: QuoteResponse, e: Expectation): void => {
  expect(res.riskScore).toBe(e.riskScore);
  expect(res.appliedFactors.map((f) => f.id).sort()).toEqual([...e.appliedFactorIds].sort());
  if (e.riskBand !== undefined) expect(res.riskBand).toBe(e.riskBand);
  if (e.annualPremium !== undefined) expect(res.annualPremium).toBeCloseTo(e.annualPremium, 2);
  if (e.monthlyPremium !== undefined) expect(res.monthlyPremium).toBeCloseTo(e.monthlyPremium, 2);
  if (e.currency !== undefined) expect(res.currency).toBe(e.currency);
  Object.entries(e.descriptions ?? {}).forEach(([id, text]) =>
    expect(res.appliedFactors.find((f) => f.id === id)?.description).toBe(text));
};
