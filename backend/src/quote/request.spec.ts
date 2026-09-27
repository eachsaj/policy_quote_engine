import { quoteRequestSchema } from './request';

const valid = { customerName: 'A Customer', age: 40, propertyType: 'House', propertyValue: 250000, postcode: 'D02 X285', previousClaims: 0 };
const postcodeOf = (postcode: string) => quoteRequestSchema.safeParse({ ...valid, postcode });

describe('quoteRequestSchema postcode (Eircode)', () => {
  test.each([
    ['D02 X285', 'D02 X285'],
    [' t12 x70a ', 'T12 X70A'], // trimmed and upper-cased, so KB starts_with ["T12"] matches
    ['A65F4E2', 'A65F4E2'],     // the space is optional
    ['D6W 1234', 'D6W 1234'],   // the one routing key with a letter
  ])('accepts %p as %p', (input, expected) => {
    const result = postcodeOf(input);
    expect(result.success && result.data.postcode).toBe(expected);
  });

  test.each([
    ['SW1A 1AA'],  // UK postcode
    ['D02 B285'],  // B is not an Eircode letter
    ['D02 X28'],   // unique identifier too short
    ['002 X285'],  // routing key must start with a letter
  ])('rejects %p', (input) => {
    const result = postcodeOf(input);
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe('Must be a valid Eircode');
  });
});
