import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { KbValidationError, parseKb } from './loader';

const realKbPath = resolve(__dirname, '../../../risk-kb.json');
const realKbText = readFileSync(realKbPath, 'utf8');

/** A fresh, loosely typed copy of the real KB for each failure case (parsed from unknown, never `any`). */
const looseKb = z.looseObject({
  factors: z.array(z.record(z.string(), z.unknown())),
  riskBands: z.record(z.string(), z.record(z.string(), z.unknown())),
});
const realKb = () => looseKb.parse(JSON.parse(realKbText) as unknown);

const problemsOf = (kb: unknown): readonly string[] => {
  try {
    parseKb(typeof kb === 'string' ? kb : JSON.stringify(kb), 'test');
  } catch (err) {
    if (err instanceof KbValidationError) return err.problems;
    throw err;
  }
  throw new Error('expected the KB to be rejected');
};

describe('KB loader', () => {
  it('loads the real risk-kb.json with bands ordered by min', () => {
    const kb = parseKb(realKbText, realKbPath);
    expect(kb.version).toBe('1.0.0');
    expect(kb.orderedBands.map((b) => b.id)).toEqual(['STANDARD', 'ELEVATED', 'HIGH_RISK']);
    expect(kb.factors.map((f) => f.id)).toEqual([
      'age_young_elderly', 'previous_claims_low', 'previous_claims_high', 'property_type_flat', 'property_value_high',
    ]);
  });

  it('orders bands by min, not by key order', () => {
    const kb = realKb();
    kb.riskBands = Object.fromEntries(Object.entries(kb.riskBands).reverse());
    expect(parseKb(JSON.stringify(kb), 'test').orderedBands.map((b) => b.id)).toEqual(['STANDARD', 'ELEVATED', 'HIGH_RISK']);
  });

  // Each case breaks one rule; the message must name the offending path.
  test.each<[string, (kb: ReturnType<typeof realKb>) => unknown, string]>([
    ['1. invalid JSON', () => '{ "version": ', 'not valid JSON'],
    ['2. unsupported schemaVersion', (kb) => ({ ...kb, schemaVersion: 2 }), 'schemaVersion: 2 is not supported'],
    ['3. missing basePremium', ({ basePremium: _, ...kb }) => kb, 'basePremium:'],
    ['3. unknown operator', (kb) => { kb.factors[0] = { ...kb.factors[0], condition: { field: 'age', operator: 'regex', value: 1 } }; return kb; },
      'factors.0.condition.operator: unknown operator "regex"'],
    ['3. between without max', (kb) => { kb.factors[1] = { ...kb.factors[1], condition: { field: 'previousClaims', operator: 'between', min: 1 } }; return kb; },
      'factors.1.condition.max: between:'],
    ['3. bad operator nested in a compound', (kb) => {
      kb.factors.push({ id: 'flat_high_value', description: 'Flat AND over £500k', points: 35,
        condition: { all: [{ field: 'propertyType', operator: 'eq', value: 'Flat' }, { field: 'propertyValue', operator: 'gt' }] } });
      return kb;
    }, 'factors.5.condition.all.1.value: gt:'],
    ['3. perOccurrence on a group', (kb) => {
      kb.factors.push({ id: 'group_per', description: 'x', points: 5, perOccurrence: true,
        condition: { any: [{ field: 'previousClaims', operator: 'gte', value: 1 }] } });
      return kb;
    }, 'factors.5.perOccurrence: perOccurrence is only allowed on a single-field (leaf) condition'],
    ['3. non-integer points', (kb) => { kb.factors[0] = { ...kb.factors[0], points: 2.5 }; return kb; }, 'factors.0.points:'],
    ['4. duplicate factor id', (kb) => { kb.factors.push({ ...kb.factors[0] }); return kb; }, 'factors[5].id: duplicate id "age_young_elderly"'],
    ['5. band gap', (kb) => { kb.riskBands['ELEVATED'] = { ...kb.riskBands['ELEVATED'], min: 27 }; return kb; },
      'riskBands.ELEVATED.min: expected 26 to follow riskBands.STANDARD.max'],
    ['5. band overlap', (kb) => { kb.riskBands['HIGH_RISK'] = { ...kb.riskBands['HIGH_RISK'], min: 60 }; return kb; },
      'riskBands.HIGH_RISK.min: expected 61 to follow riskBands.ELEVATED.max'],
    ['5. lowest band not at 0', (kb) => { kb.riskBands['STANDARD'] = { ...kb.riskBands['STANDARD'], min: 1 }; return kb; },
      'riskBands.STANDARD.min: the lowest band must start at 0'],
    ['5. unknown summary token', (kb) => { kb.riskBands['STANDARD'] = { ...kb.riskBands['STANDARD'], summary: 'Hello {customerName}' }; return kb; },
      'riskBands.STANDARD.summary: unknown token {customerName}'],
    ['6. unknown field', (kb) => { kb.factors[3] = { ...kb.factors[3], condition: { field: 'yearBuilt', operator: 'lt', value: 1950 } }; return kb; },
      'factors[3].condition.field: "yearBuilt" is not a quote request field'],
    ['6. unknown field nested in a group', (kb) => {
      kb.factors[3] = { ...kb.factors[3], condition: { not: { field: 'hasAlarm', operator: 'eq', value: true } } };
      return kb;
    }, 'factors[3].condition.not.field: "hasAlarm" is not a quote request field'],
    ['6. condition on an unscored field', (kb) => { kb.factors[3] = { ...kb.factors[3], condition: { field: 'customerName', operator: 'eq', value: 'x' } }; return kb; },
      'factors[3].condition.field: "customerName" is collected but never scored'],
    ['6. perOccurrence on a non-numeric field', (kb) => { kb.factors[3] = { ...kb.factors[3], perOccurrence: true }; return kb; },
      'factors[3].perOccurrence: field "propertyType" is not numeric'],
  ])('rejects %s', (_name, breakKb, expected) => {
    const problems = problemsOf(breakKb(realKb()));
    expect(problems.join('\n')).toContain(expected);
  });

  it('includes the source in the error message', () => {
    expect(() => parseKb('{', '/kb/risk-kb.json')).toThrow('Invalid KB at /kb/risk-kb.json');
  });
});
