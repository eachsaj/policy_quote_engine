import { z } from 'zod';

const expectation = z.strictObject({
  riskScore: z.number(),
  riskBand: z.string().optional(),
  appliedFactorIds: z.array(z.string()),
  annualPremium: z.number().optional(),
  monthlyPremium: z.number().optional(),
});
export type Expectation = z.infer<typeof expectation>;

/** One whole-quote case: `request` holds only the fields that differ from `_base.json`. */
export const scenarioSchema = z.strictObject({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  expect: expectation,
  why: z.string().min(1), // the hand-worked arithmetic, from the KB
});
export const scenarioFileSchema = z.array(scenarioSchema).min(1);
export type Scenario = z.infer<typeof scenarioSchema>;

const patchOp = z.discriminatedUnion('op', [
  // `factor` stays loose on purpose: the patched KB goes through the real parseKb, which validates it like the file.
  z.object({ op: z.literal('addFactor'), factor: z.record(z.string(), z.unknown()) }),
  z.object({ op: z.literal('setPoints'), id: z.string(), points: z.number() }),
  z.object({ op: z.literal('removeFactor'), id: z.string() }),
]);
export type PatchOp = z.infer<typeof patchOp>;

export const configurabilitySchema = z.strictObject({
  name: z.string().min(1),
  request: z.record(z.string(), z.unknown()),
  patch: z.array(patchOp).min(1),
  before: expectation,
  after: expectation,
  why: z.string().min(1),
});
