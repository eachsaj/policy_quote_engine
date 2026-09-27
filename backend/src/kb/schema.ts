import { z } from 'zod';
import { operatorNames, operators } from '../engine/operators';
import type { Condition, Kb } from './types';

/**
 * A leaf condition. The operator must be in the registry, and its params (flat on the leaf)
 * are validated by that operator's own schema, so this file never lists operators by hand.
 */
const leafSchema = z
  .looseObject({
    field: z.string().min(1),
    operator: z.enum(operatorNames, { error: (issue) => `unknown operator ${JSON.stringify(issue.input)}` }),
  })
  .superRefine((leaf, ctx) => {
    const result = operators[leaf.operator].params.safeParse(leaf);
    result.error?.issues.forEach((i) =>
      ctx.addIssue({ code: 'custom', path: i.path, message: `${leaf.operator}: ${i.message}` }),
    );
  });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Recursive condition tree: a leaf, or an all (AND) / any (OR) / not group, nested to any depth.
 *
 * The node kind is picked by key presence from a lookup table, then validated against that one
 * schema. A plain z.union would report a bad node as a bare "Invalid input" with no path; this
 * way the error names the branch that was meant, e.g. `factors.3.condition.all.1.operator`.
 */
export const conditionSchema: z.ZodType<Condition> = z.custom<Condition>().superRefine((node, ctx) => {
  const kind = isRecord(node) ? groupKinds.find((g) => Object.hasOwn(node, g.key)) : undefined;
  (kind?.schema ?? leafSchema).safeParse(node).error?.issues.forEach((i) =>
    ctx.addIssue({ code: 'custom', path: i.path, message: i.message }),
  );
});

const groupKinds: ReadonlyArray<{ key: string; schema: z.ZodType }> = [
  { key: 'all', schema: z.strictObject({ all: z.array(conditionSchema).min(1) }) },
  { key: 'any', schema: z.strictObject({ any: z.array(conditionSchema).min(1) }) },
  { key: 'not', schema: z.strictObject({ not: conditionSchema }) },
];

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
  riskBands: z.record(z.string(), bandSchema).refine((b) => Object.keys(b).length > 0, 'at least one band is required'),
  coverage: z.object({ items: z.array(z.object({ id: z.string().min(1), description: z.string().min(1) })) }).optional(),
  factors: z.array(factorSchema),
}) satisfies z.ZodType<Kb>;
