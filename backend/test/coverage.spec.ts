import { loadKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { baseRequest, loadDir } from './load-fixtures';
import { scenarioFileSchema } from './scenario-schema';

// Fails when a factor or band in the real KB has no scenario, so a KB-only change still needs its fixture.
const kb = loadKb();
const scenarios = loadDir('scenarios', scenarioFileSchema).flatMap((f) => f.data);
const factorsHit = new Set(scenarios.flatMap((s) => s.expect.appliedFactorIds));
const bandsHit = new Set(scenarios.map((s) => s.expect.riskBand));

test('the base request triggers no factor', () => {
  const quote = getQuote(quoteRequestSchema.parse(baseRequest()), kb);
  expect(quote.appliedFactors).toEqual([]);
  expect(quote.riskScore).toBe(0);
});

test.each(kb.factors.filter((f) => f.enabled !== false).map((f) => f.id))('factor %s is triggered by at least one scenario', (id) => {
  expect(factorsHit).toContain(id);
});

test.each(kb.orderedBands.map((b) => b.id))('band %s is reached by at least one scenario', (id) => {
  expect(bandsHit).toContain(id);
});
