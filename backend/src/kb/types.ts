// Generated from risk-kb.json (see AGENT_LOG). The brief's example keys are kept verbatim;
// `// +` marks our additions. These interfaces are the source of truth: kb/schema.ts is checked against them.
import type { OperatorName } from '../engine/operators';
import type { Currency } from '../quote/market';

/**
 * A single-field test. Operator params sit flat on the leaf, exactly as in the brief:
 * `{ "field": "previousClaims", "operator": "between", "min": 1, "max": 2 }`.
 * Which params are required is defined per operator by the registry.
 */
export interface LeafCondition {
  readonly field: string;
  readonly operator: OperatorName;
  readonly [param: string]: unknown;
}
export interface AllCondition { readonly all: readonly Condition[] } // + AND
export interface AnyCondition { readonly any: readonly Condition[] } // + OR
export interface NotCondition { readonly not: Condition }            // + NOT
export type Condition = LeafCondition | AllCondition | AnyCondition | NotCondition;

export interface Factor {
  readonly id: string;
  readonly description: string; // customer-facing, shown verbatim in the UI; the brief's wording, used for GBP
  /** + Wording for another currency's market, e.g. `{ "EUR": "Property value over €750,000" }`. Falls back to `description`. */
  readonly descriptions?: Readonly<Partial<Record<Currency, string>>>;
  readonly condition: Condition;
  readonly points: number;
  /** Awards points × the value of the condition's field (e.g. 2 claims × 15). Leaf conditions only. */
  readonly perOccurrence?: boolean;
  readonly enabled?: boolean; // + defaults to true
}

export interface RiskBand {
  readonly min: number;
  readonly max: number;
  readonly riskMultiplier: number; // +
  readonly label: string;          // + badge wording, e.g. "HIGH RISK" for key HIGH_RISK
  readonly summary: string;        // + plain-English template with {tokens}
}

export interface CoverageItem { readonly id: string; readonly description: string } // +

export interface Kb {
  readonly version: string;
  readonly schemaVersion: number; // + KB shape version, gated by the loader
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
