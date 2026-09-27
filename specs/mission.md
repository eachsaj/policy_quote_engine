# Mission

## What we are building

PolicyQuote is a minimal, single-page home insurance quoting tool. A customer enters their details and gets an instant premium estimate with a risk assessment. It has an Angular frontend and a Lambda-style Node.js backend, and a risk engine whose rules live entirely in an external Knowledge Base (KB) file.

Source of truth: `Exercise_PolicyQuote 1- AIG.pdf` (take-away exercise, 4–5 hours, followed by a live review).

## The core principle

**Risk scoring rules live in `risk-kb.json`, not in code.** The backend loads the KB and applies it dynamically. Each of these must be a KB edit only, with zero engine code changes:

- adding a factor (e.g. "flood zone postcode prefix EX or PL, +15 points")
- changing a weight (e.g. claims penalty 15 → 20)
- removing a factor
- combining fields (e.g. "Flat AND value > £500k, +35 points")

The engine is table-driven. It iterates the factors, evaluates each condition through a generic operator registry, adds up the points, and looks up the band. It does not use an if/else chain or a `switch`.

## Target audience

1. **Code reviewers**: judge the architecture, KB design, TypeScript quality and agent configuration.
2. **Testers**: check the app's behaviour against the brief, including the risk bands, validation and KB-only changes.
3. **Interviewers who ask questions on the solutions**: probe the design choices, the agent workflow and rejected output, and watch the live KB change.

## Who it is for

1. **The customer**: fills in a six-field form and sees the premium, the risk band and the reasons behind it.
2. **The review panel**: grades the KB design, the agent workflow, Angular signals, the handler and engine, and code quality. They watch a live KB change being made with the AI agent.
3. **The rules maintainer**: an underwriter or analyst who can change the risk rules by editing JSON.

## Scope

### In scope (core)

**Frontend**
- Angular 17+ with standalone components only (no NgModules).
- A reactive form with these fields: customer name, age, property type (House / Flat / Bungalow), property value (£), postcode, and number of previous claims in the last 5 years.
- Signals for all UI state (`loading`, `quoteResult`, `errorMessage`), using `signal()`, `computed()` and `effect()` correctly. No `BehaviorSubject` or `Subject` for local state.
- The display shows the monthly premium (£), annual premium (£), a risk band badge (STANDARD / ELEVATED / HIGH RISK), a plain-English risk summary, and the applied factors, using their KB labels.
- A reusable `RiskBandBadgeComponent` with a `riskBand` input.
- The form posts with RxJS `HttpClient` to `POST /policy/quote`.
- Own CSS only. No Material, PrimeNG or Bootstrap.

**Backend**
- Exports `handler(event, context)` in the Lambda shape. It runs locally and does not use AWS.
- A single business endpoint, `POST /policy/quote`, with Zod validation. `GET /health` returns `kbVersion`; it is a supporting endpoint, kept by decision.
- Premium formula: `basePremium × riskMultiplier × coverageLoadFactor`. All three values come from the KB.
- The response is `{ monthlyPremium, annualPremium, riskBand, riskBandLabel, riskScore, riskSummary, coverageDetails, appliedFactors, kbVersion }`.
- Jest tests cover all 3 risk bands with at least 3 cases.
- The scoring is deterministic and self-contained. There are no LLM calls and no external API calls.

**Knowledge Base**
- `risk-kb.json` at the repo root is a first-class artifact.
- It holds `basePremium`, `coverageLoadFactor`, bands with score ranges and `riskMultiplier` (STANDARD 0–25 ×1.0, ELEVATED 26–60 ×1.5, HIGH_RISK 61+ ×2.2), and `factors[]` with an `id`, a customer-facing `description`, a `condition` and `points`. It **extends the brief's example structure verbatim**: all its keys and values are kept, and our fields are additive only.
- **Decision on `perOccurrence`:** when it is `true`, the factor awards `points × value of the condition's field`. For example, 2 previous claims under `previous_claims_low` score 15 × 2 = 30.

### In scope (bonus)

- **KB versioning:** the KB has `version` and `schemaVersion` fields, and `kbVersion` is returned in every quote. We document how breaking schema changes are handled without redeploying (the loader supports an explicit schema version, and the KB can be swapped through `KB_PATH`).
- **Compound conditions:** a recursive condition tree with `all` (AND), `any` (OR) and `not`, evaluated by the same generic engine.
- **Dockerized services:** a multi-stage backend image (the brief's bonus: Fargate-ready, with `GET /health` returning the active KB version) and a multi-stage frontend image (Angular build served by nginx). A `docker-compose.yml` runs the whole app with one command, all locally. The KB is mounted so live KB edits still take effect in the container.

### Out of scope

- AWS of any kind: no SDK, SAM, Serverless, CDK or deployment.
- Deploying to AWS Fargate (or anywhere else). The images are built to be Fargate-ready but only ever run locally.
- Auth, persistence, databases and multiple pages.
- External UI libraries.

## Deliverables

- A public GitHub repository.
- `README.md`: both services running in under 5 commands total (npm path: 4 commands; Docker path: `docker compose up --build`), and where the KB file lives.
- `AGENT_LOG.md`: a chronological, honest record of prompt → output → change → why, including rejected output.
- `SOLUTION.md` (≤ 300 words): KB schema decisions, the reasoning behind the agent skill configuration, and one improvement we'd make with more time.
- `risk-kb.json` at the repo root.
- `CLAUDE.md` and `.claude/skills/` committed, showing how the agent is instructed.

## Success criteria

| Rubric area | Pts | We succeed when |
|---|---|---|
| KB design & configurability | 25 | Adding, changing or removing a factor, including a compound one, is a KB-only edit that a test proves |
| Agent workflow & skills | 20 | AGENT_LOG shows specific prompts and real rejections, and the skills scope the agent's context |
| Angular signals & reactivity | 20 | The UI state is all signals and computed values, and `appliedFactors` are rendered from the KB labels |
| Lambda handler & risk engine | 15 | The handler export is clean, the KB is validated at load, the operator evaluator is generic, and the response is typed |
| Code quality & TypeScript | 10 | No `any`, the KB is typed with interfaces, concerns are separated |
| Live demo & explanation | 10 | We add the panel's factor live with the agent and can explain every line |

## Live review readiness

We must be able to:
1. Add a KB factor specified on the day, using the agent live, and show it working in the running app.
2. Explain the skills and `CLAUDE.md`, and what was rejected from agent output.
3. Explain how the schema handles two-field factors, using the `all` / `any` tree.
4. Explain how version-controlled rule sets would work in production.
