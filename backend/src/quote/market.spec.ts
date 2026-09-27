import { currencyOf, isKnownPostcode, markets } from './market';

describe('postcode markets', () => {
  test.each([
    ['SW1A 1AA', 'GBP'],
    ['EX4 4QJ', 'GBP'],
    ['M1 1AE', 'GBP'],
    ['D02 X285', 'EUR'],
    ['T12 X70A', 'EUR'],
    ['A65F4E2', 'EUR'],
  ])('%p → %p', (postcode, currency) => {
    expect(currencyOf(postcode)).toBe(currency);
  });

  it('never matches both formats, so the currency is never ambiguous', () => {
    const samples = ['SW1A 1AA', 'SW1A1AA', 'EX4 4QJ', 'M1 1AE', 'PL48AA', 'W1A 0AX', 'D02 X285', 'T12 X70A', 'A65F4E2', 'D6W 1234', 'N37 X2K5'];
    samples.forEach((p) => expect(markets.filter((m) => m.pattern.test(p))).toHaveLength(1));
  });

  it('refuses a postcode the request schema would have rejected', () => {
    expect(isKnownPostcode('12345')).toBe(false);
    expect(() => currencyOf('12345')).toThrow('not validated');
  });
});
