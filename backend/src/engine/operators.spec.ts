import { isOperatorName, operators, type OperatorName } from './operators';

type Case = [OperatorName, Record<string, unknown>, unknown, boolean];

describe('operator registry', () => {
  test.each<Case>([
    ['eq', { value: 'Flat' }, 'Flat', true],
    ['eq', { value: 'Flat' }, 'House', false],
    ['neq', { value: 'House' }, 'Flat', true],
    ['neq', { value: 'House' }, 'House', false],
    ['gt', { value: 750000 }, 750001, true],
    ['gt', { value: 750000 }, 750000, false],
    ['gte', { value: 3 }, 3, true],
    ['gte', { value: 3 }, 2, false],
    ['lt', { value: 25 }, 24, true],
    ['lt', { value: 25 }, 25, false],
    ['lte', { value: 25 }, 25, true],
    ['lte', { value: 25 }, 26, false],
    ['between', { min: 1, max: 2 }, 1, true],
    ['between', { min: 1, max: 2 }, 2, true],
    ['between', { min: 1, max: 2 }, 0, false],
    ['between', { min: 1, max: 2 }, 3, false],
    ['outside_range', { min: 25, max: 75 }, 24, true],
    ['outside_range', { min: 25, max: 75 }, 76, true],
    ['outside_range', { min: 25, max: 75 }, 25, false],
    ['outside_range', { min: 25, max: 75 }, 75, false],
    ['in', { values: ['Flat', 'Bungalow'] }, 'Bungalow', true],
    ['in', { values: ['Flat', 'Bungalow'] }, 'House', false],
    ['starts_with', { values: ['T12', 'N37'] }, 'T12 X70A', true],
    ['starts_with', { values: ['T12', 'N37'] }, 'n37 a0c4', true],
    ['starts_with', { values: ['T12', 'N37'] }, 'D02 X285', false],
  ])('%s %j on %j → %s', (op, params, value, expected) => {
    expect(operators[op].matches(value, params)).toBe(expected);
  });

  test.each<[OperatorName, Record<string, unknown>]>([
    ['gt', { value: 10 }],
    ['between', { min: 1, max: 2 }],
    ['outside_range', { min: 25, max: 75 }],
  ])('numeric operator %s never matches a non-number', (op, params) => {
    expect(operators[op].matches('100', params)).toBe(false);
  });

  it('never matches when params are malformed', () => {
    expect(operators.between.matches(1, { min: 1 })).toBe(false);
  });

  it('knows its operator names', () => {
    expect(isOperatorName('starts_with')).toBe(true);
    expect(isOperatorName('regex')).toBe(false);
    expect(isOperatorName('toString')).toBe(false);
  });
});
