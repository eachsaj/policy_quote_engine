import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// Shared by the KB-driven test runners (scenarios, configurability, coverage).

/** backend/test, where the fixture directories live. */
export const testDir = __dirname;

/** Reads a JSON file as `unknown`, for a Zod schema to narrow. */
export const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown;

/** Parses every non-underscore JSON file in a fixture directory; a malformed file fails with its name and path. */
export const loadDir = <S extends z.ZodType>(dir: string, schema: S): Array<{ file: string; data: z.output<S> }> =>
  readdirSync(join(testDir, dir))
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((file) => {
      const parsed = schema.safeParse(readJson(join(testDir, dir, file)));
      if (!parsed.success) {
        throw new Error(`${dir}/${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      }
      return { file, data: parsed.data };
    });

/** The shared base request from `scenarios/_base.json`. Runners spread a scenario's `request` over it, then parse the result with the real request schema. */
export const baseRequest = (): Record<string, unknown> =>
  z.record(z.string(), z.unknown()).parse(readJson(join(testDir, 'scenarios', '_base.json')));
