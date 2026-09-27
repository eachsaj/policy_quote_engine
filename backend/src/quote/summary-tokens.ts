/**
 * The tokens the quote service supplies to a band's `summary` template.
 * Kept apart from quote/service.ts so the KB loader can reject unknown tokens without importing the service.
 */
export const summaryTokens = ['score', 'factorCount', 'label'] as const;

/** One of the tokens above; the service fills a Record<SummaryToken, …>, so a new token must be supplied. */
export type SummaryToken = (typeof summaryTokens)[number];
