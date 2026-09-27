import type { Factor } from '../kb/types';
import { scoreRisk } from './score';
import { kbWith } from './test-kb';

const claimsLow: Factor = {
  id: 'previous_claims_low', description: '1–2 previous claims', points: 15, perOccurrence: true,
  condition: { field: 'previousClaims', operator: 'between', min: 1, max: 2 },
};
const claimsHigh: Factor = {
  id: 'previous_claims_high', description: '3 or more previous claims', points: 30, perOccurrence: true,
  condition: { field: 'previousClaims', operator: 'gte', value: 3 },
};
const flatHighValue: Factor = {
  id: 'flat_high_value', description: 'Flat AND property value over £500,000', points: 35,
  condition: { all: [{ field: 'propertyType', operator: 'eq', value: 'Flat' }, { field: 'propertyValue', operator: 'gt', value: 500000 }] },
};

describe('scoreRisk', () => {
  // perOccurrence = points × the field's value (specs/mission.md).
  test.each<[number, number, string[]]>([
    [0, 0, []],
    [1, 15, ['previous_claims_low']],   // 15 × 1
    [2, 30, ['previous_claims_low']],   // 15 × 2
    [3, 90, ['previous_claims_high']],  // 30 × 3
    [5, 150, ['previous_claims_high']], // 30 × 5
  ])('%i claims score %i', (previousClaims, score, ids) => {
    const result = scoreRisk({ previousClaims }, kbWith({ factors: [claimsLow, claimsHigh] }));
    expect(result.score).toBe(score);
    expect(result.appliedFactors.map((f) => f.id)).toEqual(ids);
  });

  it('reports awarded points and occurrences per factor', () => {
    const { appliedFactors } = scoreRisk({ previousClaims: 2 }, kbWith({ factors: [claimsLow] }));
    expect(appliedFactors).toEqual([{ id: 'previous_claims_low', description: '1–2 previous claims', points: 30, occurrences: 2 }]);
  });

  test.each<[string, number, number]>([
    ['Flat', 600000, 35],
    ['Flat', 500000, 0],   // not over £500k
    ['House', 900000, 0],  // not a Flat
  ])('compound "Flat AND > £500k": %s at %i scores %i', (propertyType, propertyValue, score) => {
    expect(scoreRisk({ propertyType, propertyValue }, kbWith({ factors: [flatHighValue] })).score).toBe(score);
  });

  it('skips a disabled factor', () => {
    const kb = kbWith({ factors: [{ ...claimsLow, enabled: false }] });
    expect(scoreRisk({ previousClaims: 2 }, kb)).toEqual({ score: 0, appliedFactors: [] });
  });

  it('sums every matching factor', () => {
    const kb = kbWith({ factors: [claimsLow, flatHighValue] });
    expect(scoreRisk({ previousClaims: 1, propertyType: 'Flat', propertyValue: 750000 }, kb).score).toBe(50); // 15 + 35
  });
});
