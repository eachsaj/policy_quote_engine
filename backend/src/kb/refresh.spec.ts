import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { handler } from '../handler';
import { resetKbRefresh } from './refresh';

// A deployed Lambda runs handler.ts without server.ts's file watcher. These tests call the handler the
// way a warm container would, with the clock under test control, and publish KB files to KB_PATH.

const realKb = z.looseObject({ version: z.string(), schemaVersion: z.number(), factors: z.array(z.unknown()) })
  .parse(JSON.parse(readFileSync(resolve(__dirname, '../../../risk-kb.json'), 'utf8')) as unknown);

let dir: string;
let kbFile: string;
let clock: number;
let mtime = 1_000_000;

/** Writes the KB and moves its mtime forward, as a publish would. */
const publish = (kb: unknown): void => {
  writeFileSync(kbFile, JSON.stringify(kb));
  mtime += 60;
  utimesSync(kbFile, mtime, mtime);
};
const servedVersion = async (): Promise<string> => {
  const res = await handler({ httpMethod: 'GET', path: '/health', body: null }, { awsRequestId: 'test' });
  return z.object({ kbVersion: z.string() }).parse(JSON.parse(res.body) as unknown).kbVersion;
};
const advance = (seconds: number): void => {
  clock += seconds * 1000;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pq-refresh-'));
  kbFile = join(dir, 'risk-kb.json');
  process.env['KB_PATH'] = kbFile;
  publish({ ...realKb, version: '1.0.0' });
});
beforeEach(() => {
  clock = 5_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  resetKbRefresh();
});
afterEach(() => {
  jest.restoreAllMocks();
  delete process.env['KB_REFRESH_SECONDS'];
});
afterAll(() => {
  delete process.env['KB_PATH'];
  rmSync(dir, { recursive: true, force: true });
});

describe('KB refresh in a warm Lambda container (KB_REFRESH_SECONDS)', () => {
  it('is off by default: the container keeps the KB it loaded at cold start', async () => {
    expect(await servedVersion()).toBe('1.0.0');
    publish({ ...realKb, version: '1.1.0' });
    advance(3600);
    expect(await servedVersion()).toBe('1.0.0');
  });

  it('serves a newly published KB once the interval has passed, and not before', async () => {
    process.env['KB_REFRESH_SECONDS'] = '30';
    const loaded = await servedVersion(); // first check records the file's mtime
    publish({ ...realKb, version: '1.2.0' });

    advance(10);
    expect(await servedVersion()).toBe(loaded); // inside the interval: no stat, no reload
    advance(30);
    expect(await servedVersion()).toBe('1.2.0');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"kbVersion":"1.2.0"'));
  });

  it('rejects an unsupported schemaVersion and keeps the last good KB serving, then recovers', async () => {
    process.env['KB_REFRESH_SECONDS'] = '30';
    publish({ ...realKb, version: '1.3.0' });
    await servedVersion();
    advance(30);
    expect(await servedVersion()).toBe('1.3.0');

    publish({ ...realKb, version: '2.0.0', schemaVersion: 2 });
    advance(30);
    expect(await servedVersion()).toBe('1.3.0');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('schemaVersion: 2 is not supported'));

    publish({ ...realKb, version: '1.4.0' });
    advance(30);
    expect(await servedVersion()).toBe('1.4.0');
  });

  it('keeps serving when the file is missing mid-publish', async () => {
    process.env['KB_REFRESH_SECONDS'] = '30';
    const loaded = await servedVersion();
    rmSync(kbFile);
    advance(30);
    expect(await servedVersion()).toBe(loaded);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('kb refresh skipped'));
    publish({ ...realKb, version: loaded });
  });
});
