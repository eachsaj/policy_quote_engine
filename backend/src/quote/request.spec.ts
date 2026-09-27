import { quoteRequestSchema } from './request';

const valid = { customerName: 'A Customer', age: 40, propertyType: 'House', propertyValue: 250000, postcode: 'D02 X285', previousClaims: 0 };
const postcodeOf = (postcode: string) => quoteRequestSchema.safeParse({ ...valid, postcode });

describe('quoteRequestSchema postcode (UK postcode or Eircode)', () => {
  test.each([
    ['D02 X285', 'D02 X285'],   // Eircode
    [' t12 x70a ', 'T12 X70A'], // trimmed and upper-cased, so KB starts_with ["T12"] matches
    ['A65F4E2', 'A65F4E2'],     // Eircode without the space
    ['D6W 1234', 'D6W 1234'],   // the one Eircode routing key with a letter
    ['SW1A 1AA', 'SW1A 1AA'],   // UK: outward code with a trailing letter
    ['ex4 4qj', 'EX4 4QJ'],     // UK, upper-cased, so the brief's starts_with ["EX", "PL"] matches
    ['M1 1AE', 'M1 1AE'],       // UK: one-letter area, one-digit district
    ['PL48AA', 'PL48AA'],       // UK without the space
  ])('accepts %p as %p', (input, expected) => {
    const result = postcodeOf(input);
    expect(result.success && result.data.postcode).toBe(expected);
  });

  test.each([
    ['D02 B285'],  // B is not an Eircode letter, and a 4-character inward code is not UK
    ['D02 X28'],   // Eircode identifier too short; not a UK inward code (digit, letter, letter)
    ['002 X285'],  // must start with a letter
    ['SW1A 1A'],   // UK inward code too short
    ['12345'],     // US ZIP
    [''],
  ])('rejects %p', (input) => {
    const result = postcodeOf(input);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe('Must be a valid UK postcode or Eircode');
  });
});
