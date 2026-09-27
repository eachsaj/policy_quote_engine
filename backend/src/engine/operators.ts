import { z } from 'zod';

/**
 * The operator registry: the only place operators exist.
 *
 * Each entry pairs a Zod schema for the operator's params (which sit flat on the KB leaf,
 * as in the brief: `{ "field", "operator", "min", "max" }` or `{ "field", "operator", "value" }`)
 * with a pure test. The KB schema validates leaf params through this registry, so an unknown
 * operator or bad params fail at load. Adding an operator is one entry here and nothing else.
 */
const defineOperator = <S extends z.ZodType>(params: S, test: (value: unknown, p: z.output<S>) => boolean) => ({
  params,
  /** The KB is validated at load, so a failed parse here is a bug; it never matches rather than throwing mid-quote. */
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
const valueList = z.object({ values: z.array(scalar).min(1) });
const prefixList = z.object({ values: z.array(z.string().min(1)).min(1) });

export const operators = {
  eq: defineOperator(single, (v, p) => v === p.value),
  neq: defineOperator(single, (v, p) => v !== p.value),
  gt: defineOperator(numeric, (v, p) => num(v) && v > p.value),
  gte: defineOperator(numeric, (v, p) => num(v) && v >= p.value),
  lt: defineOperator(numeric, (v, p) => num(v) && v < p.value),
  lte: defineOperator(numeric, (v, p) => num(v) && v <= p.value),
  /** Inclusive at both ends. */
  between: defineOperator(range, (v, p) => num(v) && v >= p.min && v <= p.max),
  /** Exclusive: the bounds themselves do not match ("under min or over max"). */
  outside_range: defineOperator(range, (v, p) => num(v) && (v < p.min || v > p.max)),
  in: defineOperator(valueList, (v, p) => p.values.some((x) => x === v)),
  /** Case-insensitive prefix match against any of `values` (e.g. area codes). */
  starts_with: defineOperator(
    prefixList,
    (v, p) => typeof v === 'string' && p.values.some((prefix) => v.toUpperCase().startsWith(prefix.toUpperCase())),
  ),
} as const;

export type OperatorName = keyof typeof operators;

// The one `as` in this layer: Object.keys loses the literal key type of the object it describes.
export const operatorNames = Object.keys(operators) as [OperatorName, ...OperatorName[]];

export const isOperatorName = (name: string): name is OperatorName => Object.hasOwn(operators, name);
