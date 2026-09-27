# Tech Stack

Everything runs locally. There is no AWS SDK, AWS types, SAM, Serverless or deployment target. "Lambda-style" means only that the backend exports `handler(event, context)` in the API Gateway proxy shape. The project skill `.claude/skills/lambda-handler` is the authority for the backend protocol layer.

## Design driver: the evaluation rubric

Every choice below traces back to one of the six graded areas in the brief. When two options are otherwise equal, pick the one that scores in a higher-weighted area.

| # | Area | Pts | What the panel looks for | Where this doc answers it |
|---|---|---|---|---|
| R1 | KB Design & Configurability | **25** | Clean, extensible schema. A genuinely table-driven engine with no hardcoded conditions. A new factor is a KB change only | [Knowledge Base](#knowledge-base-risk-kbjson-r1), [Engine](#engine-design-r1-r4) |
| R2 | Agent Workflow & Skill Configuration | **20** | An honest, specific AGENT_LOG. Intentional prompts rather than "generate this app". Skills that show agent context management | [Agent tooling](#agent-tooling-r2-r6) |
| R3 | Angular Signals & Reactivity | **20** | Correct `signal()`, `computed()` and `effect()`. The UI reflects `appliedFactors` from the KB. No unnecessary `BehaviorSubject` | [Frontend](#frontend-frontend-r3) |
| R4 | Lambda Handler & Risk Engine | **15** | A clean handler export, the KB loaded correctly, a generic evaluator with no `switch`, and a typed response including `appliedFactors` | [Backend](#backend-backend-r4-r5) |
| R5 | Code Quality & TypeScript | **10** | No `any`, a KB schema typed with interfaces, separation of concerns, clean naming | [Quality gates](#quality-gates-r5) |
| R6 | Live Demo & Explanation | **10** | Adds a KB factor live and explains every change and every rejection | [Live-demo support](#live-demo-support-r6) |

## Repository layout

Two independent packages, each started with its own `npm start`. The KB sits at the root as a first-class artifact.

```
policyquote_service/
├── risk-kb.json            # the Knowledge Base (R1)
├── docker-compose.yml      # whole app in one command: backend :3000 + frontend :8080
├── .dockerignore
├── backend/                # Lambda-style Node.js service, :3000
│   ├── Dockerfile          # multi-stage, Fargate-ready image (build context = repo root)
│   └── requests/           # sample request bodies, one per band, plus compound/flood demos (R6)
├── frontend/               # Angular SPA, dev server :4200, proxies to :3000
│   ├── Dockerfile          # multi-stage: Angular build → nginx
│   └── nginx.conf          # static SPA + proxy /policy, /health → backend:3000
├── specs/                  # mission, tech-stack, roadmap
├── CLAUDE.md, .claude/     # agent instructions and project skills (R2)
├── AGENT_LOG.md, SOLUTION.md, README.md
```

There are no npm workspaces and no shared types package. The frontend keeps its own `models/quote.ts` in step with the backend's response types.

## Knowledge Base (`risk-kb.json`) (R1)

**Principle:** every number, threshold, label and piece of customer-facing risk wording lives in the KB. Code holds only mechanisms: operators, the evaluator, aggregation and templating.

**Rule: extend the brief's example, never reshape it.** Every key and value in the brief's example KB is kept exactly as written: `version`, `basePremium`, `coverageLoadFactor`, `riskBands` as an object keyed by band with `min`/`max` (including `999`), and `factors[]` with `id`, `description`, `condition`, `points` and `perOccurrence`. All five example factors are copied verbatim. Our additions are purely additive, marked `// +` below, so a reviewer can diff the KB against the brief.

```jsonc
{
  "version": "1.0.0",                 // brief: rule-set version → returned as kbVersion
  "schemaVersion": 1,                 // + KB *shape* version → gated by the loader
  "basePremium": 300,
  "coverageLoadFactor": 1.2,
  "riskBands": {                      // brief's shape: object keyed by band id
    "STANDARD":  { "min": 0,  "max": 25,  "riskMultiplier": 1.0, "label": "STANDARD",   // + multiplier, label, summary
                   "summary": "Low risk profile: {factorCount} risk factor(s) applied, score {score}." },
    "ELEVATED":  { "min": 26, "max": 60,  "riskMultiplier": 1.5, "label": "ELEVATED",  "summary": "…" },
    "HIGH_RISK": { "min": 61, "max": 999, "riskMultiplier": 2.2, "label": "HIGH RISK", "summary": "…" }
  },
  "coverage": { "items": [ { "id": "buildings", "description": "Buildings cover" } ] },   // + feeds coverageDetails
  "factors": [
    { "id": "previous_claims_low", "description": "1–2 previous claims",                 // brief, verbatim
      "condition": { "field": "previousClaims", "operator": "between", "min": 1, "max": 2 },
      "points": 15, "perOccurrence": true },
    { "id": "flat_high_value", "description": "Flat AND property value over £500,000",   // + compound (bonus)
      "condition": { "all": [
        { "field": "propertyType",  "operator": "eq", "value": "Flat" },
        { "field": "propertyValue", "operator": "gt", "value": 500000 } ] },
      "points": 35 }
  ]
}
```

Schema decisions (each one needs an explanation ready for the live review):

| Decision | Why | Rubric |
|---|---|---|
| The brief's example is kept verbatim, and our fields are additive only | Reviewers compare against the brief. Extending shows we honoured the contract, while reshaping would read as ignoring it | R1 |
| A condition is a **leaf** `{field, operator, …params}` (the brief's shape) or a **group** `{all:[…]}`, `{any:[…]}` or `{not:{…}}`, nested recursively | Two-field and OR factors need no new code. This answers the "flat AND over £500k" question, and leaf conditions stay identical to the brief's | R1, bonus |
| Each band gets `riskMultiplier`, `label` and `summary` | The brief's table gives multipliers "from KB". `label` holds the exact badge wording ("HIGH RISK" for key `HIGH_RISK`). Summaries in the KB mean no band wording in code | R1 |
| Band order comes from sorting by `min` at load, and ranges are checked to be contiguous, starting at 0 | Object keys carry no order. The loader derives it rather than trusting key order | R1, R4 |
| `max: 999` is kept, and a score above the top band's `max` is clamped into the top band with a logged warning | Brief fidelity, with no crash on extreme inputs | R1 |
| `perOccurrence: true` awards `points × value of the condition's field` | The brief uses the key but doesn't define it. This is the most literal reading: 2 claims score 2 × 15 | R1 |
| Factor text is the brief's **`description`** key, and an optional `enabled` (defaults to `true`) is added | The UI shows `description` verbatim ("driven by the KB labels"). A factor can be switched off without deleting it | R1, R3 |
| `summary` templates use `{placeholder}` tokens | The risk summary is plain English from the KB, filled by a generic interpolator | R1 |
| `version` and `schemaVersion` are separate | Rule changes bump `version`. Shape changes bump `schemaVersion`, and the loader rejects shapes it doesn't support | bonus |

## Engine design (R1, R4)

```
src/engine/
├── operators.ts   registry: Record<OperatorName, { params: ZodSchema; test: (fieldValue, params) => boolean }>
├── evaluate.ts    evaluate(condition, input): leaf → registry lookup; all/any/not → recursion
├── score.ts       scoreRisk(input, kb): enabled factors → matches → points (× occurrences) → total
├── band.ts        findBand(score, bands): range lookup over KB bands
└── template.ts    interpolate(template, values): generic {token} substitution
```

- **The operator registry is the only place operators exist.** Each entry pairs a Zod parameter schema with a pure `test` function. The KB loader builds its leaf-condition validation from the registry, so it can reject an unknown operator or wrong parameters. Adding an operator takes one registry entry, and nothing else changes.
- The starting operators are `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between`, `outside_range`, `in` and `starts_with`. `starts_with` accepts a list of prefixes, for postcode factors like flood zones.
- **There is no `switch`, no if/else ladder over operators or factor ids, and no field names or numbers in `engine/`.** An ESLint rule and a grep gate enforce this.
- Group nodes are told apart by key presence, through a discriminating type guard. The evaluator recurses through them.
- Every step is a pure function of `(input, kb)`. The result is deterministic, and it is tested with in-memory KBs.
- `scoreRisk` returns a typed `AppliedFactor[]`, where each entry is `{ id, description, points, occurrences }`. The response carries it through unchanged.

## Backend (`backend/`) (R4, R5)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js 22+ LTS | Node 25 is installed locally, and the code targets 22+ APIs only |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess` | No `any`, including caught errors and `JSON.parse` results |
| Dev runner | `tsx` | `npm start` → `tsx src/server.ts` |
| HTTP | `node:http` adapter only | It builds an `HttpEvent` and calls `handler`. No Express, Fastify, Koa or Hono |
| Validation | Zod for the request **and** the KB | `QuoteRequest = z.infer<…>`. The KB interfaces live in `kb/types.ts`, and the loader's Zod schema is type-checked against them (`satisfies`) |
| Tests | Jest + ts-jest | Uses `test.each` over JSON scenario fixtures |
| Config | `KB_PATH` (defaults to `../risk-kb.json`), `PORT` (defaults to 3000) | |

### Module boundaries

```
src/
├── http/types.ts        HttpEvent, HttpResult, HandlerContext (local, AWS-compatible shape)
├── handler.ts           export handler(event, context): parse → validate → route map → envelope → error map
├── server.ts            node:http ⇄ HttpEvent translator; loadKb() before listen; KB file watch
├── quote/request.ts     Zod request schema (the one source of the request shape)
├── quote/response.ts    QuoteResponse, AppliedFactor, CoverageDetails interfaces
├── quote/service.ts     getQuote(request, kb): formula + response assembly (no transport, no fs)
├── kb/types.ts          Kb, RiskBand, Factor, Condition (leaf | group) interfaces
├── kb/schema.ts         Zod KB schema built from the operator registry
├── kb/loader.ts         read → parse → validate → consistency checks → cache; last-good on reload
└── engine/              see above
```

**Request contract (`quote/request.ts`).** These are the brief's six form fields, and this is the only place the request shape is declared:

| Field | Zod rule | Notes |
|---|---|---|
| `customerName` | trimmed string, 1–100 chars | Required by the brief's form. **Not a scoring input**: no KB factor reads it, and it is never logged |
| `age` | integer, 18–120 | |
| `propertyType` | `enum(['House', 'Flat', 'Bungalow'])` | Exactly the brief's options |
| `propertyValue` | positive number (£) | |
| `postcode` | UK postcode regex, trimmed and **upper-cased** | Normalised, so KB `starts_with ["EX","PL"]` matches "ex4 1aa" |
| `previousClaims` | integer, 0–20 | "in the last 5 years" (the form label says so) |

**Loading the KB correctly (R4).** The loader runs these checks, and each failure produces a message naming the offending path:
1. The JSON parses.
2. `schemaVersion` is supported.
3. The Zod shape is valid, including the parameters for each operator.
4. Factor `id`s are unique.
5. The bands, sorted by `min`, are contiguous with no overlap and start at 0.
6. Every `condition.field` exists in the request schema's keys.

The server loads the KB before it listens, so a bad KB fails at startup. When the KB file changes, it is re-validated. A valid KB is swapped in atomically, and an invalid one is logged while the last good KB keeps serving.

**Premium and response.** `annualPremium = basePremium × band.riskMultiplier × coverageLoadFactor`. `monthlyPremium = annualPremium / 12`. Rounding to 2 dp happens only at the response boundary. `coverageDetails` shows the breakdown (base premium, multiplier, load factor, sum insured) plus the KB coverage items. The response is typed `QuoteResponse`: `{ monthlyPremium, annualPremium, riskBand, riskBandLabel, riskScore, riskSummary, coverageDetails, appliedFactors, kbVersion }`.

### API

| Route | Result |
|---|---|
| `POST /policy/quote` | 200 `QuoteResponse` · 400 `{ error, issues[] }` · 500 `{ error, requestId }` (no internals) |
| `GET /health` | 200 `{ status, kbVersion, schemaVersion, factorCount }`. A **supporting** endpoint, kept by decision: `POST /policy/quote` stays the single business endpoint the brief asks for |
| `OPTIONS /policy/quote` | 204 (CORS) |
| anything else | 404 |

Every response carries CORS headers.

## Frontend (`frontend/`) (R3)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Angular, latest stable CLI (22.x) | Standalone components only, no NgModules, `ChangeDetectionStrategy.OnPush`, zoneless |
| Scaffolding | `npx @angular/cli new` via the `angular-new-app` skill | The global `ng` isn't installed |
| Forms | Reactive Forms (`FormGroup`, `Validators`) | This is the brief's explicit requirement. Validators mirror the Zod schema |
| HTTP | `HttpClient` (RxJS) → `POST /policy/quote` | The Observable is used only at the service edge, and its results are written into signals |
| Styling | Hand-written CSS with custom properties | No Material, PrimeNG, Bootstrap or Tailwind |
| Dev proxy | `proxy.conf.json`, wired into `angular.json` serve options | `/policy` and `/health` → `http://localhost:3000`. A plain `npm start` (`ng serve`) picks up the proxy, so it stays **one command**, as the brief requires |
| Tests | The CLI default runner | Covers the badge, the signal state transitions and the factor rendering |

### Signal design

Each signal primitive has a deliberate use that can be explained to the panel.

| Primitive | Used for |
|---|---|
| `signal()` | `loading`, `quoteResult`, `errorMessage`: the brief's three named states, and nothing else |
| `computed()` | `hasResult`, `appliedFactors` (sorted by points), `totalPoints`, formatted premiums, `canSubmit` (form validity via `toSignal(statusChanges)` combined with `!loading()`) |
| `effect()` | Genuine side effects only: moving focus to the results region and announcing it through an `aria-live` region when a new quote arrives. Never used to copy one signal into another |
| `input()` | `RiskBandBadgeComponent` has `riskBand = input.required<string>()` and `label = input<string>()`, plus `computed()` for display |

- **KB-driven rendering.** Factor rows are an `@for` over `appliedFactors`, each showing `description` and `points` from the response. The badge text is `riskBandLabel` from the KB, and its style uses a `data-band` attribute, with a neutral fallback for bands the CSS doesn't know. A new factor or band in the KB appears without a frontend change.
- **No `BehaviorSubject` or `Subject`, and no `.subscribe` inside templates.**

## Quality gates (R5)

| Gate | Command | Blocks |
|---|---|---|
| Types | `npx tsc --noEmit` (both packages) | Type errors |
| Lint | `npm run lint`: `@typescript-eslint/no-explicit-any: error`, and `no-restricted-syntax` banning `SwitchStatement` in `engine/` and `handler.ts` | `any`, `switch` |
| No hardcoded scoring | `grep -nE '[0-9]{2,}' backend/src/engine` must match nothing except comments | Numbers in the engine |
| Tests | `npm test` (both packages) | Regressions |

Naming: files in kebab-case, types in PascalCase, and KB `id`s in snake_case. Names are domain terms from the brief (`riskBand`, `appliedFactors`, `coverageLoadFactor`).

## Agent tooling (R2, R6)

**Context strategy.** `CLAUDE.md` stays lean: it holds the rules, the commands and pointers to `specs/`. Detailed know-how lives in skills that load only when relevant (progressive disclosure). Each skill has trigger phrases scoped to file paths, a **reject table**, and a **runnable definition of done**. Together these make agent output verifiable and give the log specific rejections to record.

| Skill | Scope | Status |
|---|---|---|
| `lambda-handler` | `handler.ts`, `server.ts`, request schema, error envelope, `backend/Dockerfile` | Exists. Needs corrections: property types House/Flat/Bungalow, and the Dockerfile section updated to the Containers spec (non-root, `HEALTHCHECK`, KB mounted by compose) |
| `risk-engine` | `engine/*`, `kb/*`, operator registry, `quote/service.ts` | Exists (`.claude/skills/risk-engine`) |
| `kb-factor` | **Live-demo skill.** Adds, changes or removes a factor through the KB only. It adds a scenario fixture and runs the tests, then the curl check, and escalates only when a new operator is truly needed | Exists (`.claude/skills/kb-factor`) |
| `kb-driven-tests` | JSON scenario fixtures and `test.each` suites under `backend/test/`, configurability proof, factor and band coverage check | Exists (`.claude/skills/kb-driven-tests`) |
| `angular-signals-component` | Signal state, `input()`, `computed()`/`effect()` rules, no Subjects | Exists (`.claude/skills/angular-signals-component`) |
| `agent-log` | AGENT_LOG entries: verbatim prompt, output, change, why, rejections | Exists |
| `angular-developer`, `angular-new-app` | Upstream Angular guidance and scaffolding | Exist |

**Traceability.** Each phase's commit message cites its AGENT_LOG entry number, so a reviewer can go from a log entry to its diff.

## Containers (bonus: Dockerfile)

Everything runs locally. "Fargate-ready" means the backend image follows the Fargate contract: stateless, configured by env, logs to stdout/stderr, has a health endpoint, and uses no local state. It is **never deployed**, and there is no AWS SDK, ECR or task definition.

| Image | Stages | Runtime details |
|---|---|---|
| `backend/Dockerfile` (context = repo root, so `risk-kb.json` is in scope) | **build**: `node:22-alpine`, `npm ci`, `tsc -p tsconfig.build.json` → `dist/`. **runtime**: `node:22-alpine`, `npm ci --omit=dev`, copy `dist/`, and **bake in a default `risk-kb.json`** | `USER node` (non-root). `ENV NODE_ENV=production PORT=3000 KB_PATH=/app/kb/risk-kb.json`. `EXPOSE 3000`. `HEALTHCHECK` runs `node -e "fetch('http://localhost:3000/health')…"` (alpine has no curl). `CMD ["node","dist/server.js"]`, so `tsx` is not in the runtime image |
| `frontend/Dockerfile` (context = `frontend/`) | **build**: `node:22-alpine`, `npm ci`, `npm run build`. **runtime**: `nginx:alpine` serving `dist/<app>/browser` | `nginx.conf`: SPA fallback (`try_files … /index.html`), and `location /policy` and `/health` → `proxy_pass http://backend:3000`. The browser stays same-origin, so no CORS is needed in the Docker path either. Listens on 8080 |

**`docker-compose.yml`**
- `backend`: builds from the repo root with `-f backend/Dockerfile`, maps port `3000:3000`, and bind-mounts the **repo root directory read-only** at `/app/kb`, so `KB_PATH=/app/kb/risk-kb.json` points to the live file.
  - Mount the directory, not the single file. Editors save by atomic rename, and a single-file bind mount keeps the old inode, so the container would never see the edit.
  - The KB watcher uses stat polling (`fs.watchFile`) because inotify events are unreliable across Docker Desktop bind mounts.
- `frontend`: maps port `8080:8080`, and uses `depends_on: backend: condition: service_healthy`.
- The result: `docker compose up --build` runs the whole app at `http://localhost:8080`, and a KB edit on the host changes the next quote with no rebuild. This is the live-demo path in Docker.

**Hygiene**
- A `.dockerignore` excludes `node_modules`, `dist`, `.angular`, `.git`, `.claude`, `specs` and the logs.
- Pinned base-image tags, one process per container, and no secrets or env files baked in.

**Checks**
- `docker compose up --build` gives healthy containers.
- `curl localhost:3000/health` returns `kbVersion`.
- The UI at :8080 quotes all three bands.
- A host KB edit is reflected without a rebuild.
- `docker compose exec backend whoami` returns `node`.
- The runtime image has no `tsx`, `typescript` or `jest`.

## Live-demo support (R6)

- **KB hot reload** means the panel's factor goes live without a restart. An invalid edit is rejected with a named error, and the last good KB keeps serving.
- **Sample requests** in `backend/requests/`: `standard.json`, `elevated.json`, `high-risk.json`, `compound.json` and `flood-zone.json`.
- **Visible version.** The UI shows `kbVersion`, so a version bump during the demo is visible.
- **Two run paths.** The demo works with `npm start` (hot reload) or `docker compose up` (KB directory bind-mounted, polling reload), so the panel can see either.
- **A rehearsed script** in the roadmap's final phase.

## Explicitly not used- rejected

AWS SDK, `@types/aws-lambda`, Express/Fastify/Koa/Hono, NgModules, UI component libraries, Tailwind, `BehaviorSubject`/`Subject` for UI state, `switch` or if/else rule ladders, LLM or external API calls from the backend, databases, AWS deployment of the images (ECR, ECS task definitions, CDK), `curl` in the backend runtime image, `tsx` in production.
