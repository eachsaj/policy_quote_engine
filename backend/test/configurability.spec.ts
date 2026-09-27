import { z } from 'zod';
import { parseKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { expectMatches } from './expect-matches';
import { baseRequest, loadDir, readJson, realKbPath } from './load-fixtures';
import { configurabilitySchema, type PatchOp } from './scenario-schema';

// The brief's configurability requirement: the same engine against an in-memory copy of the real KB
// with a data patch applied. No engine code is touched, and risk-kb.json on disk is never edited.

// A loose view of the raw KB, enough to patch factors. parseKb does the real validation.
const kbJsonSchema = z.looseObject({ factors: z.array(z.record(z.string(), z.unknown())) });
type KbJson = z.infer<typeof kbJsonSchema>;

type OpOf<K extends PatchOp['op']> = Extract<PatchOp, { op: K }>;
const applyOp: { [K in PatchOp['op']]: (kb: KbJson, op: OpOf<K>) => KbJson } = {
  addFactor: (kb, op) => ({ ...kb, factors: [...kb.factors, op.factor] }),
  setPoints: (kb, op) => ({ ...kb, factors: kb.factors.map((f) => (f['id'] === op.id ? { ...f, points: op.points } : f)) }),
  removeFactor: (kb, op) => ({ ...kb, factors: kb.factors.filter((f) => f['id'] !== op.id) }),
};
// Typed-lookup idiom: TypeScript can't correlate op.op with its handler, so the handler type is widened. It never touches data.
const apply = (kb: KbJson, op: PatchOp): KbJson => (applyOp[op.op] as (k: KbJson, o: PatchOp) => KbJson)(kb, op);

const rawKb = kbJsonSchema.parse(readJson(realKbPath));
const base = baseRequest();

const cases = loadDir('configurability', configurabilitySchema).map(({ file, data }) => ({ ...data, label: `${file} › ${data.name}` }));

test.each(cases)('$label', ({ request, patch, before, after }) => {
  const req = quoteRequestSchema.parse({ ...base, ...request });
  const original = getQuote(req, parseKb(JSON.stringify(rawKb), 'real'));
  const patched = getQuote(req, parseKb(JSON.stringify(patch.reduce(apply, rawKb)), 'patched'));

  expectMatches(original, before);
  expectMatches(patched, after);
  expect(patched.riskScore).not.toBe(original.riskScore);
});
