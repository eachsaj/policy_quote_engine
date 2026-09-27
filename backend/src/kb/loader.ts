import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { templateTokens } from '../engine/template';
import { quoteRequestSchema, unscoredFields } from '../quote/request';
import { summaryTokens } from '../quote/summary-tokens';
import { kbSchema } from './schema';
import type { Condition, Factor, Kb, LoadedKb, OrderedBand } from './types';

/** KB shapes this code understands. A breaking KB shape bumps `schemaVersion` and is rejected until code supports it. */
export const supportedSchemaVersions: readonly number[] = [1];

export class KbValidationError extends Error {
  constructor(source: string, readonly problems: readonly string[]) {
    super(`Invalid KB at ${source}:\n  - ${problems.join('\n  - ')}`);
    this.name = 'KbValidationError';
  }
}

/** `KB_PATH` wins; otherwise the repo-root KB, one level above the backend package. */
export const kbPath = (): string => resolve(process.env.KB_PATH ?? resolve(process.cwd(), '..', 'risk-kb.json'));

const requestShape = quoteRequestSchema.shape;
const isRequestField = (field: string): field is keyof typeof requestShape => Object.hasOwn(requestShape, field);

/** Every leaf field in a condition tree, with the JSON path of its leaf. Structural recursion over the node kinds. */
const leavesOf = (c: Condition, at: string): Array<{ field: string; at: string }> =>
  'field' in c ? [{ field: c.field, at }]
  : 'all' in c ? c.all.flatMap((x, i) => leavesOf(x, `${at}.all[${i}]`))
  : 'any' in c ? c.any.flatMap((x, i) => leavesOf(x, `${at}.any[${i}]`))
  : leavesOf(c.not, `${at}.not`);

/** Band order comes from `min`, never from object key order. */
const orderBands = (bands: Kb['riskBands']): OrderedBand[] =>
  Object.entries(bands).map(([id, b]) => ({ id, ...b })).sort((a, b) => a.min - b.min);

const uniqueIdProblems = (kb: Kb): string[] => {
  const ids = kb.factors.map((f) => f.id);
  return ids.flatMap((id, i) => (ids.indexOf(id) === i ? [] : [`factors[${i}].id: duplicate id "${id}"`]));
};

const bandProblems = (ordered: readonly OrderedBand[]): string[] => {
  const allowedTokens = new Set<string>(summaryTokens);
  return [
    ...(ordered[0]?.min === 0 ? [] : [`riskBands.${ordered[0]?.id}.min: the lowest band must start at 0`]),
    ...ordered.flatMap((b) => (b.max >= b.min ? [] : [`riskBands.${b.id}.max: must be >= min`])),
    ...ordered.slice(1).flatMap((b, i) => {
      const prev = ordered[i];
      return prev && b.min !== prev.max + 1
        ? [`riskBands.${b.id}.min: expected ${prev.max + 1} to follow riskBands.${prev.id}.max (bands must be contiguous, no gaps or overlaps)`]
        : [];
    }),
    ...ordered.flatMap((b) =>
      templateTokens(b.summary)
        .filter((t) => !allowedTokens.has(t))
        .map((t) => `riskBands.${b.id}.summary: unknown token {${t}} (allowed: ${summaryTokens.join(', ')})`),
    ),
  ];
};

/** perOccurrence multiplies points by the field's value, so that field must be numeric. */
const perOccurrenceProblem = (f: Factor, i: number): string[] => {
  if (!f.perOccurrence || !('field' in f.condition)) return [];
  const { field } = f.condition;
  if (!isRequestField(field)) return []; // already reported as an unknown field
  return requestShape[field] instanceof z.ZodNumber ? [] : [`factors[${i}].perOccurrence: field "${field}" is not numeric`];
};

/** Every condition must read a request field that is actually scored. */
const fieldProblems = (kb: Kb): string[] =>
  kb.factors.flatMap((f, i) => {
    const leaves = leavesOf(f.condition, `factors[${i}].condition`);
    const unknown = leaves.filter(({ field }) => !isRequestField(field))
      .map(({ field, at }) => `${at}.field: "${field}" is not a quote request field`);
    const unscored = leaves.filter(({ field }) => unscoredFields.has(field))
      .map(({ field, at }) => `${at}.field: "${field}" is collected but never scored`);
    return [...unknown, ...unscored, ...perOccurrenceProblem(f, i)];
  });

/**
 * Parses and validates KB text. Checks, each reported with the offending JSON path:
 * 1. the JSON parses; 2. `schemaVersion` is supported; 3. the shape is valid, including each
 * operator's params; 4. factor ids are unique; 5. bands sorted by `min` start at 0 and are
 * contiguous; 6. every `condition.field` is a quote request field.
 */
export const parseKb = (raw: string, source: string): LoadedKb => {
  let json: unknown;
  try {
    json = JSON.parse(raw); // 1
  } catch (err) {
    throw new KbValidationError(source, [`not valid JSON: ${err instanceof Error ? err.message : String(err)}`]);
  }

  // 2 runs before the full shape, so a KB written for another schema version gets one clear message.
  const declared = z.object({ schemaVersion: z.number().int() }).safeParse(json);
  if (declared.success && !supportedSchemaVersions.includes(declared.data.schemaVersion)) {
    throw new KbValidationError(source, [
      `schemaVersion: ${declared.data.schemaVersion} is not supported (supported: ${supportedSchemaVersions.join(', ')})`,
    ]);
  }

  const shape = kbSchema.safeParse(json); // 3
  if (!shape.success) {
    throw new KbValidationError(source, shape.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
  }

  const kb = shape.data;
  const orderedBands = orderBands(kb.riskBands);
  const problems = [...uniqueIdProblems(kb), ...bandProblems(orderedBands), ...fieldProblems(kb)]; // 4, 5, 6
  if (problems.length > 0) throw new KbValidationError(source, problems);

  return { ...kb, orderedBands };
};

let current: LoadedKb | undefined;

/** The active KB, read once and cached. Throws KbValidationError if the KB is invalid. */
export const loadKb = (): LoadedKb => (current ??= parseKb(readFileSync(kbPath(), 'utf8'), kbPath()));

/** Re-reads the KB file. A valid KB is swapped in atomically; an invalid one leaves the last good KB serving. */
export const reloadKb = (): { ok: true; kb: LoadedKb } | { ok: false; error: Error; kb: LoadedKb | undefined } => {
  try {
    current = parseKb(readFileSync(kbPath(), 'utf8'), kbPath());
    return { ok: true, kb: current };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)), kb: current };
  }
};
