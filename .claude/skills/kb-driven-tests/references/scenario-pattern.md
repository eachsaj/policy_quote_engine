# Scenario pattern

Read this before you write fixtures or runners. Copy the formats and runners. The factor ids and numbers below are examples: take the real ones from `risk-kb.json`. The code is a pattern, not a compiled artefact: `tsc` and a green run are the proof.

## Layout

```
backend/test/
├── scenario-schema.ts        Zod schemas for fixture files (no `any`)
├── load-fixtures.ts          reads a directory, parses each file, names the file on failure
├── expect-matches.ts         the one assertion helper both runners share
├── scenarios/
│   ├── _base.json            a request that triggers no factor
│   ├── bands.json            whole-quote cases: at least one per band
│   ├── previous_claims_low.json
│   └── <factor_id>.json      one per factor: trigger, near-miss, boundaries
├── scenarios.spec.ts         test.each over every scenario
├── configurability/
│   ├── add-factor.json       flood zone added
│   ├── change-weight.json    claims weight 15 → 20
│   └── remove-factor.json
├── configurability.spec.ts
└── coverage.spec.ts          every factor and band has a scenario; _base scores 0
```

`test/` sits outside `src/`, so `tsconfig.build.json` never ships it and the no-numbers grep over `src/engine` never sees fixture numbers. Add `"<rootDir>/test"` to Jest `roots` in `jest.config`.

## Fixture formats

`_base.json`: a full, valid request that triggers nothing. Choose values away from every factor's boundary.

```json
{ "customerName": "Test Customer", "age": 40, "propertyType": "House", "propertyValue": 250000, "postcode": "SW1A 1AA", "previousClaims": 0 }
```

A scenario file is an array. `request` holds only the fields that differ from `_base`.

```json
[
  {
    "name": "2 previous claims scores per occurrence",
    "request": { "previousClaims": 2 },
    "expect": { "riskScore": 30, "riskBand": "ELEVATED", "appliedFactorIds": ["previous_claims_low"], "annualPremium": 540 },
    "why": "between 1–2 matches; perOccurrence 15 × 2 = 30 → ELEVATED (26–60); 300 × 1.5 × 1.2 = 540"
  },
  {
    "name": "0 claims is a near-miss",
    "request": { "previousClaims": 0 },
    "expect": { "riskScore": 0, "riskBand": "STANDARD", "appliedFactorIds": [] },
    "why": "0 is below between.min 1 → no factor; 0 → STANDARD"
  }
]
```

`annualPremium` and `monthlyPremium` are optional. Include them in `bands.json` (one per band, so the formula is checked for each multiplier) and wherever the band changes.

A configurability case:

```json
{
  "name": "adding a flood-zone factor changes the quote with no code change",
  "request": { "postcode": "EX4 1AA" },
  "patch": [
    { "op": "addFactor", "factor": { "id": "flood_zone", "description": "Property in a flood-risk postcode area",
      "condition": { "field": "postcode", "operator": "starts_with", "values": ["EX", "PL"] }, "points": 15 } }
  ],
  "before": { "riskScore": 0, "appliedFactorIds": [] },
  "after":  { "riskScore": 15, "appliedFactorIds": ["flood_zone"] },
  "why": "base scores 0; EX4 starts with EX → +15"
}
```

The other two cases use `{ "op": "setPoints", "id": "previous_claims_low", "points": 20 }` and `{ "op": "removeFactor", "id": "…" }`.

## Schemas (`test/scenario-schema.ts`)

```ts
import { z } from 'zod';

const expectation = z.object({
  riskScore: z.number(),
  riskBand: z.string().optional(),
  appliedFactorIds: z.array(z.string()),
  annualPremium: z.number().optional(),
  monthlyPremium: z.number().optional(),
}).strict();

export const scenarioSchema = z.object({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  expect: expectation,
  why: z.string().min(1),
}).strict();
export const scenarioFileSchema = z.array(scenarioSchema).min(1);
export type Scenario = z.infer<typeof scenarioSchema>;
export type Expectation = z.infer<typeof expectation>;

const patchOp = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addFactor'), factor: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal('setPoints'), id: z.string(), points: z.number() }),
  z.object({ op: z.literal('removeFactor'), id: z.string() }),
]);
export type PatchOp = z.infer<typeof patchOp>;

export const configurabilitySchema = z.object({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  patch: z.array(patchOp).min(1),
  before: expectation,
  after: expectation,
  why: z.string().min(1),
}).strict();
export type ConfigurabilityCase = z.infer<typeof configurabilitySchema>;
```

`addFactor.factor` is left as a record on purpose: the patched KB goes through the real `parseKb`, which validates it exactly as it would validate the file.

## Loader (`test/load-fixtures.ts`)

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';

export const testDir = __dirname;

export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

export const loadDir = <S extends z.ZodType>(dir: string, schema: S): Array<{ file: string; data: z.output<S> }> =>
  readdirSync(join(testDir, dir))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((file) => {
      const parsed = schema.safeParse(readJson(join(testDir, dir, file)));
      if (!parsed.success) {
        throw new Error(`${dir}/${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      return { file, data: parsed.data };
    });
```

## Assertion helper (`test/expect-matches.ts`)

A plain module, not a spec, so importing it doesn't register another spec's tests twice.

```ts
import type { QuoteResponse } from '../src/quote/response';
import type { Expectation } from './scenario-schema';

export const expectMatches = (res: QuoteResponse, e: Expectation): void => {
  expect(res.riskScore).toBe(e.riskScore);
  expect(res.appliedFactors.map((f) => f.id).sort()).toEqual([...e.appliedFactorIds].sort());
  if (e.riskBand !== undefined) expect(res.riskBand).toBe(e.riskBand);
  if (e.annualPremium !== undefined) expect(res.annualPremium).toBeCloseTo(e.annualPremium, 2);
  if (e.monthlyPremium !== undefined) expect(res.monthlyPremium).toBeCloseTo(e.monthlyPremium, 2);
};
```

## Scenario runner (`test/scenarios.spec.ts`)

```ts
import { join } from 'node:path';
import { loadKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { expectMatches } from './expect-matches';
import { loadDir, readJson, testDir } from './load-fixtures';
import { scenarioFileSchema } from './scenario-schema';

const kb = loadKb();
const base = quoteRequestSchema.parse(readJson(join(testDir, 'scenarios', '_base.json')));

const cases = loadDir('scenarios', scenarioFileSchema).flatMap(({ file, data }) =>
  data.map((s) => ({ ...s, label: `${file} › ${s.name}` })),
);

test.each(cases)('$label', ({ request, expect: expected }) => {
  const parsed = quoteRequestSchema.safeParse({ ...base, ...request });
  if (!parsed.success) throw new Error(`invalid fixture request: ${parsed.error.message}`);
  expectMatches(getQuote(parsed.data, kb), expected);
});
```

`quoteRequestSchema` applies its transforms (postcode upper-casing), so a fixture with `"ex4 1aa"` also tests normalisation.

## Configurability runner (`test/configurability.spec.ts`)

Patch ops are a lookup table. The patched KB goes through the real `parseKb`, so a patch that makes the KB invalid fails exactly as a bad file would.

```ts
import { join } from 'node:path';
import { z } from 'zod';
import { parseKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { expectMatches } from './expect-matches';
import { loadDir, readJson, testDir } from './load-fixtures';
import { configurabilitySchema, type PatchOp } from './scenario-schema';

// A loose view of the raw KB: enough to patch factors. parseKb does the real validation.
const kbJsonSchema = z.object({ factors: z.array(z.record(z.string(), z.unknown())) }).passthrough();
type KbJson = z.infer<typeof kbJsonSchema>;

const applyOp: { [K in PatchOp['op']]: (kb: KbJson, op: Extract<PatchOp, { op: K }>) => KbJson } = {
  addFactor: (kb, op) => ({ ...kb, factors: [...kb.factors, op.factor] }),
  setPoints: (kb, op) => ({ ...kb, factors: kb.factors.map((f) => (f.id === op.id ? { ...f, points: op.points } : f)) }),
  removeFactor: (kb, op) => ({ ...kb, factors: kb.factors.filter((f) => f.id !== op.id) }),
};
const apply = (kb: KbJson, op: PatchOp): KbJson => (applyOp[op.op] as (k: KbJson, o: PatchOp) => KbJson)(kb, op);

const kbPath = join(testDir, '..', '..', 'risk-kb.json');
const rawKb = kbJsonSchema.parse(readJson(kbPath));
const baseRecord = z.record(z.string(), z.unknown()).parse(readJson(join(testDir, 'scenarios', '_base.json')));

test.each(loadDir('configurability', configurabilitySchema).map(({ file, data }) => ({ ...data, label: `${file} › ${data.name}` })))(
  '$label',
  ({ request, patch, before, after }) => {
    const req = quoteRequestSchema.parse({ ...baseRecord, ...request });
    const original = parseKb(JSON.stringify(rawKb), 'real');
    const patched = parseKb(JSON.stringify(patch.reduce(apply, rawKb)), 'patched');

    expectMatches(getQuote(req, original), before);
    expectMatches(getQuote(req, patched), after);
    expect(getQuote(req, patched).riskScore).not.toBe(getQuote(req, original).riskScore);
  },
);
```

The one cast in `apply` is the typed-lookup idiom for a discriminated union: TypeScript can't correlate `op.op` with the matching handler. It widens a function type and never touches data. Don't replace it with `any`.

## Coverage check (`test/coverage.spec.ts`)

This check fails when someone adds a factor with no fixture. That keeps `kb-factor` honest.

```ts
import { join } from 'node:path';
import { loadKb } from '../src/kb/loader';
import { quoteRequestSchema } from '../src/quote/request';
import { getQuote } from '../src/quote/service';
import { loadDir, readJson, testDir } from './load-fixtures';
import { scenarioFileSchema } from './scenario-schema';

const kb = loadKb();
const scenarios = loadDir('scenarios', scenarioFileSchema).flatMap((f) => f.data);
const covered = new Set(scenarios.flatMap((s) => s.expect.appliedFactorIds));
const bandsHit = new Set(scenarios.map((s) => s.expect.riskBand).filter((b) => b !== undefined));

test('the base request triggers no factor', () => {
  const res = getQuote(quoteRequestSchema.parse(readJson(join(testDir, 'scenarios', '_base.json'))), kb);
  expect(res.appliedFactors).toEqual([]);
  expect(res.riskScore).toBe(0);
});

test.each(kb.factors.filter((f) => f.enabled !== false).map((f) => f.id))('factor %s is triggered by at least one scenario', (id) => {
  expect(covered).toContain(id);
});

test.each(kb.orderedBands.map((b) => b.id))('band %s is reached by at least one scenario', (id) => {
  expect(bandsHit).toContain(id);
});
```

## Writing a factor's fixture (used by `kb-factor`)

For a factor, derive the inputs from its condition:

| Condition | Cases |
|---|---|
| `eq` / `in` | a matching value, and one other valid enum value |
| `gt` / `lt` / `gte` / `lte` | the boundary value and one step either side (e.g. `gt 500000`: 500000 no, 500001 yes) |
| `between` / `outside_range` | `min`, `max`, `min − 1`, `max + 1` |
| `starts_with` | each prefix, lower-case input (normalisation), and a near prefix (`"E1 6AN"` vs `EX`) |
| `all` | all true, then each branch false on its own |
| `any` | each branch true on its own, then all false |
| `not` | inner true, inner false |
| `perOccurrence` | 1, 2 and the maximum matching value; `why` shows points × value |

Every case is `_base` plus the one change, so the expected score is that factor's points alone. The exception is when the change also triggers another factor; the `why` must say so.
