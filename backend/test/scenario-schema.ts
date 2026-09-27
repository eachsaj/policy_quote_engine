import { z } from 'zod';
import { currencies } from '../src/quote/market';

// Zod schemas for the JSON test fixtures, so a malformed fixture fails with its file name and path.

/** What a quote must come out as. Optional fields are only checked when a fixture gives them. */
const expectation = z.strictObject({
  riskScore: z.number(),
  riskBand: z.string().optional(),
  appliedFactorIds: z.array(z.string()),
  annualPremium: z.number().optional(),
  monthlyPremium: z.number().optional(),
  currency: z.enum(currencies).optional(),
  descriptions: z.record(z.string(), z.string()).optional(), // factor id → wording the customer sees
});
/** An expectation, as expectMatches() checks it. */
export type Expectation = z.infer<typeof expectation>;

/** One whole-quote case: `request` holds only the fields that differ from `_base.json`. */
export const scenarioSchema = z.strictObject({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  expect: expectation,
  why: z.string().min(1), // the hand-worked arithmetic, from the KB
});
/** A scenario file: `backend/test/scenarios/<factor_id>.json`, one or more cases. */
export const scenarioFileSchema = z.array(scenarioSchema).min(1);

/** A data-only edit applied to an in-memory copy of the frozen baseline KB. Never a code change. */
const patchOp = z.discriminatedUnion('op', [
  // `factor` stays loose on purpose: the patched KB goes through the real parseKb, which validates it like the file.
  z.object({ op: z.literal('addFactor'), factor: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal('setPoints'), id: z.string(), points: z.number() }),
  z.object({ op: z.literal('removeFactor'), id: z.string() }),
]);
/** One patch operation, dispatched through a lookup table in the configurability runner. */
export type PatchOp = z.infer<typeof patchOp>;

/** A configurability proof: the same request before and after a KB patch, and the result must differ. */
export const configurabilitySchema = z.strictObject({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  patch: z.array(patchOp).min(1),
  before: expectation,
  after: expectation,
  why: z.string().min(1),
});
