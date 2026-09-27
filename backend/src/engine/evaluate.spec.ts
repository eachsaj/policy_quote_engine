import type { Condition } from '../kb/types';
import { evaluate } from './evaluate';

const flat: Condition = { field: 'propertyType', operator: 'eq', value: 'Flat' };
const over500k: Condition = { field: 'propertyValue', operator: 'gt', value: 500000 };
const exOrPl: Condition = { field: 'postcode', operator: 'starts_with', values: ['EX', 'PL'] };

describe('evaluate', () => {
  test.each<[string, Condition, Record<string, unknown>, boolean]>([
    ['leaf true', flat, { propertyType: 'Flat' }, true],
    ['leaf false', flat, { propertyType: 'House' }, false],
    ['leaf on a missing field', flat, {}, false],
    ['all: both match', { all: [flat, over500k] }, { propertyType: 'Flat', propertyValue: 600000 }, true],
    ['all: one fails', { all: [flat, over500k] }, { propertyType: 'Flat', propertyValue: 400000 }, false],
    ['any: one matches', { any: [flat, exOrPl] }, { propertyType: 'House', postcode: 'PL1 1AA' }, true],
    ['any: none match', { any: [flat, exOrPl] }, { propertyType: 'House', postcode: 'SW1A 1AA' }, false],
    ['not: inverts true', { not: flat }, { propertyType: 'Flat' }, false],
    ['not: inverts false', { not: flat }, { propertyType: 'Bungalow' }, true],
    ['nested all inside any', { any: [{ all: [flat, over500k] }, exOrPl] }, { propertyType: 'Flat', propertyValue: 900000, postcode: 'SW1A 1AA' }, true],
    ['nested not inside all', { all: [over500k, { not: flat }] }, { propertyType: 'Flat', propertyValue: 900000 }, false],
  ])('%s', (_name, condition, input, expected) => {
    expect(evaluate(condition, input)).toBe(expected);
  });
});
