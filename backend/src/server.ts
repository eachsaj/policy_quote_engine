import { randomUUID } from 'node:crypto';
import { watchFile } from 'node:fs';
import { createServer } from 'node:http';
import { handler } from './handler';
import { kbPath, loadKb, reloadKb } from './kb/loader';
import { reportReload } from './kb/refresh';

// A translator only: HTTP request → HttpEvent → handler → HTTP response.
// No routing, no validation, no framework, so local runs and "Lambda" share one code path.

const port = Number(process.env['PORT'] ?? 3000);
/** How often the watcher stats the KB file: fast enough that an edit is live before the next quote in a demo. */
const KB_POLL_MS = 500;

// Fail fast: a bad KB stops the server at startup with the loader's named error.
try {
  loadKb();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

// Hot reload for the live demo. Stat polling (not inotify) also works across Docker bind mounts.
// A valid edit is swapped in atomically; an invalid one is logged and the last good KB keeps serving.
watchFile(kbPath(), { interval: KB_POLL_MS }, () => reportReload(reloadKb()));

createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    void handler(
      {
        httpMethod: req.method ?? 'GET',
        path: url.pathname,
        body: chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : null,
      },
      { awsRequestId: randomUUID() },
    ).then((result) => res.writeHead(result.statusCode, result.headers).end(result.body));
  });
}).listen(port, () => {
  console.log(`PolicyQuote backend on http://localhost:${port} (KB ${loadKb().version} from ${kbPath()})`);
});
