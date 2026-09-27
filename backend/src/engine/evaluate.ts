import type { AllCondition, AnyCondition, Condition, LeafCondition, NotCondition } from '../kb/types';
import { operators } from './operators';

/** The scoring input: request fields by name. The engine never names a field; it reads `condition.field` from the KB. */
export type RiskInput = Readonly<Record<string, unknown>>;

export const isLeaf = (c: Condition): c is LeafCondition => 'field' in c && 'operator' in c;
const isAll = (c: Condition): c is AllCondition => 'all' in c;
const isAny = (c: Condition): c is AnyCondition => 'any' in c;
const isNot = (c: Condition): c is NotCondition => 'not' in c;

/** A group node is named by its key; anything else is a leaf. Same rule as kb/schema.ts uses to validate. */
const groupKeys = ['all', 'any', 'not'] as const;
type NodeKind = (typeof groupKeys)[number] | 'leaf';
const kindOf = (c: Condition): NodeKind => groupKeys.find((k) => Object.hasOwn(c, k)) ?? 'leaf';

/**
 * One evaluator per node kind, looked up by kindOf(): a lookup table, not a switch or an if/else chain.
 * Leaves dispatch again through the operator registry, so neither a new operator nor a new factor touches this file.
 */
const evaluators: Readonly<Record<NodeKind, (c: Condition, input: RiskInput) => boolean>> = {
  leaf: (c, input) => isLeaf(c) && operators[c.operator].matches(input[c.field], c),
  all: (c, input) => isAll(c) && c.all.every((x) => evaluate(x, input)),
  any: (c, input) => isAny(c) && c.any.some((x) => evaluate(x, input)),
  not: (c, input) => isNot(c) && !evaluate(c.not, input),
};

/** Evaluates a KB condition tree (leaf, all, any, not, nested to any depth) against the input. */
export const evaluate = (condition: Condition, input: RiskInput): boolean => evaluators[kindOf(condition)](condition, input);
