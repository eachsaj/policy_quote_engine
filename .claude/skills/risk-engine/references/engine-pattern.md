# Engine pattern

Read this before you write or change `engine/*`, `kb/*`, `quote/service.ts` or `quote/response.ts`. Copy the shape. Adjust names only when the code that already exists uses different ones. The code is a pattern, not a compiled artefact: `tsc` and the specs are the proof.

## Module map

```
backend/src/
├── engine/operators.ts   registry: name → { params (Zod), test }
├── engine/evaluate.ts    evaluate(condition, input): leaf → registry, all/any/not → recursion
├── engine/score.ts       scoreRisk(input, kb) → { score, appliedFactors }
├── engine/band.ts        findBand(score, bands)
├── engine/template.ts    interpolate(template, values)
├── kb/types.ts           Kb, RiskBand, Factor, Condition interfaces
├── kb/schema.ts          Zod KB schema, leaf params checked through the registry
├── kb/loader.ts          read → parse → validate → consistency checks → cache; reload with last-good
├── quote/response.ts     QuoteResponse, AppliedFactor, CoverageDetails
└── quote/service.ts      getQuote(request, kb)
```

Dependency direction: `service → engine → kb/types`, `loader → schema → operators`. `engine/` never imports `loader` or `quote/request`.

## KB types (`kb/types.ts`)

The brief's example keys are kept verbatim; `// +` marks our additions.

```ts
import type { OperatorName } from '../engine/operators';

export interface LeafCondition {
  readonly field: string;
  readonly operator: OperatorName;
  readonly [param: string]: unknown; // operator params sit flat, as in the brief: { "operator": "between", "min": 1, "max": 2 }
}
export interface AllCondition { readonly all: readonly Condition[] }
export interface AnyCondition { readonly any: readonly Condition[] }
export interface NotCondition { readonly not: Condition }
export type Condition = LeafCondition | AllCondition | AnyCondition | NotCondition;

export interface Factor {
  readonly id: string;
  readonly description: string;
  readonly condition: Condition;
  readonly points: number;
  readonly perOccurrence?: boolean;
  readonly enabled?: boolean; // + defaults to true
}

export interface RiskBand {
  readonly min: number;
  readonly max: number;
  readonly riskMultiplier: number; // +
  readonly label: string;          // + badge wording, e.g. "HIGH RISK"
  readonly summary: string;        // + template with {tokens}
}

export interface CoverageItem { readonly id: string; readonly description: string }

export interface Kb {
  readonly version: string;
  readonly schemaVersion: number; // +
  readonly basePremium: number;
  readonly coverageLoadFactor: number;
  readonly riskBands: Readonly<Record<string, RiskBand>>;
  readonly coverage?: { readonly items: readonly CoverageItem[] }; // +
  readonly factors: readonly Factor[];
}

/** A band with its id attached, in ascending `min` order. Built by the loader. */
export interface OrderedBand extends RiskBand { readonly id: string }

/** What the engine receives: the validated KB plus loader-derived data. */
export interface LoadedKb extends Kb { readonly orderedBands: readonly OrderedBand[] }
```

## Operator registry (`engine/operators.ts`)

Each operator pairs a Zod params schema with a pure test. `defineOperator` closes over the schema so the registry is homogeneous without `any` or casts. The KB is already validated at load, so `safeParse` failing here means a bug; it returns `false` rather than throwing mid-quote.

```ts
import { z } from 'zod';

const defineOperator = <S extends z.ZodType>(params: S, test: (value: unknown, p: z.output<S>) => boolean) => ({
  params,
  matches: (value: unknown, leaf: unknown): boolean => {
    const parsed = params.safeParse(leaf);
    return parsed.success && test(value, parsed.data);
  },
});

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const scalar = z.union([z.string(), z.number(), z.boolean()]);
const single = z.object({ value: scalar });
const numeric = z.object({ value: z.number() });
const range = z.object({ min: z.number(), max: z.number() }).refine((r) => r.min <= r.max, 'min must be <= max');

export const operators = {
  eq: defineOperator(single, (v, p) => v === p.value),
  neq: defineOperator(single, (v, p) => v !== p.value),
  gt: defineOperator(numeric, (v, p) => num(v) && v > p.value),
  gte: defineOperator(numeric, (v, p) => num(v) && v >= p.value),
  lt: defineOperator(numeric, (v, p) => num(v) && v < p.value),
  lte: defineOperator(numeric, (v, p) => num(v) && v <= p.value),
  between: defineOperator(range, (v, p) => num(v) && v >= p.min && v <= p.max),
  outside_range: defineOperator(range, (v, p) => num(v) && (v < p.min || v > p.max)),
  in: defineOperator(z.object({ values: z.array(scalar).min(1) }), (v, p) => p.values.some((x) => x === v)),
  starts_with: defineOperator(
    z.object({ values: z.array(z.string().min(1)).min(1) }),
    (v, p) => typeof v === 'string' && p.values.some((prefix) => v.toUpperCase().startsWith(prefix.toUpperCase())),
  ),
} as const;

export type OperatorName = keyof typeof operators;
export const operatorNames = Object.keys(operators) as [OperatorName, ...OperatorName[]];
export const isOperatorName = (name: string): name is OperatorName => Object.hasOwn(operators, name);
```

`operatorNames` is the one `as` in this layer: `Object.keys` loses the literal type. Keep it here, next to the object it describes.

Parameter key names (`value`, `min`/`max`, `values`) must match what the brief's example factors use. Check them against `risk-kb.json` before copying.

## Evaluator (`engine/evaluate.ts`)

Structural recursion over node kinds; operator dispatch is a registry lookup.

```ts
import type { AllCondition, AnyCondition, Condition, LeafCondition } from '../kb/types';
import { operators } from './operators';

export type RiskInput = Readonly<Record<string, unknown>>;

export const isLeaf = (c: Condition): c is LeafCondition => 'field' in c && 'operator' in c;
const isAll = (c: Condition): c is AllCondition => 'all' in c;
const isAny = (c: Condition): c is AnyCondition => 'any' in c;

export const evaluate = (condition: Condition, input: RiskInput): boolean => {
  if (isLeaf(condition)) return operators[condition.operator].matches(input[condition.field], condition);
  if (isAll(condition)) return condition.all.every((c) => evaluate(c, input));
  if (isAny(condition)) return condition.any.some((c) => evaluate(c, input));
  return !evaluate(condition.not, input);
};
```

`all: []` is `true` and `any: []` is `false` (JS semantics). The schema requires at least one child, so neither reaches the evaluator from a real KB.

## Scorer (`engine/score.ts`)

```ts
import type { LoadedKb } from '../kb/types';
import type { AppliedFactor } from '../quote/response';
import { evaluate, isLeaf, type RiskInput } from './evaluate';

export interface RiskScore { readonly score: number; readonly appliedFactors: readonly AppliedFactor[] }

const occurrencesOf = (factor: LoadedKb['factors'][number], input: RiskInput): number => {
  if (!factor.perOccurrence || !isLeaf(factor.condition)) return 1; // loader forbids perOccurrence on groups
  const value = input[factor.condition.field];
  if (typeof value !== 'number') {
    throw new Error(`Factor "${factor.id}" is perOccurrence but field "${factor.condition.field}" is not numeric`);
  }
  return value;
};

export const scoreRisk = (input: RiskInput, kb: LoadedKb): RiskScore => {
  const appliedFactors = kb.factors
    .filter((f) => f.enabled !== false && evaluate(f.condition, input))
    .map((f): AppliedFactor => {
      const occurrences = occurrencesOf(f, input);
      return { id: f.id, description: f.description, points: f.points * occurrences, occurrences };
    });
  return { score: appliedFactors.reduce((sum, f) => sum + f.points, 0), appliedFactors };
};
```

`AppliedFactor.points` is the awarded total; `occurrences` is 1 unless `perOccurrence`. Two claims on a `between 1–2, points 15, perOccurrence` factor give `{ points: 30, occurrences: 2 }`.

## Band lookup (`engine/band.ts`)

```ts
import type { OrderedBand } from '../kb/types';

export const findBand = (score: number, bands: readonly OrderedBand[]): OrderedBand => {
  const band = bands.findLast((b) => b.min <= score);
  if (!band) throw new Error(`Score ${score} is below every band`); // unreachable: loader requires the first band to start at 0 and scores are >= 0
  if (score > band.max) console.warn(JSON.stringify({ warning: 'score above top band max', score, band: band.id }));
  return band;
};
```

`findLast` needs `lib: ES2023` in `tsconfig`. "Last band whose `min <= score`" also handles non-integer scores that would fall between `25` and `26`.

## Template (`engine/template.ts`)

```ts
export const templateTokens = (template: string): string[] => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '');

export const interpolate = (template: string, values: Readonly<Record<string, string | number>>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : whole));
```

The service supplies a fixed token set; export it so the loader can reject unknown tokens:

```ts
// quote/service.ts
export const summaryTokens = ['score', 'factorCount', 'label'] as const;
```

## KB schema (`kb/schema.ts`)

Leaf params are validated by delegating to the registry, so the schema never lists operators by hand.

```ts
import { z } from 'zod';
import { isOperatorName, operators } from '../engine/operators';
import type { Condition, Kb } from './types';

const leafSchema = z
  .object({ field: z.string().min(1), operator: z.string() })
  .passthrough()
  .superRefine((leaf, ctx) => {
    if (!isOperatorName(leaf.operator)) {
      ctx.addIssue({ code: 'custom', path: ['operator'], message: `Unknown operator "${leaf.operator}"` });
      return;
    }
    const result = operators[leaf.operator].params.safeParse(leaf);
    if (!result.success) {
      result.error.issues.forEach((i) => ctx.addIssue({ code: 'custom', path: i.path, message: i.message }));
    }
  });

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(conditionSchema).min(1) }).strict(),
    z.object({ any: z.array(conditionSchema).min(1) }).strict(),
    z.object({ not: conditionSchema }).strict(),
    leafSchema,
  ]),
);

const bandSchema = z.object({
  min: z.number().min(0),
  max: z.number(),
  riskMultiplier: z.number().positive(),
  label: z.string().min(1),
  summary: z.string().min(1),
});

const factorSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'id must be snake_case'),
    description: z.string().min(1),
    condition: conditionSchema,
    points: z.number().int(),
    perOccurrence: z.boolean().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((f) => !f.perOccurrence || 'field' in f.condition, {
    path: ['perOccurrence'],
    message: 'perOccurrence is only allowed on a single-field (leaf) condition',
  });

export const kbSchema = z.object({
  version: z.string().min(1),
  schemaVersion: z.number().int(),
  basePremium: z.number().positive(),
  coverageLoadFactor: z.number().positive(),
  riskBands: z.record(z.string(), bandSchema).refine((b) => Object.keys(b).length > 0, 'at least one band'),
  coverage: z.object({ items: z.array(z.object({ id: z.string(), description: z.string() })) }).optional(),
  factors: z.array(factorSchema),
}) satisfies z.ZodType<Kb>;
```

If `z.union` over a `passthrough` leaf fights the `Condition` interface under your Zod version, keep the interface as the source of truth and fix the schema, never the other way round. Union errors can be vague; if a bad leaf yields "Invalid input" without the operator message, try the leaf branch first when the node has a `field` key (`z.lazy(() => …)` with a `z.custom` pre-check is fine).

## Loader (`kb/loader.ts`)

The spec's six checks, each with a path in its message. Checks 5 and 6 are consistency checks Zod can't express locally.

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { templateTokens } from '../engine/template';
import { quoteRequestSchema } from '../quote/request';
import { summaryTokens } from '../quote/service';
import { kbSchema } from './schema';
import type { Condition, Kb, LoadedKb, OrderedBand } from './types';

export const supportedSchemaVersions: readonly number[] = [1];

export class KbValidationError extends Error {
  constructor(source: string, problems: readonly string[]) {
    super(`Invalid KB at ${source}:\n  - ${problems.join('\n  - ')}`);
    this.name = 'KbValidationError';
  }
}

export const kbPath = (): string => resolve(process.env.KB_PATH ?? resolve(process.cwd(), '..', 'risk-kb.json'));

const fieldsOf = (c: Condition, at: string): Array<{ field: string; at: string }> =>
  'field' in c ? [{ field: c.field, at }]
  : 'all' in c ? c.all.flatMap((x, i) => fieldsOf(x, `${at}.all[${i}]`))
  : 'any' in c ? c.any.flatMap((x, i) => fieldsOf(x, `${at}.any[${i}]`))
  : fieldsOf(c.not, `${at}.not`);

const orderBands = (bands: Kb['riskBands']): OrderedBand[] =>
  Object.entries(bands).map(([id, b]) => ({ id, ...b })).sort((a, b) => a.min - b.min);

const consistencyProblems = (kb: Kb, ordered: readonly OrderedBand[]): string[] => {
  const requestFields = new Set(Object.keys(quoteRequestSchema.shape));
  const allowedTokens = new Set<string>(summaryTokens);
  const ids = kb.factors.map((f) => f.id);
  return [
    // 4. unique ids
    ...ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `factors: duplicate id "${id}"`),
    // 5. bands start at 0, contiguous, no overlap
    ...(ordered[0]?.min === 0 ? [] : [`riskBands.${ordered[0]?.id}: lowest band must start at 0`]),
    ...ordered.slice(1).flatMap((b, i) => {
      const prev = ordered[i];
      return prev && b.min !== prev.max + 1 ? [`riskBands.${b.id}.min: expected ${prev.max + 1} after riskBands.${prev.id}.max`] : [];
    }),
    ...ordered.flatMap((b) => templateTokens(b.summary).filter((t) => !allowedTokens.has(t)).map((t) => `riskBands.${b.id}.summary: unknown token {${t}}`)),
    // 6. every condition.field is a request field
    ...kb.factors.flatMap((f, i) =>
      fieldsOf(f.condition, `factors[${i}].condition`)
        .filter(({ field }) => !requestFields.has(field))
        .map(({ field, at }) => `${at}.field: "${field}" is not a quote request field`),
    ),
  ];
};

export const parseKb = (raw: string, source: string): LoadedKb => {
  let json: unknown;
  try {
    json = JSON.parse(raw); // 1. JSON parses
  } catch (err) {
    throw new KbValidationError(source, [`not valid JSON: ${err instanceof Error ? err.message : String(err)}`]);
  }
  const shape = kbSchema.safeParse(json); // 3. shape, including operator params
  if (!shape.success) {
    throw new KbValidationError(source, shape.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }
  const kb = shape.data;
  if (!supportedSchemaVersions.includes(kb.schemaVersion)) { // 2. schemaVersion gate
    throw new KbValidationError(source, [`schemaVersion: ${kb.schemaVersion} is not supported (supported: ${supportedSchemaVersions.join(', ')})`]);
  }
  const orderedBands = orderBands(kb.riskBands);
  const problems = consistencyProblems(kb, orderedBands);
  if (problems.length) throw new KbValidationError(source, problems);
  return { ...kb, orderedBands };
};

let current: LoadedKb | undefined;

/** Cached. Throws KbValidationError on the first load if the KB is bad. */
export const loadKb = (): LoadedKb => (current ??= parseKb(readFileSync(kbPath(), 'utf8'), kbPath()));

/** Re-reads the file. On success swaps atomically; on failure keeps the last good KB and returns the error. */
export const reloadKb = (): { ok: true; kb: LoadedKb } | { ok: false; error: Error; kb: LoadedKb | undefined } => {
  try {
    current = parseKb(readFileSync(kbPath(), 'utf8'), kbPath());
    return { ok: true, kb: current };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)), kb: current };
  }
};
```

Parse `schemaVersion` before the full shape if a future schema version changes the shape so much that Zod errors would hide the real cause. With only version 1 supported, the order above gives the best messages.

`server.ts` (the `lambda-handler` skill) owns the `fs.watchFile` call and logs `reloadKb()` failures. The loader never watches files itself.

Note the `kb → quote/request` import for check 6. It is deliberate: the request schema is the one source of field names. The reverse import must never exist.

## Response types (`quote/response.ts`)

```ts
export interface AppliedFactor {
  readonly id: string;
  readonly description: string; // KB wording, shown verbatim by the UI
  readonly points: number;      // awarded, after perOccurrence
  readonly occurrences: number;
}

export interface CoverageDetails {
  readonly basePremium: number;
  readonly riskMultiplier: number;
  readonly coverageLoadFactor: number;
  readonly sumInsured: number;
  readonly items: ReadonlyArray<{ readonly id: string; readonly description: string }>;
}

export interface QuoteResponse {
  readonly monthlyPremium: number;
  readonly annualPremium: number;
  readonly riskBand: string;
  readonly riskBandLabel: string;
  readonly riskScore: number;
  readonly riskSummary: string;
  readonly coverageDetails: CoverageDetails;
  readonly appliedFactors: readonly AppliedFactor[];
  readonly kbVersion: string;
}
```

## Service (`quote/service.ts`)

The one place the formula lives. `12` (months) and `100` (pence rounding) are calendar and currency facts, not scoring values, so they may live here but never in `engine/`.

```ts
import { findBand } from '../engine/band';
import { scoreRisk } from '../engine/score';
import { interpolate } from '../engine/template';
import type { LoadedKb } from '../kb/types';
import type { QuoteRequest } from './request';
import type { QuoteResponse } from './response';

export const summaryTokens = ['score', 'factorCount', 'label'] as const;

const MONTHS_PER_YEAR = 12;
const toPounds = (n: number): number => Math.round(n * 100) / 100;

export const getQuote = (request: QuoteRequest, kb: LoadedKb): QuoteResponse => {
  const { customerName: _unscored, ...riskInput } = request; // never scored, never logged
  const { score, appliedFactors } = scoreRisk(riskInput, kb);
  const band = findBand(score, kb.orderedBands);
  const annual = kb.basePremium * band.riskMultiplier * kb.coverageLoadFactor;

  return {
    monthlyPremium: toPounds(annual / MONTHS_PER_YEAR),
    annualPremium: toPounds(annual),
    riskBand: band.id,
    riskBandLabel: band.label,
    riskScore: score,
    riskSummary: interpolate(band.summary, { score, factorCount: appliedFactors.length, label: band.label }),
    coverageDetails: {
      basePremium: kb.basePremium,
      riskMultiplier: band.riskMultiplier,
      coverageLoadFactor: kb.coverageLoadFactor,
      sumInsured: request.propertyValue,
      items: kb.coverage?.items ?? [],
    },
    appliedFactors,
    kbVersion: kb.version,
  };
};
```

`summaryTokens` sits in the service, which fills them, and the loader imports it. If that import creates a cycle (`service → request`, `loader → service`), move `summaryTokens` into `engine/template.ts` or its own `quote/summary-tokens.ts`.

## Specs

Engine specs build KBs in memory with a helper, so each test states exactly the rules it depends on. Only the loader spec and one "real KB" smoke test read `risk-kb.json`.

```ts
// engine/test-kb.ts (test helper, not shipped)
import { parseKb } from '../kb/loader';
import type { Kb, LoadedKb } from '../kb/types';

export const baseKb: Kb = {
  version: 'test', schemaVersion: 1, basePremium: 300, coverageLoadFactor: 1.2,
  riskBands: {
    STANDARD: { min: 0, max: 25, riskMultiplier: 1.0, label: 'STANDARD', summary: '{label}: {score}' },
    ELEVATED: { min: 26, max: 60, riskMultiplier: 1.5, label: 'ELEVATED', summary: '{label}: {score}' },
    HIGH_RISK: { min: 61, max: 999, riskMultiplier: 2.2, label: 'HIGH RISK', summary: '{label}: {score}' },
  },
  factors: [],
};

export const kbWith = (patch: Partial<Kb>): LoadedKb => parseKb(JSON.stringify({ ...baseKb, ...patch }), 'test');
```

Numbers in test helpers and fixtures are fine: the no-numbers gate covers `src/engine/*.ts` files that ship. The gate in the skill's definition of done already excludes `*.spec.ts` and `test-kb.ts`.

Cases to cover, as `test.each` tables where the shape repeats:

| Spec | Cases |
|---|---|
| `operators.spec.ts` | each operator true and false; `starts_with` is case-insensitive; a numeric operator on a string value is `false` |
| `evaluate.spec.ts` | leaf; `all` true/false; `any` true/false; `not`; nested `all` inside `any` |
| `score.spec.ts` | disabled factor skipped; `perOccurrence` with 1, 2, 3 and 5 claims; compound "Flat AND > €500k" |
| `band.spec.ts` | 0, 25, 26, 60, 61, 999, 1000 (clamped, warns) |
| `loader.spec.ts` | the real KB loads; bad JSON; unsupported `schemaVersion`; unknown operator; bad params (`between` without `max`); duplicate id; band gap; band not starting at 0; unknown field; `perOccurrence` on a group; unknown summary token. Each asserts the message contains the path |
| `service.spec.ts` | one request per band with hand-computed premiums (e.g. 300 × 1.5 × 1.2 = 540.00, monthly 45.00); `kbVersion` passed through; `customerName` absent from the scoring input |
| configurability proof (owned by `kb-driven-tests`, as JSON patch fixtures in `backend/test/configurability/`) | the same request against `kbWith(...)`: add a flood-zone `starts_with` factor, change a weight 15 → 20, remove a factor. Each changes the result; no engine file changes |

For the loader, set `KB_PATH` to a fixture and use `jest.isolateModules` to reset the cache, or call `parseKb` directly, which needs no file.
