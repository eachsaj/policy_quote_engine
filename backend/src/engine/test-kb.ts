// Test helper, not shipped (excluded in tsconfig.build.json and from the numbers gate).
// Engine specs build KBs in memory so each test states exactly the rules it depends on.
import { parseKb } from '../kb/loader';
import type { Kb, LoadedKb } from '../kb/types';

export const baseKb: Kb = {
  version: 'test',
  schemaVersion: 1,
  basePremium: 300,
  coverageLoadFactor: 1.2,
  riskBands: {
    STANDARD: { min: 0, max: 25, riskMultiplier: 1.0, label: 'STANDARD', summary: '{label}: {score}' },
    ELEVATED: { min: 26, max: 60, riskMultiplier: 1.5, label: 'ELEVATED', summary: '{label}: {score}' },
    HIGH_RISK: { min: 61, max: 999, riskMultiplier: 2.2, label: 'HIGH RISK', summary: '{label}: {score}' },
  },
  factors: [],
};

/** A validated in-memory KB: the base plus a patch, run through the real loader checks. */
export const kbWith = (patch: Partial<Kb>): LoadedKb => parseKb(JSON.stringify({ ...baseKb, ...patch }), 'test');
