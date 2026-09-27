# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

The repo has no application code yet. Only the project skills under `.claude/skills/` exist. The layout and commands below come from those skills, which describe the planned design. Check that a path exists before relying on it, and update this file as the code lands.

## What this is

PolicyQuote is a home insurance quote service: an Angular frontend (`frontend/`) and a Lambda-style Node.js/TypeScript backend (`backend/`), both driven by a JSON risk knowledge base (`risk-kb.json` at the repo root). It is a graded exercise. `AGENT_LOG.md` and the agent workflow count toward the grade, and the skills cite rubric lines such as "Code 10" and "Agent workflow 20".

## Planned architecture

- **KB-driven scoring.** `risk-kb.json` holds `version`, `schemaVersion` and `factors[]`. Each factor has a `condition` tree (`field`, or nested `all` / `any` / `not`). Multipliers, bands and thresholds belong in the KB, not in code. Operators are resolved through a registry/lookup map, never a `switch`. `backend/src/kb/loader.ts` (`loadKb()`, which honours the `KB_PATH` env var) validates the KB and throws a descriptive error.
- **Backend layers** (`backend/src/`):
  - `http/types.ts`: local `HttpEvent`, `HttpResult` and `HandlerContext` types, a structural subset of API Gateway. There is no AWS dependency.
  - `handler.ts`: `handler(event, context)` handles protocol only (JSON parse, Zod validation, a `Record<"METHOD /path", fn>` route map, CORS on every response, error mapping). Routes are `POST /policy/quote`, `GET /health` (returns `kbVersion`) and `OPTIONS /policy/quote`.
  - `server.ts`: a plain `node:http` adapter that turns requests into events. It has no framework, routing or validation. It calls `loadKb()` before it listens, so a bad KB fails at startup.
  - `quote/request.ts`: the Zod `quoteRequestSchema` is the single source of the request shape (`QuoteRequest = z.infer<...>`). Its field names must match the `condition.field` values used in the KB.
  - `quote/service.ts` (`getQuote(request, kb)`) and `engine/*`: all scoring and band logic.
- **Response shape:** `monthlyPremium`, `annualPremium`, `riskBand`, `riskScore`, `riskSummary`, `coverageDetails`, `appliedFactors`, `kbVersion`. Errors: 400 `{ error, issues: [{ field, message }] }`, 404 `{ error }`, and 500 `{ error, requestId }` with no internal details (those go to stderr).
- **Frontend:** Angular with signals. `frontend/src/app/models/quote.ts` and the six-field form validators must stay in step with `quote/request.ts`. The dev proxy forwards `/policy` and `/health` to the backend on port 3000.

## Hard rules (from the skills)

- No `any` anywhere, including events, `JSON.parse` results and caught errors. Parse to `unknown` and narrow with Zod.
- No `switch` or if/else ladders over routes or operators. Use lookup tables.
- No Express, Fastify, Koa or Hono, and no `@types/aws-lambda` or `aws-sdk`.
- Keep scoring numbers and KB field names out of `handler.ts`.

## Commands (backend, planned)

```bash
cd backend
npm start                        # tsx src/server.ts on PORT (default 3000)
npm test                         # jest
npx jest src/handler.spec.ts     # single test file
npx jest -t "returns 400"        # single test by name
npm run typecheck                # tsc --noEmit
npm run build                    # tsc -p tsconfig.build.json -> dist/
docker build -f backend/Dockerfile -t policyquote-backend .   # run from repo root so risk-kb.json is in context
```

This lists the fields the KB conditions reference. Run it from the repo root:

```bash
node -e 'const kb=require("./risk-kb.json");const f=new Set();const w=c=>c.field?f.add(c.field):[...(c.all??[]),...(c.any??[]),...(c.not?[c.not]:[])].forEach(w);kb.factors.forEach(x=>w(x.condition));console.log([...f])'
```

## Agent workflow

- After every significant change (code generated or rewritten, a KB edit, a design decision, a rejected output), add an entry to `AGENT_LOG.md` with `bash .claude/skills/agent-log/scripts/new_entry.sh "Title"`, then fill in every `TODO`. Entries are written in the same turn as the work, never backfilled or rewritten. The "Rejected / corrected" field matters most.
- Project skills (in `.claude/skills/`, the project-local location; global skills live in `~/.claude/skills/`): `lambda-handler` (backend API surface), `risk-engine` (`engine/*`, `kb/*`, `quote/service.ts`), `kb-factor` (KB-only factor changes, the live-demo skill), `kb-driven-tests` (JSON scenario fixtures, configurability proof, coverage check under `backend/test/`), `angular-signals-component` (`frontend/src/app`: signal state, reactive form, results, badge; overrides `angular-developer` where the brief differs), `agent-log`, `angular-developer`, `angular-new-app`. The skills also refer to a `PLAN.md`, which doesn't exist yet.
