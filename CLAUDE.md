# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Phases 1–8 are done: the app works end to end, the KB is at 1.2.0 with the compound `flat_high_value` and `flood_zone` factors, and KB versioning is tested and documented in `README.md`. Backend: `risk-kb.json`, `engine/*`, `kb/*`, `quote/*`, `http/types.ts`, `handler.ts`, `server.ts` with KB hot reload, `backend/requests/*.json`. Frontend: `models/quote.ts`, `QuoteService`, the reactive form, `QuotePageComponent` (the three signals), `QuoteResultComponent` and `RiskBandBadgeComponent`. Phase 7 (Docker) is done: `backend/Dockerfile`, `frontend/Dockerfile` + `nginx.conf`, `docker-compose.yml`. Phase 8 (audit, final `SOLUTION.md`, `specs/review-prep.md` with the Q&A and demo script) is done. Phases 0–8 are merged to `main` (PRs #1–#5). After Phase 8 there is a root `npm start` (`scripts/start.mjs`) that runs both services, and an Irish localisation: amounts in euro and `postcode` validated as an Eircode (AGENT_LOG #26, #27). Everything else below is still the planned design (see `specs/roadmap.md` for the next phase). Check that a path exists before relying on it, and update this file as the code lands.

## Sources of truth

- The brief, `Exercise_PolicyQuote 1- AIG.pdf` (outside the repo), is the requirement document. It wins over everything below.
- `specs/mission.md` (scope, deliverables, success criteria), `specs/tech-stack.md` (every design decision, with the rubric line it serves) and `specs/roadmap.md` (phases, "Done when" checks, requirement coverage matrix) hold the agreed decisions. Don't re-decide them. If a request conflicts with them, stop and ask, then update the spec in the same turn.

## What this is

PolicyQuote is a single-page home insurance quote tool: an Angular frontend (`frontend/`) and a Lambda-style Node.js/TypeScript backend (`backend/`), both driven by a JSON risk knowledge base (`risk-kb.json` at the repo root, a first-class artifact). It is a graded exercise. `AGENT_LOG.md` and the agent workflow count toward the grade, and the skills cite rubric lines R1–R6 (for example "KB design 25", "Agent workflow 20").

## The brief's constraints (non-negotiable)

1. Angular uses Signals for all UI state (`loading`, `quoteResult`, `errorMessage`). No `BehaviorSubject` or `Subject` for local UI state.
2. The backend exports a `handler(event, context)` Lambda-compatible function.
3. Scoring is KB-driven. No scoring values (points, thresholds, multipliers, band ranges, base premium, load factor) in application code.
4. No UI component libraries (Material, PrimeNG, Bootstrap, and by decision no Tailwind). Hand-written CSS only.
5. No LLM or external API calls from the backend. Scoring is deterministic, and the KB is a local file read from `KB_PATH`, never a remote service.
6. Each service starts with a single `npm start`.
7. `AGENT_LOG.md` records every significant agent interaction: prompt, output, change, reasoning.
8. `SOLUTION.md`, max 300 words: architecture decisions, KB design choices, the agent skill configuration rationale (from the brief's Deliverables), and one thing to improve.

## Planned architecture

- **KB-driven scoring.** Extend the brief's example KB, never reshape it: keep every key and value (`riskBands` as an object with `min`/`max` including `999`, all five factors verbatim), and make additions only (`schemaVersion`, per-band `riskMultiplier` / `label` / `summary`, `coverage`, optional `enabled`, compound `all` / `any` / `not` conditions). Operators are resolved through a registry, never a `switch`. `backend/src/kb/loader.ts` (`loadKb()`, `reloadKb()`, honouring `KB_PATH`) validates the KB and throws an error naming the JSON path.
- **Backend layers** (`backend/src/`):
  - `http/types.ts`: local `HttpEvent`, `HttpResult` and `HandlerContext` types, a structural subset of API Gateway. There is no AWS dependency.
  - `handler.ts`: `handler(event, context)` handles protocol only (JSON parse, Zod validation, a `Record<"METHOD /path", fn>` route map, CORS on every response, error mapping). `POST /policy/quote` is the single business endpoint; `GET /health` (returns `kbVersion`) is a supporting endpoint kept by decision; plus `OPTIONS /policy/quote`.
  - `server.ts`: a plain `node:http` adapter that turns requests into events. It has no framework, routing or validation. It calls `loadKb()` before it listens, and hot-reloads the KB with `fs.watchFile`, keeping the last good KB on an invalid edit. In a deployed Lambda (no `server.ts`), `kb/refresh.ts` `currentKb()` re-checks `KB_PATH` every `KB_REFRESH_SECONDS` (off by default), and the handler uses it instead of `loadKb()`.
  - `quote/request.ts`: the Zod `quoteRequestSchema` is the single source of the request shape: the brief's six fields `customerName`, `age`, `propertyType` (`House` / `Flat` / `Bungalow`), `propertyValue`, `postcode` (an Irish Eircode, upper-cased; amounts are in euro), `previousClaims`. Field names must match the `condition.field` values used in the KB.
  - `quote/service.ts` (`getQuote(request, kb)`) and `engine/*`: all scoring and band logic, as pure functions.
- **Response shape:** the brief's `monthlyPremium`, `annualPremium`, `riskBand`, `riskScore`, `riskSummary`, `coverageDetails`, `appliedFactors`, plus our additions `riskBandLabel` and `kbVersion`. Errors: 400 `{ error, issues: [{ field, message }] }`, 404 `{ error }`, and 500 `{ error, requestId }` with no internal details (those go to stderr).
- **Frontend:** Angular 17+ (latest CLI), standalone, zoneless, OnPush, Reactive Forms, RxJS `HttpClient` for `POST /policy/quote`. `frontend/src/app/models/quote.ts` and the six-field form validators must stay in step with `quote/request.ts`. The dev proxy (wired into `angular.json`) forwards `/policy` and `/health` to port 3000, so `npm start` alone works.
- **Containers (bonus):** multi-stage backend and frontend images and `docker-compose.yml`, all run locally, never deployed. See `specs/tech-stack.md` "Containers".

## Hard rules

- No `any` anywhere, including events, `JSON.parse` results and caught errors. Parse to `unknown` and narrow with Zod.
- No `switch` or if/else ladders over routes, operators, factor ids or band ids. Use lookup tables.
- No Express, Fastify, Koa or Hono, and no `@types/aws-lambda` or `aws-sdk`.
- No outbound network calls in `backend/src` (`fetch`, `http.request`, `axios`, LLM SDKs).
- No scoring numbers or KB field names in `engine/` or `handler.ts`.
- **Upstream Angular skills are overridden where they conflict with the brief.** Ignore `angular-developer`'s Signal Forms and `httpResource` defaults, and `angular-new-app`'s Tailwind step and global CLI install (use `npx @angular/cli`). `angular-signals-component` holds the override table.

## Commands (planned)

```bash
npm start                        # from the repo root: backend + frontend together (scripts/start.mjs)

cd backend
npm start                        # tsx src/server.ts on PORT (default 3000)
npm test                         # jest
npx jest src/handler.spec.ts     # single test file
npx jest -t "returns 400"        # single test by name
npm run typecheck                # tsc --noEmit
npm run lint                     # no-explicit-any, switch ban, no-magic-numbers in engine/
npm run build                    # tsc -p tsconfig.build.json -> dist/

cd frontend && npm start         # ng serve on :4200, proxied to :3000
docker compose up --build        # from the repo root: whole app on :8080, KB directory mounted for live edits
```

Quality gates (from `specs/tech-stack.md`); each must print nothing:

```bash
grep -rnE --exclude='*.spec.ts' --exclude='test-kb.ts' '\b[0-9]+\.[0-9]+\b|\b([2-9]|[1-9][0-9]+)\b' backend/src/engine | grep -vE '^\S+:[0-9]+:\s*(//|/?\*)'
grep -rnE 'fetch\(|https?\.request|axios|openai|anthropic' backend/src
grep -rnE 'BehaviorSubject|\bSubject\b|NgModule' frontend/src/app
grep -nE 'material|primeng|bootstrap|tailwind' frontend/package.json
```

This lists the fields the KB conditions reference. Run it from the repo root:

```bash
node -e 'const kb=require("./risk-kb.json");const f=new Set();const w=c=>c.field?f.add(c.field):[...(c.all??[]),...(c.any??[]),...(c.not?[c.not]:[])].forEach(w);kb.factors.forEach(x=>w(x.condition));console.log([...f])'
```

## Agent workflow

- Follow the per-phase protocol in `specs/roadmap.md`: a specific prompt naming the skill, files and definition of done; review against the skill's reject table; record rejections; run the "Done when" checks; log; commit with `(log #N)` in the message.
- After every significant change (code generated or rewritten, a KB edit, a design decision, a rejected output), add an entry to `AGENT_LOG.md` with `bash .claude/skills/agent-log/scripts/new_entry.sh "Title"`, then fill in every `TODO`. Entries are written in the same turn as the work, never backfilled or rewritten. The "Rejected / corrected" field matters most.
- Project skills (in `.claude/skills/`, the project-local location; global skills live in `~/.claude/skills/`): `lambda-handler` (backend API surface, hot reload, Dockerfile), `risk-engine` (`engine/*`, `kb/*`, `quote/service.ts`), `kb-factor` (KB-only factor changes, the live-demo skill), `kb-driven-tests` (JSON scenario fixtures, configurability proof, coverage check under `backend/test/`), `angular-signals-component` (`frontend/src/app`: signal state, reactive form, results, badge), `agent-log`, and the upstream `angular-developer` and `angular-new-app`.
