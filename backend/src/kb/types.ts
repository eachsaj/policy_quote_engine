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
/** + Matches when every child matches (AND), e.g. "Flat AND value over £500k". */
export interface AllCondition { readonly all: readonly Condition[] }
/** + Matches when at least one child matches (OR). */
export interface AnyCondition { readonly any: readonly Condition[] }
/** + Matches when its child does not (NOT). */
export interface NotCondition { readonly not: Condition }
/** A factor's condition: a leaf, or a group nested to any depth. The node kind is named by its key. */
export type Condition = LeafCondition | AllCondition | AnyCondition | NotCondition;

/** One risk rule: when `condition` matches the request, the quote gains `points`. */
export interface Factor {
  readonly id: string; // snake_case, unique; stable across edits so fixtures and history line up
  readonly description: string; // customer-facing, shown verbatim in the UI; the brief's wording, used for GBP
  /** + Wording for another currency's market, e.g. `{ "EUR": "Property value over €750,000" }`. Falls back to `description`. */
  readonly descriptions?: Readonly<Partial<Record<Currency, string>>>;
  readonly condition: Condition;
  readonly points: number; // an integer
  /** Awards points × the value of the condition's field (e.g. 2 claims × 15). Leaf conditions only. */
  readonly perOccurrence?: boolean;
  readonly enabled?: boolean; // + defaults to true
}

/** A score range and how it prices. Bands must start at 0 and be contiguous (checked by the loader). */
export interface RiskBand {
  readonly min: number; // inclusive
  readonly max: number; // inclusive; the brief's top band uses 999
  readonly riskMultiplier: number; // +
  readonly label: string;          // + badge wording, e.g. "HIGH RISK" for key HIGH_RISK
  readonly summary: string;        // + plain-English template with {tokens}
}

/** + A line of cover listed in the quote's coverageDetails, e.g. "Buildings cover". */
export interface CoverageItem { readonly id: string; readonly description: string }

/** The whole knowledge base, as in risk-kb.json. Every scoring number lives here, never in code. */
export interface Kb {
  readonly version: string; // the rule-set version, returned as kbVersion on every quote
  readonly schemaVersion: number; // + KB shape version, gated by the loader
  readonly basePremium: number;        // annual premium = basePremium × band riskMultiplier × coverageLoadFactor
  readonly coverageLoadFactor: number;
  readonly riskBands: Readonly<Record<string, RiskBand>>; // keyed by band id, e.g. HIGH_RISK
  readonly coverage?: { readonly items: readonly CoverageItem[] }; // +
  readonly factors: readonly Factor[];
}

/** A band with its id attached, in ascending `min` order. Built by the loader. */
export interface OrderedBand extends RiskBand { readonly id: string }

/** What the engine receives: the validated KB plus loader-derived data. */
export interface LoadedKb extends Kb { readonly orderedBands: readonly OrderedBand[] }
