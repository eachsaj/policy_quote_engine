import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { loadKb, reloadKb } from './loader';

// How KB versions behave without redeploying (brief bonus): the same loadKb/reloadKb the server's
// file watcher calls, against a KB file at KB_PATH that is edited in place.

const realKb = z.looseObject({ version: z.string(), schemaVersion: z.number(), factors: z.array(z.unknown()) })
  .parse(JSON.parse(readFileSync(resolve(__dirname, '../../../risk-kb.json'), 'utf8')) as unknown);

let dir: string;
let kbFile: string;
const write = (kb: unknown): void => writeFileSync(kbFile, JSON.stringify(kb));

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pq-kb-'));
  kbFile = join(dir, 'risk-kb.json');
  process.env['KB_PATH'] = kbFile;
  write(realKb);
  loadKb();
});
afterAll(() => {
  delete process.env['KB_PATH'];
  rmSync(dir, { recursive: true, force: true });
});

describe('KB versioning', () => {
  it('serves a new rule-set version as soon as the file changes (version bump, same schemaVersion)', () => {
    write({ ...realKb, version: '9.1.0' });
    const result = reloadKb();
    expect(result.ok).toBe(true);
    expect(loadKb().version).toBe('9.1.0');
  });

  it('accepts additive changes: unknown keys from a newer KB are ignored, not fatal', () => {
    write({ ...realKb, version: '9.2.0', owner: 'underwriting', changelog: ['added a note'] });
    expect(reloadKb().ok).toBe(true);
    expect(loadKb().version).toBe('9.2.0');
  });

  it('rejects a breaking schemaVersion it does not support, and keeps the last good KB serving', () => {
    write({ ...realKb, version: '10.0.0', schemaVersion: 2 });
    const result = reloadKb();

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error.message).toContain('schemaVersion: 2 is not supported (supported: 1)');
    expect(loadKb().version).toBe('9.2.0'); // last good KB, still serving
  });

  it('recovers when a valid KB is published again', () => {
    write({ ...realKb, version: '9.3.0' });
    expect(reloadKb().ok).toBe(true);
    expect(loadKb().version).toBe('9.3.0');
  });
});
