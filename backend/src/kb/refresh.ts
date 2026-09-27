import { statSync } from 'node:fs';
import { kbPath, loadKb, reloadKb } from './loader';
import type { LoadedKb } from './types';

// KB refresh for a long-lived Lambda container, where server.ts and its file watcher don't run.
// With KB_REFRESH_SECONDS set, the handler stats KB_PATH at most once per interval and reloads
// when the file's mtime changes, so a KB published to the mounted file goes live without a
// redeploy or a cold start. Unset or 0 turns it off; the local server watches the file instead.

const MS_PER_SECOND = 1000;

const refreshIntervalMs = (): number => {
  const seconds = Number(process.env['KB_REFRESH_SECONDS'] ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * MS_PER_SECOND : 0;
};

let lastCheckAt = 0;
let lastMtimeMs: number | undefined;

/** Logs a reload the same way wherever it happens: server.ts's watcher or the handler's refresh. */
export const reportReload = (result: ReturnType<typeof reloadKb>): void => {
  if (result.ok) {
    console.log(JSON.stringify({ event: 'kb reloaded', kbVersion: result.kb.version, factorCount: result.kb.factors.length }));
  } else {
    console.error(JSON.stringify({ event: 'kb reload rejected; last good KB still serving', error: result.error.message }));
  }
};

/**
 * The KB to serve for this invocation. Checks the file at most once per KB_REFRESH_SECONDS; a changed
 * file goes through reloadKb(), so an invalid or unsupported KB is rejected and the last good KB keeps serving.
 */
export const currentKb = (now: number = Date.now()): LoadedKb => {
  const kb = loadKb();
  const interval = refreshIntervalMs();
  if (interval === 0 || now - lastCheckAt < interval) return kb;
  lastCheckAt = now;

  let mtimeMs: number;
  try {
    mtimeMs = statSync(kbPath()).mtimeMs;
  } catch (err) {
    // The file is missing mid-publish: keep serving what is loaded and look again next interval.
    console.error(JSON.stringify({ event: 'kb refresh skipped; last good KB still serving', error: err instanceof Error ? err.message : String(err) }));
    return kb;
  }
  // The first check reloads too: the file may have changed since the cold-start load.
  const changed = mtimeMs !== lastMtimeMs;
  lastMtimeMs = mtimeMs;
  if (!changed) return kb;

  const result = reloadKb();
  reportReload(result);
  return result.kb ?? kb;
};

/** Test hook: forget the last check, as a fresh container would. */
export const resetKbRefresh = (): void => {
  lastCheckAt = 0;
  lastMtimeMs = undefined;
};
