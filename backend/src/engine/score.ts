import type { Factor, LoadedKb } from '../kb/types';
import { evaluate, isLeaf, type RiskInput } from './evaluate';

/** A factor that contributed to the score, as returned in the API's `appliedFactors`. */
export interface AppliedFactor {
  readonly id: string;
  readonly description: string; // KB wording, shown verbatim by the UI
  readonly points: number;      // awarded, after perOccurrence
  readonly occurrences: number; // 1 unless perOccurrence
}

/** The total score and the factors that made it up. The sum of `appliedFactors[].points` is `score`. */
export interface RiskScore {
  readonly score: number;
  readonly appliedFactors: readonly AppliedFactor[];
}

/** perOccurrence awards points × the value of the condition's field (e.g. 2 claims). The loader restricts it to numeric leaf fields. */
const occurrencesOf = (factor: Factor, input: RiskInput): number => {
  if (!factor.perOccurrence || !isLeaf(factor.condition)) return 1;
  const value = input[factor.condition.field];
  if (typeof value !== 'number') {
    throw new Error(`Factor "${factor.id}" is perOccurrence but field "${factor.condition.field}" is not numeric`);
  }
  return value;
};

/** Iterates the enabled KB factors, keeps those whose condition matches, and sums their points. */
export const scoreRisk = (input: RiskInput, kb: LoadedKb): RiskScore => {
  const appliedFactors = kb.factors
    .filter((f) => f.enabled !== false && evaluate(f.condition, input))
    .map((f): AppliedFactor => {
      const occurrences = occurrencesOf(f, input);
      return { id: f.id, description: f.description, points: f.points * occurrences, occurrences };
    });
  return { score: appliedFactors.reduce((sum, f) => sum + f.points, 0), appliedFactors };
};
