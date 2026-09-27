# Roadmap

The build order is **KB and engine first**, weighted by the evaluation rubric. Each phase is small, names the rubric areas it earns, ends in checks that can be verified, and closes with an `AGENT_LOG.md` entry and a commit that cites it. Don't start a phase until the previous one's "Done when" checks pass. Every requirement in the brief is traced to a phase in the [coverage matrix](#requirement-coverage-matrix) at the end.

## Rubric map

| # | Area | Pts | Phases that earn it |
|---|---|---|---|
| R1 | KB Design & Configurability | 25 | 1, 2, 6 |
| R2 | Agent Workflow & Skill Configuration | 20 | 0, every phase (log + skills), 8 |
| R3 | Angular Signals & Reactivity | 20 | 4, 5 |
| R4 | Lambda Handler & Risk Engine | 15 | 2, 3, 7 (container `/health`) |
| R5 | Code Quality & TypeScript | 10 | 1 (gates), every phase, 8 |
| R6 | Live Demo & Explanation | 10 | 3 (hot reload), 6, 7 (compose), 8 |

Effort is spent in proportion: R1 + R2 + R3 = 65 points, so those phases get the most care and the deepest tests.

## Per-phase agent protocol (R2)

Every phase follows the same loop, so the log shows intentional engineering:

1. **Prompt.** A specific prompt that names the skill, the files and the definition of done. Never "generate the app".
2. **Review.** Check the output against the skill's reject table and `specs/`.
3. **Reject or correct.** Record exactly what was thrown out and why.
4. **Verify.** Run the phase's "Done when" commands and paste the real results.
5. **Log and commit.** Run the `agent-log` entry, then commit with `(log #N)` in the message.

**Generating from the KB, not just boilerplate.** The brief asks the agent to "generate code from the Knowledge Base". This is done deliberately, and each instance gets its own log entry:
- **Phase 1:** KB interfaces and the Zod schema, generated from `risk-kb.json`.
- **Phase 2:** test scenario fixtures, generated from the KB's factors and bands.
- **Phase 4:** the frontend model, generated from the backend response types.
- **Phase 6:** new factors, added with the `kb-factor` skill.

## Phase 0: Repo and agent setup (R2)
- `git init`, `.gitignore`, first commit of `CLAUDE.md`, `.claude/`, `specs/`, `SOLUTION.md` draft and `AGENT_LOG.md`. Committing `CLAUDE.md` and `.claude/` also covers the agent-skill-file bonus.
- Fix the `lambda-handler` skill:
  - Property types become House / Flat / Bungalow.
  - Replace the placeholder request schema with the six-field contract from `tech-stack.md`, including `customerName` and postcode normalisation.
  - Update its Dockerfile section to the Containers spec in `tech-stack.md`: non-root, `HEALTHCHECK`, KB baked in by default and mounted by compose.
  - Add the KB consistency and hot-reload rules.
- Update `CLAUDE.md`: point to `specs/`, update the Docker commands (`docker compose up --build`), add the quality-gate commands, and add the rule "extend the brief's KB example, never reshape it".
- Write the `risk-engine` and `kb-factor` skills. Each gets triggers, a reject table and a runnable definition of done.

**Done when:** the repo is committed, the skills match `specs/`, and the log entry records what the agent drafted and what was corrected.

## Phase 1: KB schema, loader and quality gates (R1, R5)
- Backend scaffold: `package.json`, strict `tsconfig` (`noUncheckedIndexedAccess`), Jest, and ESLint with `no-explicit-any`, the `SwitchStatement` ban and `no-magic-numbers` (ignoring `0` and `1`) in `engine/`.
- Write `risk-kb.json` at the root **by extending the brief's example verbatim**:
  - Keep all five factors with their exact `id`, `description`, `condition`, `points` and `perOccurrence`.
  - Keep `riskBands` as an object with min/max, including `999`.
  - Add `riskMultiplier` (1.0 / 1.5 / 2.2), `label` ("STANDARD" / "ELEVATED" / "HIGH RISK") and a `summary` template to each band.
  - Add `schemaVersion` and `coverage`.
- **Generate from the KB:** the agent derives `kb/types.ts` (the leaf/group `Condition` union, `RiskBand`, `Factor`, `Kb`) from `risk-kb.json`, and the result is reviewed against the brief's example.
- `engine/operators.ts` registry: a Zod parameter schema and a `test` function per operator, including `starts_with` with a list of prefixes. It comes first here because the KB schema is built from it.
- `kb/schema.ts` and `kb/loader.ts`: the six load checks (JSON, `schemaVersion`, shape, unique ids, contiguous bands sorted by `min`, known fields), caching, and `KB_PATH`.
- Loader tests: the real KB loads, and each of the six failure types is rejected with a message naming the path.

**Done when:**
- `tsc`, `lint` and the loader tests pass.
- `risk-kb.json` is the only file that contains scoring numbers.
- Diffing the KB against the brief's example shows additions only.

## Phase 2: Risk engine (R1, R4)
- `engine/evaluate.ts`: recursive evaluation over leaf / `all` / `any` / `not`, with a type guard and no `switch`.
- `engine/score.ts`:
  - iterates the enabled factors
  - applies `perOccurrence` as points × field value
  - returns a typed `AppliedFactor[]` of `{ id, description, points, occurrences }`
- `engine/band.ts`: range lookup, with a score above the top `max` clamped into the top band and logged.
- `engine/template.ts`: `{token}` interpolation.
- **Generate from the KB** (`kb-driven-tests`): the agent creates JSON scenario fixtures from the KB's factors and bands, run through `test.each`:
  - **All 3 risk bands**, with at least one scenario each for STANDARD, ELEVATED and HIGH_RISK. This covers the brief's "3+ test cases".
  - Band boundaries 25/26 and 60/61.
  - `perOccurrence` maths (1, 2, 3 and 5 claims).
  - Each operator, including `not` and `any`.
  - A compound "Flat AND > £500k".
  - **Configurability proof**, matching the brief's three examples. The same engine runs against in-memory KBs where:
    - the flood-zone factor is added
    - the claims weight goes from 15 to 20
    - a factor is removed

    Each changes the result, and no engine file changes.

**Done when:** all engine tests pass, `lint` shows no `switch`, and the no-numbers grep over `engine/` is clean.

## Phase 3: Quote service, handler and local server (R4, R6)
- `quote/request.ts`: Zod with the six fields from the brief's form:
  - `customerName`: not scored, never logged.
  - `age`
  - `propertyType`: House / Flat / Bungalow.
  - `propertyValue`
  - `postcode`: trimmed and upper-cased.
  - `previousClaims`: in the last 5 years.
- The loader checks that every KB `condition.field` exists in this schema.
- `quote/response.ts`: the `QuoteResponse`, `AppliedFactor` and `CoverageDetails` interfaces.
- `quote/service.ts`:
  - `annualPremium = basePremium × riskMultiplier × coverageLoadFactor`, and `monthlyPremium = annual / 12`, rounded only at the response boundary.
  - `riskSummary` from the band template.
  - `coverageDetails`: the formula breakdown plus the KB coverage items.
  - `appliedFactors`, `riskBandLabel` and `kbVersion`.
- `http/types.ts` and `handler.ts`, which exports `handler(event, context)` with the route map, CORS, and 400/404/500 without internals.
- `POST /policy/quote` is the single business endpoint. `GET /health` is a supporting endpoint, kept by decision, that returns `kbVersion`.
- `server.ts`: `node:http` adapter, KB loaded before listen, **hot reload with last-good fallback**. The watcher uses stat polling (`fs.watchFile`), so it also works across Docker bind mounts. `npm start` = `tsx src/server.ts`. `npm run build` = `tsc -p tsconfig.build.json` → `dist/`, which the Docker image uses.
- `backend/requests/*.json`: sample bodies, one per band.
- `handler.spec.ts`: 200 shape, 400 issues, missing body, 404, 500 with a bad KB, and `/health`.

**Done when:**
- The `lambda-handler` definition of done passes: tsc, jest, grep, and curl for each sample.
- Editing `risk-kb.json` while the server runs changes the next quote.
- An invalid edit keeps the last good KB serving.

## Phase 4: Angular scaffold, form and signal state (R3)
- Scaffold `frontend/` with the latest CLI via `npx` (no global install): Angular 17+, standalone only (no NgModules), zoneless, OnPush, plain CSS, and no UI library. Skip `angular-new-app`'s Tailwind step. Add the ESLint `no-explicit-any` rule.
- `proxy.conf.json` wired into `angular.json`, so `npm start` alone serves the app with `/policy` and `/health` proxied to :3000.
- Write the `angular-signals-component` skill before building the components, and use it for them.
- **Generate from the backend contract:** the agent derives `models/quote.ts` from `quote/request.ts` and `quote/response.ts`, and the log records any drift it finds.
- `QuoteService`: RxJS `HttpClient` → `POST /policy/quote`.
- A reactive form with the brief's six fields:
  - customer name
  - age
  - property type (House / Flat / Bungalow)
  - property value (£)
  - postcode
  - previous claims in the last 5 years

  Validators mirror Zod, and the inline errors are accessible.
- `loading`, `quoteResult` and `errorMessage` as `signal()`. `canSubmit` as a `computed()` over `toSignal(statusChanges)` and `loading`.

**Done when:** `npm start` serves the form, a submit fills `quoteResult`, backend 400s show in `errorMessage`, and grep finds no `BehaviorSubject` or `Subject`.

## Phase 5: Results UI and KB-driven rendering (R3)
- `RiskBandBadgeComponent`: `input.required<string>()` for `riskBand` and an optional `label` input.
  - It displays the KB label, "STANDARD / ELEVATED / HIGH RISK", exactly as the brief shows it.
  - It styles itself through `data-band`, with a neutral fallback for unknown bands.
- Results panel:
  - Monthly and annual premium (£).
  - The badge.
  - The plain-English risk summary.
  - The **active risk factors applied**: an `@for` over `appliedFactors`, showing the KB `description` and points for each.
  - The coverage breakdown and `kbVersion`.
- `computed()` for sorted factors, total points and formatted £ premiums. `effect()` only moves focus to the results and announces them through `aria-live`.
- Hand-written responsive CSS (no Material, PrimeNG or Bootstrap), with loading, error and empty states.
- Tests: the badge for each band and for an unknown band, factor rows rendered from a mock response, and signal transitions (loading → result, and loading → error).

**Done when:** the three band samples render correctly in the browser, and a factor added to the KB appears in the UI with no frontend change.

## Phase 6: Bonus features and demo rehearsal (R1, R6)
- **Compound AND/OR:** the `flat_high_value` factor ("Flat AND value > £500k, +35") is added to the KB and shown working end to end with `compound.json`. An `any` (OR) example is covered by the tests.
- **KB versioning.** `kbVersion` shows in the quote response, `/health` and the UI.
  - Rehearse a `version` bump with hot reload.
  - **Show** how breaking schema changes are handled without redeploying, using the "KB versioning" section of the README and a test:
    - Additive KB changes are backward compatible.
    - A breaking shape bumps `schemaVersion`, and the loader rejects versions it doesn't support while the last good KB keeps serving. The test proves this.
    - A rollout uses expand/contract: ship code that reads N and N+1, then publish the N+1 KB.
    - In production, rule sets are versioned in git and promoted by a pipeline. The version is selected by `KB_PATH` or a pinned version pointer, with no Lambda redeploy.
- **Live-change rehearsal with the `kb-factor` skill:**
  - Add the flood-zone factor (`starts_with` EX or PL, +15) and its fixture.
  - Run the tests, the curl check and the UI check, with no code edits. Then revert.
  - Time the run.
  - Log the rehearsal honestly, including anything the agent got wrong.

**Done when:** the compound factor and the versioning are visible in the UI and API, the schema-gate test passes, and the rehearsal takes only KB and fixture edits.

## Phase 7: Containerisation (bonus Dockerfile; R4, R6)
- `backend/Dockerfile`, multi-stage, with the build context at the repo root:
  - **build:** `node:22-alpine`, `npm ci`, `npm run build`.
  - **runtime:** `node:22-alpine`, `npm ci --omit=dev`, `dist/`, and a default `risk-kb.json` baked in.
  - `USER node`, `PORT` and `KB_PATH` from env, and a `HEALTHCHECK` against `GET /health` using a Node `fetch` one-liner.
  - `CMD node dist/server.js`.
  - Fargate-ready (stateless, env config, stdout logs, health endpoint) but run locally only.
- `frontend/Dockerfile`, multi-stage: an Angular production build, then `nginx:alpine`. `nginx.conf` gives SPA fallback and proxies `/policy` and `/health` to `backend:3000`, on port 8080.
- `docker-compose.yml`:
  - `backend` builds from the root with `-f backend/Dockerfile`, maps port 3000, and bind-mounts the repo root **directory** read-only at `/app/kb`, which is the live KB.
  - `frontend` maps port 8080 and depends on `backend` being `service_healthy`.
- `.dockerignore` files for both build contexts.

**Done when:**
- `docker compose up --build` shows both containers healthy.
- `curl localhost:3000/health` returns `kbVersion`.
- The UI at `http://localhost:8080` quotes all three bands.
- Editing `risk-kb.json` on the host changes the next quote with no rebuild.
- `docker compose exec backend whoami` prints `node`.
- The backend runtime image contains no `tsx`, `typescript` or `jest`.

## Phase 8: Docs, audit and submission (R2, R5, R6)
- `README.md`:
  - **4 commands** to run both services (under 5): `npm --prefix backend install`, `npm --prefix backend start`, `npm --prefix frontend install`, `npm --prefix frontend start`.
  - **Docker path in 1 command:** `docker compose up --build`, then open `http://localhost:8080`. This section also explains the KB mount and the hot reload in the container.
  - The KB file location.
  - How to add a factor.
  - The KB versioning section.
- `SOLUTION.md` (≤ 300 words): re-check its four parts against the real implementation: architecture decisions, KB schema decisions, the agent skill rationale, and one improvement (data privacy protection). Add what the build actually delivered (hot reload, Docker) within the word limit.
- **Rubric self-audit:** walk through R1–R6 and the coverage matrix below against the running app and the code. Fix gaps before polishing.
- **AGENT_LOG review:** confirm it is chronological and each entry records prompt → output → change → why, with real rejections. Don't rewrite past entries; add corrections as new ones.
- Final gates: `tsc`, `lint` and tests in both packages, plus `docker compose up --build` with both containers healthy. Grep for `any`, `switch`, `BehaviorSubject`, numbers in `engine/`, outbound calls in `backend/src` and UI libraries in `frontend/package.json`.
- **Q&A prep:** short answers on the skill rationale, the rejected outputs, compound conditions, and versioned rule sets in production.
- Push to a public GitHub repo, then check that a fresh clone runs with the 4 README commands **and** with `docker compose up --build`.

**Done when:** every row of the coverage matrix is ✅, the self-audit shows no open gaps, and a fresh clone runs.

## Requirement coverage matrix

Each line of the brief maps to the phase that delivers it and the check that proves it.

| Brief requirement | Phase | Proof |
|---|---|---|
| **AI agent usage** | | |
| Use an AI coding agent throughout | all | AGENT_LOG entries per phase |
| Custom skill / system prompt scoped to the project | 0, 4 | `CLAUDE.md` + `.claude/skills/*` committed |
| Agent generates code **from the KB**, not just boilerplate | 1, 2, 4, 6 | "Generated from KB" log entries |
| AGENT_LOG: asked → produced → changed → why | all | `agent-log` skill fields |
| Explain every line of agent output | 8 | Q&A prep, rehearsal |
| **Angular frontend** | | |
| Angular 17+, standalone only, no NgModules | 4 | Scaffold flags, grep for `NgModule` |
| Reactive form with the 6 fields (name, age, House/Flat/Bungalow, value £, postcode, claims in last 5 yrs) | 4 | Form tests, visual check |
| Signals for `loading`, `quoteResult`, `errorMessage` | 4 | Code review, grep for no Subjects |
| Display monthly £, annual £, badge STANDARD/ELEVATED/HIGH RISK, summary, applied factors from KB | 5 | Band samples in the browser |
| Reusable `RiskBandBadgeComponent` with `riskBand` input | 5 | Badge tests |
| RxJS `HttpClient` → `POST /policy/quote` | 4 | `QuoteService` |
| **Node.js backend** | | |
| Single endpoint `POST /policy/quote` (`/health` supporting, by decision) | 3 | Route map, handler spec |
| Zod input validation | 3 | 400 `issues[]` test |
| Engine reads the KB, no hardcoded scoring values | 1, 2 | No-numbers grep, lint |
| `basePremium × riskMultiplier × coverageLoadFactor` | 3 | Service test with hand-computed values |
| Returns `monthlyPremium, annualPremium, riskBand, riskScore, riskSummary, coverageDetails, appliedFactors` | 3 | Handler 200-shape test |
| Exports `handler(event, context)` | 3 | Handler spec calls it directly |
| Jest tests covering all 3 bands (3+ cases) | 2 | Band scenarios |
| **Knowledge Base** | | |
| Structured JSON KB, loaded and applied dynamically | 1, 3 | Loader tests, hot reload |
| Extends the brief's example structure | 1 | Additions-only diff |
| Band thresholds and multipliers 1.0 / 1.5 / 2.2 from the KB | 1 | KB + band tests |
| Table-driven, not if/else | 2 | Lint `switch` ban, code review |
| Add, change or remove a factor = KB only | 2, 6 | Configurability-proof tests, rehearsal |
| UI shows applied factors from `appliedFactors` using KB text | 5 | Phase 5 check |
| **Constraints** | | |
| 1. Signals, no BehaviorSubject/Subject for UI state | 4, 5 | Grep |
| 2. `handler(event, context)` export | 3 | Spec |
| 3. KB-driven, no hardcoded scoring values | 1, 2 | Grep, lint |
| 4. No external UI libraries; own CSS | 4, 5 | `package.json` grep, hand-written CSS |
| 5. No LLM or external API calls; KB is a local file | 1, 3 | Outbound-call grep over `backend/src`, `KB_PATH` is a file |
| 6. Single `npm start` per service | 3, 4 | README commands (Docker is an extra path, not a replacement) |
| 7. AGENT_LOG.md | all | Log |
| 8. SOLUTION.md ≤ 300 words: architecture decisions, KB design choices, agent skill rationale (Deliverables), one improvement | 0, 8 | `wc -w`, four sections present |
| **Bonus (chosen)** | | |
| KB versioning: `version` in the API response, breaking schema changes without redeploy | 3, 6 | `kbVersion` in the response, schema-gate test, README section |
| Compound AND/OR conditions | 2, 6 | Evaluator tests, `compound.json` |
| Agent skill file committed | 0 | `CLAUDE.md`, `.claude/` |
| Dockerfile: multi-stage, Fargate-deployable backend with `GET /health` returning the KB version | 3, 7 | Healthy compose, `/health` curl, non-root check. Plus a frontend image and compose (beyond the brief) |
| **Live review** | | |
| Add the panel's factor live with the agent, working in the running app | 6, 7, 8 | `kb-factor` skill, hot reload, rehearsal |
| Explain skill config, rejected output, two-field factors, versioned rule sets | 8 | Q&A prep, AGENT_LOG, README |
| **Deliverables** | | |
| Public GitHub repo | 8 | Push and fresh-clone check |
| README: < 5 commands, KB location | 8 | 4 npm commands, or 1 `docker compose` |
| `risk-kb.json` at the root as a first-class artifact | 1 | Repo root |
