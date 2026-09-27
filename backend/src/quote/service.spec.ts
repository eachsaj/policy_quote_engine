import { kbWith } from '../engine/test-kb';
import type { Factor } from '../kb/types';
import type { QuoteRequest } from './request';
import { getQuote } from './service';

const claims: Factor = {
  id: 'claims', description: 'Per claim', points: 15, perOccurrence: true,
  condition: { field: 'previousClaims', operator: 'gte', value: 1 },
};
const kb = kbWith({ version: '9.9.9', factors: [claims], coverage: { items: [{ id: 'buildings', description: 'Buildings cover' }] } });
const request: QuoteRequest = {
  customerName: 'A Customer', age: 40, propertyType: 'House', propertyValue: 250000, postcode: 'SW1A 1AA', previousClaims: 0,
};

describe('getQuote', () => {
  // Hand-computed from the test KB: basePremium 300, load 1.2, multipliers 1.0 / 1.5 / 2.2.
  test.each<[number, number, string, number, number]>([
    [0, 0, 'STANDARD', 360, 30],    // 300 × 1.0 × 1.2 = 360; / 12 = 30
    [2, 30, 'ELEVATED', 540, 45],   // 15 × 2 = 30; 300 × 1.5 × 1.2 = 540; / 12 = 45
    [5, 75, 'HIGH_RISK', 792, 66],  // 15 × 5 = 75; 300 × 2.2 × 1.2 = 792; / 12 = 66
  ])('%i claims → score %i, %s, £%d a year, £%d a month', (previousClaims, score, band, annual, monthly) => {
    const quote = getQuote({ ...request, previousClaims }, kb);
    expect(quote).toMatchObject({ riskScore: score, riskBand: band, annualPremium: annual, monthlyPremium: monthly });
  });

  it('rounds only at the boundary, to pence', () => {
    const odd = kbWith({ basePremium: 100, coverageLoadFactor: 1.1 });
    expect(getQuote(request, odd)).toMatchObject({ annualPremium: 110, monthlyPremium: 9.17 }); // 110 / 12 = 9.1666…
  });

  it('fills the summary template, carries the label, version, coverage and breakdown', () => {
    const quote = getQuote({ ...request, previousClaims: 2 }, kb);
    expect(quote.riskSummary).toBe('ELEVATED: 30');
    expect(quote.riskBandLabel).toBe('ELEVATED');
    expect(quote.kbVersion).toBe('9.9.9');
    expect(quote.coverageDetails).toEqual({
      basePremium: 300, riskMultiplier: 1.5, coverageLoadFactor: 1.2, sumInsured: 250000,
      items: [{ id: 'buildings', description: 'Buildings cover' }],
    });
  });

  it('never scores customerName, even if a KB bypassed the loader check', () => {
    const byName: Factor = { id: 'by_name', description: 'x', points: 50, condition: { field: 'customerName', operator: 'eq', value: 'A Customer' } };
    // The loader rejects this factor (loader.spec); build the KB directly to prove the service also strips the field.
    expect(getQuote(request, { ...kbWith({}), factors: [byName] }).riskScore).toBe(0);
  });
});
