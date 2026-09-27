---
name: lambda-handler
description: Builds and changes the PolicyQuote backend API surface, a Lambda-style Node.js handler that runs locally with no AWS involved. Use for anything touching backend/src/handler.ts, server.ts, quote/request.ts, http/types.ts or backend/Dockerfile. That includes the POST /policy/quote endpoint, handler(event, context), Zod request validation, 400/500 error responses, CORS, GET /health, the local server on :3000, npm start for the backend and the Docker image. Use it even when the request only says "add a field to the quote request", "the API returns the wrong status" or "make the backend start".
---

# Lambda-style handler

The backend exports `handler(event, context)` in the shape of an API Gateway proxy handler, but it is not deployed to AWS. A thin local `http` adapter turns requests into events and calls the same handler, so local dev and "Lambda" share one code path. The backend makes no network calls.

This skill covers the protocol layer only. Scoring lives in `quote/service.ts` and `engine/*`; use the `risk-engine` skill for those.

## Before you write code

1. Read the specs: `specs/tech-stack.md` "Backend" (the request contract table, "Loading the KB correctly", the API table) and "Containers"; `specs/roadmap.md` Phase 3 and Phase 7 with their "Done when" checks.
2. Read `references/handler-pattern.md` and copy its shape: local event/result types, route map, response envelope, adapter with hot reload, spec, Dockerfile.
3. Read `risk-kb.json`. The request schema's field names must match the `condition.field` values the factors use (the reference has a one-liner that lists them). If a factor reads a field the schema lacks, the loader rejects the KB.
4. The request is exactly the brief's six form fields: `customerName`, `age`, `propertyType` (`House` / `Flat` / `Bungalow` only), `propertyValue`, `postcode`, `previousClaims` (last 5 years). Keep `frontend/src/app/models/quote.ts` and the form validators in step with `quote/request.ts`.

## Rules

- Types: `HttpEvent`, `HttpResult` and `HandlerContext` are local interfaces. `QuoteRequest` is `z.infer<typeof quoteRequestSchema>`. Parse the body as `unknown` and narrow it with Zod. Never use `any`, including on the event, the context, `JSON.parse` results or caught errors.
- Routing is a `Record<"METHOD /path", fn>` lookup. No `switch` and no if/else chain over method or path.
- The handler does protocol work only: parse, validate, route, build the envelope, map errors. No scoring numbers, band logic or KB field names in it.
- `server.ts` only translates between HTTP and events. No routing, no validation and no framework: no Express, Fastify, Koa or Hono.
- Every response gets the CORS headers, including 400, 404 and 500.
- A KB failure is a 500 with a generic message and a `requestId`. Log the detail to stderr, never into the response body. `server.ts` calls `loadKb()` before it listens, so a bad KB fails at startup.
- `POST /policy/quote` is the brief's single business endpoint. `GET /health` (returns `kbVersion`) is a supporting endpoint, kept by decision. Don't add other routes.
- **KB hot reload:** `server.ts` watches `kbPath()` with `fs.watchFile` (stat polling, so it also works across Docker bind mounts) and calls `reloadKb()`. A valid edit swaps in atomically; an invalid one is logged and the last good KB keeps serving.
- **No outbound calls.** The backend never calls an LLM or any external API, and the KB is only ever read from the local file at `KB_PATH` (brief constraint 5). No `fetch`, `http.request`, `axios` or SDK clients in `backend/src`.
- `npm start` runs `tsx src/server.ts` on `PORT` (default 3000). It is the one command that starts the backend (brief constraint 6). The frontend proxy expects `/policy` and `/health` on that port.

## Reject these outputs

| Output | Why |
|---|---|
| `event: any`, `JSON.parse(body)` used untyped, `catch (e: any)` | loses the "no `any`" line (Code 10) |
| Express, Fastify or other middleware routing in `server.ts` | creates a second code path, and the "Lambda-style" claim no longer holds |
| `switch (event.path)` or an if/else ladder over routes | goes against the table-driven design the panel looks for |
| Premium or band maths in `handler.ts` | business logic in the transport layer, and hides it from engine tests |
| `@types/aws-lambda` or `aws-sdk` added as a dependency | there is no AWS here; local structural types are enough |
| `err.message` or a stack trace in a 500 body | leaks internals |
| Property types other than `House` / `Flat` / `Bungalow`, or a request without `customerName` | drifts from the brief's form; KB factors on `propertyType` stop matching |
| `fetch`, `axios`, an LLM/SDK client, or loading the KB from a URL | the brief's constraint 5: deterministic, self-contained, local KB file |
| Restarting the server to pick up a KB edit, or a single-file KB bind mount in compose | breaks the live demo's hot reload |
| Dockerfile running as root, without `HEALTHCHECK`, or with `tsx` in the runtime image | not the Fargate-ready image `tech-stack.md` specifies |

## Definition of done

Run all of these and report the output. Don't claim success without it.

```bash
cd backend && npx tsc --noEmit
cd backend && npx jest src/handler.spec.ts
cd backend && npm run lint
grep -nE ':\s*any\b|as any|switch\s*\(|express|fastify|koa|hono|aws-lambda|aws-sdk' backend/src/handler.ts backend/src/server.ts backend/src/quote/request.ts backend/package.json   # must print nothing
grep -rnE 'fetch\(|https?\.request|axios|openai|anthropic' backend/src                                    # must print nothing (constraint 5)
```

Then, with `cd backend && npm start` running:

```bash
curl -s localhost:3000/health                                                # 200, kbVersion present
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' -d '{"age":12}'   # 400 with issues[]
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' -d @backend/requests/standard.json   # 200, full shape + kbVersion
```

Repeat the last call for `elevated.json` and `high-risk.json`. Then, without restarting, edit a factor's `points` in `risk-kb.json`: the next quote changes. Save invalid JSON: the reload is logged as rejected and quotes keep working. Revert the edit.

Finish with an `agent-log` entry, and record anything from the reject table that the first draft contained.
