import type { Currency } from '../models/quote';

// How each currency is written. Presentation only: amounts come from the backend unconverted.
const locales: Readonly<Record<Currency, string>> = { GBP: 'en-GB', EUR: 'en-IE' };
/** The symbol shown before the property value input. */
export const currencySymbols: Readonly<Record<Currency, string>> = { GBP: '£', EUR: '€' };
/** Spoken names, for the screen-reader announcement ("45.00 euro a month"). */
export const currencyNames: Readonly<Record<Currency, string>> = { GBP: 'pounds', EUR: 'euro' };

/** Formats an amount in the given currency, with pence/cents unless `whole` is set. */
export const formatMoney = (amount: number, currency: Currency, whole = false): string =>
  new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
