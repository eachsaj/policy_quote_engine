# Handler pattern

Read this before you write or change `handler.ts`, `server.ts`, `quote/request.ts` or the `Dockerfile`. Copy the shape. Adjust names only when the code that already exists uses different ones.

## Event and result types (`backend/src/http/types.ts`)

These are a structural subset of API Gateway proxy types, defined locally so the backend has no AWS dependency. A real Lambda event still satisfies them.

```ts
export interface HttpEvent {
  httpMethod: string;
  path: string;
  body: string | null;
  headers?: Record<string, string | undefined>;
}

export interface HttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface HandlerContext {
  awsRequestId: string;
}
```

## Request schema (`backend/src/quote/request.ts`)

The request schema is the only place the request shape is declared. The type comes from `z.infer`, so no interface is written by hand. Field names must match the `condition.field` values used in `risk-kb.json`. Check them with:

```bash
node -e 'const kb=require("./risk-kb.json");const f=new Set();const w=c=>c.field?f.add(c.field):[...(c.all??[]),...(c.any??[]),...(c.not?[c.not]:[])].forEach(w);kb.factors.forEach(x=>w(x.condition));console.log([...f])'
```

```ts
import { z } from 'zod';

// Exactly the brief's form options. Do not add options the brief lacks.
export const propertyTypes = ['House', 'Flat', 'Bungalow'] as const;

const eircode = /^[ACDEFHKNPRTVWXY]\d[\dW] ?[\dACDEFHKNPRTVWXY]{4}$/i;

// The brief's six form fields, in form order (specs/tech-stack.md "Request contract").
export const quoteRequestSchema = z.object({
  customerName: z.string().trim().min(1).max(100), // required by the form; not a scoring input, never logged
  age: z.number().int().min(18).max(120),
  propertyType: z.enum(propertyTypes),
  propertyValue: z.number().positive(),
  postcode: z.string().trim().regex(eircode, 'Must be a valid Eircode').transform((p) => p.toUpperCase()),
  previousClaims: z.number().int().min(0).max(20), // in the last 5 years
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
```

Postcodes are upper-cased here so a KB `starts_with ["T12","N37"]` matches `"t12 x70a"`. The frontend's `models/quote.ts` and form validators mirror this schema (`angular-signals-component`); change both in the same turn.

## Handler (`backend/src/handler.ts`)

Routing is a lookup map, like the operator registry: no `switch` and no if/else chain over paths. The handler does protocol work only: parse, validate, route, build the response envelope. Scoring lives in `getQuote`.

```ts
import type { HandlerContext, HttpEvent, HttpResult } from './http/types';
import { loadKb } from './kb/loader';
import { quoteRequestSchema } from './quote/request';
import { getQuote } from './quote/service';

const corsHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const respond = (statusCode: number, payload: unknown): HttpResult => ({
  statusCode,
  headers: corsHeaders,
  body: payload === undefined ? '' : JSON.stringify(payload),
});

const parseJson = (body: string | null): { ok: true; value: unknown } | { ok: false } => {
  if (body === null || body.trim() === '') return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false };
  }
};

const postQuote = (event: HttpEvent): HttpResult => {
  const json = parseJson(event.body);
  if (!json.ok) return respond(400, { error: 'Request body must be a JSON object' });

  const parsed = quoteRequestSchema.safeParse(json.value);
  if (!parsed.success) {
    return respond(400, {
      error: 'Validation failed',
      issues: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  return respond(200, getQuote(parsed.data, loadKb()));
};

const getHealth = (): HttpResult => {
  const kb = loadKb();
  return respond(200, { status: 'ok', kbVersion: kb.version, schemaVersion: kb.schemaVersion, factorCount: kb.factors.length });
};

const routes: Record<string, (event: HttpEvent) => HttpResult> = {
  'POST /policy/quote': postQuote,
  'GET /health': getHealth,
  'OPTIONS /policy/quote': () => respond(204, undefined),
};

export const handler = async (event: HttpEvent, context: HandlerContext): Promise<HttpResult> => {
  const route = routes[`${event.httpMethod.toUpperCase()} ${event.path}`];
  if (!route) return respond(404, { error: `No route for ${event.httpMethod} ${event.path}` });
  try {
    return route(event);
  } catch (err) {
    // KB load or validation failure. The loader already names the bad field.
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(JSON.stringify({ requestId: context.awsRequestId, error: message }));
    return respond(500, { error: 'Quote engine unavailable', requestId: context.awsRequestId });
  }
};
```

Response codes:

| Case | Status | Body |
|---|---|---|
| valid request | 200 | full `QuoteResponse`, including `kbVersion` |
| missing, empty or non-JSON body | 400 | `{ error }` |
| Zod failure | 400 | `{ error, issues: [{ field, message }] }` |
| unknown route | 404 | `{ error }` |
| KB unreadable or invalid | 500 | `{ error, requestId }`, with no internal details in the body |

## Local adapter (`backend/src/server.ts`)

This adapter is only a translator. It builds an `HttpEvent`, calls `handler` and writes the result. It contains no routing, no validation and no business logic. It loads the KB before it listens, so a bad KB fails at startup rather than on the first request.

It also owns the KB hot reload the live demo depends on. `fs.watchFile` polls the file's stat, which works across Docker Desktop bind mounts where inotify events are unreliable. A valid edit is swapped in atomically by `reloadKb()`; an invalid one is logged to stderr and the last good KB keeps serving.

```ts
import { randomUUID } from 'node:crypto';
import { watchFile } from 'node:fs';
import { createServer } from 'node:http';
import { handler } from './handler';
import { kbPath, loadKb, reloadKb } from './kb/loader';

const port = Number(process.env.PORT ?? 3000);

loadKb(); // fail fast: throws with a descriptive message on an invalid KB

watchFile(kbPath(), { interval: 500 }, () => {
  const result = reloadKb();
  if (result.ok) console.log(JSON.stringify({ event: 'kb reloaded', kbVersion: result.kb.version }));
  else console.error(JSON.stringify({ event: 'kb reload rejected; last good KB still serving', error: result.error.message }));
});

createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    void handler(
      { httpMethod: req.method ?? 'GET', path: url.pathname, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : null },
      { awsRequestId: randomUUID() },
    ).then((result) => res.writeHead(result.statusCode, result.headers).end(result.body));
  });
}).listen(port, () => console.log(`PolicyQuote backend on http://localhost:${port}`));
```

`package.json`:

```json
"scripts": {
  "start": "tsx src/server.ts",
  "build": "tsc -p tsconfig.build.json",
  "test": "jest",
  "typecheck": "tsc --noEmit"
}
```

## Handler spec (`backend/src/handler.spec.ts`)

Call `handler` directly with a hand-built event. Don't start the HTTP server.

```ts
import { handler } from './handler';
import type { HttpEvent } from './http/types';

const ctx = { awsRequestId: 'test' };
const validRequest = { customerName: 'A Customer', age: 40, propertyType: 'House', propertyValue: 250000, postcode: 'D02 X285', previousClaims: 0 };
const post = (body: unknown): HttpEvent => ({ httpMethod: 'POST', path: '/policy/quote', body: JSON.stringify(body) });

it('returns 200 with the full response shape', async () => {
  const res = await handler(post(validRequest), ctx);
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual(expect.objectContaining({
    monthlyPremium: expect.any(Number), annualPremium: expect.any(Number), riskBand: expect.any(String),
    riskScore: expect.any(Number), riskSummary: expect.any(String), coverageDetails: expect.anything(),
    riskBandLabel: expect.any(String), appliedFactors: expect.any(Array), kbVersion: expect.any(String),
  }));
  expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
});

it('returns 400 with field issues for an invalid body', async () => {
  const res = await handler(post({ ...validRequest, age: 12 }), ctx);
  expect(res.statusCode).toBe(400);
  const body = JSON.parse(res.body) as { issues: Array<{ field: string; message: string }> };
  expect(body.issues).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'age' })]));
});

it('returns 400 for a missing body', async () => {
  const res = await handler({ httpMethod: 'POST', path: '/policy/quote', body: null }, ctx);
  expect(res.statusCode).toBe(400);
});

it('reports the KB version on /health', async () => {
  const res = await handler({ httpMethod: 'GET', path: '/health', body: null }, ctx);
  expect(JSON.parse(res.body)).toEqual(expect.objectContaining({ status: 'ok', kbVersion: expect.any(String) }));
});
```

Also cover: 404 for an unknown route (with CORS headers), 204 for `OPTIONS /policy/quote`, and `riskBandLabel` in the 200 shape. For the 500 path, point `KB_PATH` at a malformed fixture and reset the loader cache with `jest.isolateModules`.

## Dockerfile (bonus: multi-stage, Fargate-deployable, `GET /health` with the KB version)

This follows `specs/tech-stack.md` "Containers". It is Fargate-ready (stateless, env config, stdout/stderr logs, health endpoint) but only ever runs locally.

```dockerfile
FROM node:22.23-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22.23-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 KB_PATH=/app/kb/risk-kb.json
COPY backend/package*.json ./
# find: npm --omit=dev leaves empty @scope dirs of dev packages behind; remove them so the image looks as lean as it is
RUN npm ci --omit=dev && npm cache clean --force && find node_modules -mindepth 1 -type d -empty -delete
COPY --from=build /app/dist ./dist
# Default KB baked in; docker-compose bind-mounts the repo root directory over /app/kb for live edits.
COPY risk-kb.json ./kb/risk-kb.json
USER node
EXPOSE 3000
# alpine has no curl; use Node's fetch
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
```

Build from the repo root so `risk-kb.json` is in the build context: `docker build -f backend/Dockerfile -t policyquote-backend .`

Compose mounts the **directory**, not the single file: editors save by atomic rename, and a single-file bind mount keeps the old inode, so the container would never see the edit. The runtime image must not contain `tsx`, `typescript` or `jest`.
