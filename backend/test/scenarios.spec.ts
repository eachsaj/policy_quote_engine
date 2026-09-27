import { loadKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { expectMatches } from './expect-matches';
import { baseRequest, loadDir } from './load-fixtures';
import { scenarioFileSchema } from './scenario-schema';

// Every scenario runs against the real risk-kb.json. Expected values are worked out by hand in each fixture's `why`.
const kb = loadKb();
const base = baseRequest();

const cases = loadDir('scenarios', scenarioFileSchema).flatMap(({ file, data }) =>
  data.map((s) => ({ ...s, label: `${file} › ${s.name}` })),
);

test.each(cases)('$label', ({ request, expect: expected }) => {
  const parsed = quoteRequestSchema.safeParse({ ...base, ...request });
  if (!parsed.success) throw new Error(`invalid fixture request: ${parsed.error.message}`);
  expectMatches(getQuote(parsed.data, kb), expected);
});
