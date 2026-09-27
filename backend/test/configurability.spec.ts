import { z } from 'zod';
import { parseKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { expectMatches } from './expect-matches';
import { join } from 'node:path';
import { baseRequest, loadDir, readJson, testDir } from './load-fixtures';
import { configurabilitySchema, type PatchOp } from './scenario-schema';

// The brief's configurability requirement: the same engine against an in-memory KB with a data patch
// applied. No engine code is touched, and no KB file on disk is edited.
//
// The patches apply to a frozen baseline (configurability/_baseline-kb.json, the v1.0.0 KB), not to the
// live risk-kb.json. The proof is about the engine, so it must not depend on today's rules: otherwise a
// live KB edit (e.g. adding flood_zone in the demo) would collide with the case that adds it here.
// The live KB is covered by the scenario fixtures and coverage.spec.ts.

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

const rawKb = kbJsonSchema.parse(readJson(join(testDir, 'configurability', '_baseline-kb.json')));
const base = baseRequest();

const cases = loadDir('configurability', configurabilitySchema).map(({ file, data }) => ({ ...data, label: `${file} › ${data.name}` }));

test.each(cases)('$label', ({ request, patch, before, after }) => {
  const req = quoteRequestSchema.parse({ ...base, ...request });
  const original = getQuote(req, parseKb(JSON.stringify(rawKb), 'baseline'));
  const patched = getQuote(req, parseKb(JSON.stringify(patch.reduce(apply, rawKb)), 'patched'));

  expectMatches(original, before);
  expectMatches(patched, after);
  expect(patched.riskScore).not.toBe(original.riskScore);
});
