// The postcode's format decides the market, and the market decides the currency amounts are shown in.
// Not a scoring input: the KB's numbers are the same in every market, with no conversion.

export const currencies = ['GBP', 'EUR'] as const;
export type Currency = (typeof currencies)[number];

// UK postcode: outward code (1–2 area letters, a district digit, optionally a digit or letter, as in SW1A)
// and inward code (a digit and two letters), optional space.
const ukPostcode = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

// Irish Eircode: a 3-character routing key (letter, digit, digit or W as in D6W) and a 4-character unique identifier,
// optional space. Eircodes avoid the letters B, G, I, J, L, M, O, Q, S, U and Z.
const eircode = /^[ACDEFHKNPRTVWXY]\d[\dW] ?[\dACDEFHKNPRTVWXY]{4}$/i;

/**
 * The markets a postcode can belong to. The two formats never overlap: an Eircode's unique identifier is 4
 * characters and a UK inward code is 3, so at most one pattern matches (market.spec.ts checks this).
 */
export const markets: ReadonlyArray<{ readonly id: 'GB' | 'IE'; readonly pattern: RegExp; readonly currency: Currency }> = [
  { id: 'GB', pattern: ukPostcode, currency: 'GBP' },
  { id: 'IE', pattern: eircode, currency: 'EUR' },
];

export const isKnownPostcode = (postcode: string): boolean => markets.some((m) => m.pattern.test(postcode));

/** The currency for a postcode the request schema has already accepted. */
export const currencyOf = (postcode: string): Currency => {
  const market = markets.find((m) => m.pattern.test(postcode));
  if (!market) throw new Error('currencyOf: postcode was not validated by quoteRequestSchema');
  return market.currency;
};
