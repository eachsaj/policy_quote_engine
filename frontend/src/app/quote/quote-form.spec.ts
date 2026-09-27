import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { buildQuoteForm, toQuoteRequest } from './quote-form';

const valid = { customerName: 'A Customer', age: 40, propertyType: 'House' as const, propertyValue: 250000, postcode: 'D02 X285', previousClaims: 0 };
const form = () => {
  const f = buildQuoteForm(TestBed.inject(FormBuilder));
  f.setValue(valid);
  return f;
};

describe('quote form validators mirror the backend Zod schema', () => {
  it('accepts a valid request', () => {
    expect(form().valid).toBe(true);
  });

  // Each row sets one field to a value the backend rejects (or accepts), and checks the form agrees.
  // A typed setter per row, so no value is cast to fit the control.
  type Row = [string, (f: ReturnType<typeof form>) => { valid: boolean }, boolean];
  const set = <T>(c: { setValue(v: T): void; valid: boolean }, v: T) => (c.setValue(v), c);
  it.each<Row>([
    ['customerName blank', (f) => set(f.controls.customerName, '   '), false],        // z.string().trim().min(1)
    ['customerName 101 chars', (f) => set(f.controls.customerName, 'x'.repeat(101)), false], // max(100)
    ['age 17', (f) => set(f.controls.age, 17), false],                                 // min(18)
    ['age 121', (f) => set(f.controls.age, 121), false],                               // max(120)
    ['age 40.5', (f) => set(f.controls.age, 40.5), false],                             // int()
    ['age 18', (f) => set(f.controls.age, 18), true],
    ['propertyType empty', (f) => set(f.controls.propertyType, null), false],
    ['propertyValue 0', (f) => set(f.controls.propertyValue, 0), false],               // positive()
    ['propertyValue 0.5', (f) => set(f.controls.propertyValue, 0.5), true],            // positive() allows fractions; Validators.min(1) would not
    ['postcode invalid', (f) => set(f.controls.postcode, 'NOT A POSTCODE'), false],
    ['postcode lower-case', (f) => set(f.controls.postcode, 't12 x70a'), true],         // upper-cased when the request is built
    ['postcode no space', (f) => set(f.controls.postcode, 'A65F4E2'), true],
    ['postcode D6W routing key', (f) => set(f.controls.postcode, 'D6W 1234'), true],
    ['postcode UK format', (f) => set(f.controls.postcode, 'SW1A 1AA'), true],           // UK postcodes and Eircodes are both accepted
    ['postcode UK lower-case', (f) => set(f.controls.postcode, 'ex4 4qj'), true],
    ['postcode UK inward too short', (f) => set(f.controls.postcode, 'SW1A 1A'), false],
    ['postcode letter B', (f) => set(f.controls.postcode, 'D02 B285'), false],           // B is not an Eircode letter, and not a UK inward code
    ['previousClaims -1', (f) => set(f.controls.previousClaims, -1), false],
    ['previousClaims 21', (f) => set(f.controls.previousClaims, 21), false],
    ['previousClaims 1.5', (f) => set(f.controls.previousClaims, 1.5), false],
    ['previousClaims 20', (f) => set(f.controls.previousClaims, 20), true],
  ])('%s → valid %s', (_name, apply, expected) => {
    expect(apply(form()).valid).toBe(expected);
  });

  it('builds a trimmed, upper-cased request with no casts', () => {
    const f = form();
    f.patchValue({ customerName: '  Sam  ', postcode: ' t12 x70a ' });
    expect(toQuoteRequest(f.getRawValue())).toEqual({ ...valid, customerName: 'Sam', postcode: 'T12 X70A' });
  });

  it('returns null while a required field is empty', () => {
    const f = form();
    f.controls.age.setValue(null);
    expect(toQuoteRequest(f.getRawValue())).toBeNull();
  });
});
