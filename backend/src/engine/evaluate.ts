import type { AllCondition, AnyCondition, Condition, LeafCondition } from '../kb/types';
import { operators } from './operators';

/** The scoring input: request fields by name. The engine never names a field; it reads `condition.field` from the KB. */
export type RiskInput = Readonly<Record<string, unknown>>;

export const isLeaf = (c: Condition): c is LeafCondition => 'field' in c && 'operator' in c;
const isAll = (c: Condition): c is AllCondition => 'all' in c;
const isAny = (c: Condition): c is AnyCondition => 'any' in c;

/**
 * Evaluates a KB condition against the input. This is structural recursion over the four node
 * kinds (leaf, all, any, not); operator dispatch is a registry lookup, never a switch.
 */
export const evaluate = (condition: Condition, input: RiskInput): boolean => {
  if (isLeaf(condition)) return operators[condition.operator].matches(input[condition.field], condition);
  if (isAll(condition)) return condition.all.every((c) => evaluate(c, input));
  if (isAny(condition)) return condition.any.some((c) => evaluate(c, input));
  return !evaluate(condition.not, input);
};
