# Agent Log

Chronological record of significant agent interactions while building PolicyQuote. Entries are written as the work happens, never backfilled.

## Entry 1: Create CLAUDE.md via /init

- **When:** 2026-09-27 01:54
- **Phase / skill:** Setup / `/init` (built-in), with `agent-log` for this entry
- **Prompt:** "/init" (built-in command: analyse the codebase and create CLAUDE.md), then "ok" to add this log entry
- **Output:** A CLAUDE.md built from the project skills, because the repo has no application code yet. It covers the planned backend/frontend architecture, the hard rules (no `any`, no `switch` routing, no frameworks or AWS packages), the planned npm/jest/docker commands and the AGENT_LOG workflow.
- **What changed:** `CLAUDE.md` (new), `AGENT_LOG.md` (new, this entry)
- **Why:** Future agent sessions start from the design rules the skills set out, which supports Agent workflow (20). The file says the content is planned rather than implemented, so paths are checked before use.
- **Rejected / corrected:** No generic dev-practice sections or invented "tips" (the /init guidance forbids them). Skills and `PLAN.md` that are referenced but absent (`risk-engine`, `angular-signals-component`, `kb-driven-tests`, `kb-factor`) are flagged as missing rather than described. Checked against the skills' reject tables: nothing else rejected.

## Entry 2: Project constitution in specs/

- **When:** 2026-09-27 02:07
- **Phase / skill:** Planning, before Phase 0 / `agent-log`
- **Prompt:** "Lets create a "constitution" in a specs directory: - 'mission.md',- "tech-stack.md", - "roadmap.md" ... you must use AksUserQuestion tool, grouped on these 3, before writing code to disk" (excerpt; the full prompt also summarised the brief and pointed at the PDF)
- **Output:** The agent read all 8 pages of the brief and asked grouped questions. It then wrote three files. `specs/mission.md` covers scope, rubric-mapped success criteria and live-review readiness. `specs/tech-stack.md` covers layout, module boundaries, engine rules and the API. `specs/roadmap.md` sets out phases 0–7, KB and engine first.
- **What changed:** `specs/mission.md`, `specs/tech-stack.md`, `specs/roadmap.md` (new)
- **Why:** Decisions agreed through the questions: bonus scope is KB versioning plus compound AND/OR; `perOccurrence` means points × field value; everything is local with no AWS; the existing `lambda-handler` skill is used; the layout is two folders; the build order is KB and engine first. These pin down the ambiguities that the KB design (25) and handler/engine (15) rubric lines depend on.
- **Rejected / corrected:** The first two question rounds were rejected by the user. The agent's options had not made clear that "Lambda-style" means local-only with no AWS. The user then asked for "NodeJs lambda skills". The agent pointed to the existing AWS-free `lambda-handler` skill rather than installing an unvetted third-party one, and the user confirmed. The Dockerfile bonus was dropped from scope. The skill's placeholder property types (5 options) were flagged as conflicting with the brief's House / Flat / Bungalow.

## Entry 3: SOLUTION.md draft

- **When:** 2026-09-27 02:30
- **Phase / skill:** Planning, before Phase 0 / `agent-log`
- **Prompt:** "add SOLUTION.md - explain the architecture decision, KB design choices, and future improvement plans. Improvement plan could be adding data privacy protection"
- **Output:** A `SOLUTION.md` with sections for architecture, KB design choices, agent configuration and the data-privacy improvement (data minimisation, outward-code postcode, log redaction, no quote storage, TLS, retention and consent under UK GDPR).
- **What changed:** `SOLUTION.md` (new). An earlier follow-up added a Target audience section to `specs/mission.md` (code reviewers, testers, interviewers). The user rejected the agent's first, longer version of that section, which rewrote the existing audience list.
- **Why:** SOLUTION.md is a required deliverable (≤ 300 words) and must also cover the reasoning behind the agent skill configuration, so a short agent section was added even though the prompt did not ask for it. The content describes the planned design from `specs/`, because no code exists yet. It must be re-checked against the real implementation in Phase 7.
- **Rejected / corrected:** The first draft was 342 words (checked with `wc -w`), over the 300-word limit. The agent trimmed it to 296.

## Entry 4: Rubric-driven revision of tech-stack and roadmap

- **When:** 2026-09-27 02:35
- **Phase / skill:** Planning, before Phase 0 / `agent-log`
- **Prompt:** "carefully understand the Evaluation criterias in document provided in each area,expectations and max points. When you plan and design solution maxumum focus must be given to those evaluation criteria. Update the roadmap and technstack documents appropriatly"
- **Output:** `tech-stack.md` now opens with a matrix mapping rubric areas R1–R6 to its sections, and has new sections for KB schema decisions, engine design, signal design, quality gates, agent context strategy and live-demo support. `roadmap.md` has a rubric map, a per-phase agent protocol, R-tags on each phase, a configurability-proof test, a rubric self-audit and Q&A prep.
- **What changed:** `specs/tech-stack.md`, `specs/roadmap.md` (rewritten); `specs/mission.md` (`riskBandLabel` added to the response shape)
- **Why:** Design changes driven by the rubric:
  - R1: band labels, summaries and coverage text move into the KB, since "no hardcoded conditions" also covers wording.
  - R1: bands become an ordered array with `max: null` instead of the magic `999`.
  - R4: the operator registry pairs a Zod parameter schema with a test function, so the loader rejects unknown operators, and six load-time checks cover "KB loaded correctly".
  - R3: `effect()` gets a real side effect (focus and aria-live), not signal copying.
  - R5: ESLint bans `any` and `switch`.
  - R6: KB hot reload with a last-good fallback, plus sample requests.
- **Rejected / corrected:** Removed from the previous draft: `999` as the open band maximum (a magic number); band names used as object keys (loses ordering, so contiguity can't be checked); an unassigned role for `effect()` (at risk of being used to copy signals, which the rubric penalises). The user's own edit to the tech-stack heading ("Explicitly not used- rejected") was kept.

## Entry 5: Roadmap review against the brief

- **When:** 2026-09-27 02:46
- **Phase / skill:** Planning, before Phase 0 / `agent-log`
- **Prompt:** "review the every phases defined in the roadmap.md and ensure it matche 100% from requirements given and meets the overall objectives"
- **Output:** The agent traced each line of the brief to the roadmap. It found 4 drifts (`/health` vs "single endpoint", reshaped `riskBands`, `label` in place of the brief's `description`, badge text "High risk" instead of "HIGH RISK") and 4 gaps (no explicit "generate code from the KB" step, versioning only documented rather than shown, the frontend proxy and README command count, and no explicit request fields or postcode normalisation). The user decided: keep `/health`, extend the KB and never reshape it, keep all extras as core.
- **What changed:** `specs/roadmap.md` (rewritten: fixes per phase plus a requirement coverage matrix); `specs/tech-stack.md` (KB section follows the brief's shape, request contract table, `description` key, proxy in `npm start`, `/health` marked as supporting); `specs/mission.md` (endpoint and KB bullets)
- **Why:** The KB design (25) and handler (15) rubric lines are judged against the brief's contract. Reviewers can diff the KB against the example, and the coverage matrix gives the Phase 7 self-audit a checklist.
- **Rejected / corrected:** The agent reversed its own Entry 4 redesign: the array-shaped `riskBands`, `max: null` and the `label` key are rejected because they reshape the brief's example instead of extending it. Band order is now derived by sorting on `min` at load. The agent had recommended dropping `/health` and making the extras stretch goals; the user overruled both, and the specs follow the user.

## Entry 6: Add dockerized services to specs

- **When:** 2026-09-27 10:00
- **Phase / skill:** Planning, before Phase 0 / `agent-log`
- **Prompt:** "we need dockerized component so, update accordingly"
- **Output:** The agent asked about scope, and the user chose "Both + docker compose". The specs now include:
  - a multi-stage backend image: non-root, `HEALTHCHECK` on `/health`, a KB baked in by default
  - a multi-stage frontend image: Angular build served by nginx, which proxies `/policy` and `/health`
  - `docker-compose.yml`, with the repo root directory bind-mounted read-only as the live KB
  - a new roadmap Phase 7 (Containerisation); docs and submission moved to Phase 8
- **What changed:**
  - `specs/mission.md`: the Docker bonus moves into scope; the out-of-scope item is now only AWS deployment; the README gets a Docker path.
  - `specs/tech-stack.md`: new Containers section, layout updated, `lambda-handler` skill note, not-used list updated.
  - `specs/roadmap.md`: rubric map, Phase 0/3 notes, the new Phase 7, Phase 8, and the coverage matrix.
- **Why:** This reverses the earlier "Dockerfile out of scope" decision at the user's request. The brief's bonus asks for a multi-stage, Fargate-deployable backend with `/health` returning the KB version. Compose adds a one-command run while keeping the required `npm start` for each service.
- **Rejected / corrected:** A single-file bind mount of `risk-kb.json` was rejected, because editors save by atomic rename and the container would keep the old inode, so live KB edits would silently not apply. The spec mounts the directory and uses stat polling (`fs.watchFile`) instead of inotify. `curl` in the alpine runtime image was also rejected in favour of a Node `fetch` healthcheck. Any AWS deployment artefacts (ECR, ECS task definitions) were kept out, in line with the user's "everything local" rule.

## Entry 7: risk-engine project skill

- **When:** 2026-09-27 17:07
- **Phase / skill:** Phase 0 (roadmap: "write the risk-engine and kb-factor skills") / `agent-log`
- **Prompt:** "create a skill risk-engine", then mid-turn "refer mission, tech-stach and roadmap when you constructing skill" and "the skills file should be in new directory skills in the project", then "its project level skill, all project level skills should be in projects ... should be stored in the.skills directory at the project root"
- **Output:** `SKILL.md` (triggers, rules, a reject table, a runnable definition of done) and `references/engine-pattern.md`, which has code to copy for the operator registry, evaluator, scorer, band lookup, template, KB types/schema, loader, service and specs. Step 1 of the skill points to the specific sections of `mission.md`, `tech-stack.md` and roadmap Phases 1–2. The definition of done combines the Phase 1/2 "Done when" checks with the quality gates.
- **What changed:** `.claude/skills/risk-engine/SKILL.md`, `.claude/skills/risk-engine/references/engine-pattern.md` (new); `CLAUDE.md` (risk-engine listed as existing, project vs global skill locations noted)
- **Why:** Scopes the agent's context for the highest-weighted engine and KB work (R1 25, R4 15), and each skill needs a reject table and a runnable definition of done (R2 20). Two rules the specs don't state were added for review: `perOccurrence` is rejected on a group condition (no single field to count), and summary templates may only use `{score}`, `{factorCount}` and `{label}`. The reference code has not been compiled, because no backend exists yet; `tsc` and the specs in the definition of done are the real proof.
- **Rejected / corrected:** The first draft pointed only at `tech-stack.md`. At the user's request it was corrected to cite `mission.md` and roadmap Phases 1–2 as well, and `npm run lint`, the check that the KB diff against the brief shows additions only, and the "Generated from KB" log rule were added to the definition of done. The user asked for the skill to live in a project-root `skills` / `.skills` directory. The agent explained that `.claude/skills/` at the project root already is the project-local location (global is `~/.claude/skills/`), and that Claude Code does not scan `.skills/` or `skills/`, so moving it would stop the skill loading. It was left in place. The registry exposes `matches(value, leaf)` rather than the spec's `test(fieldValue, params)` signature, so it stays homogeneous without `any`; the spec wording was not changed.

## Entry 8: kb-factor project skill

- **When:** 2026-09-27 17:15
- **Phase / skill:** Phase 0 (roadmap: "write the risk-engine and kb-factor skills") / `agent-log`
- **Prompt:** "create a skill kb-factor"
- **Output:** `.claude/skills/kb-factor/SKILL.md`, the live-demo skill, built from the tech-stack `kb-factor` row, "Live-demo support", roadmap Phase 6 and mission's core principle. It has a 7-step workflow (restate the rule, check it fits, edit the KB and bump `version`, fixture, sample request, verify without restart, log), a table mapping wording to conditions, a "when to stop" table that hands over to `risk-engine` or `lambda-handler`, a reject table and a runnable definition of done (loader, `git status`, jest, curl `/health` and quote, UI).
- **What changed:** `.claude/skills/kb-factor/SKILL.md` (new); `CLAUDE.md` and the skills table in `specs/tech-stack.md` (kb-factor marked as existing)
- **Why:** The live review asks for a factor added with the agent in front of the panel (R6 10), and a KB-only change is the proof for R1 (25). The skill restates the rule first and treats `git status` as proof, so the demo shows no `src/` edits. Decisions the specs don't state, flagged for review: `version` gets a minor bump for a factor add/change/remove and a patch bump for wording; "remove" deletes the entry and "disable" sets `enabled: false`.
- **Rejected / corrected:** A "footer shows kbVersion" line was corrected to "the page shows", because the specs don't place it in a footer. Two gaps were found while writing the skill and are escalated rather than papered over: a one-letter postcode area (for example "B") over-matches with `starts_with`, and a discount factor with negative points could push the score below 0, which `findBand` in the `risk-engine` pattern throws on. Both go to `risk-engine` if needed. No helper script was added, because the backend doesn't exist yet to test one. The definition-of-done commands are unverified until Phase 3.

## Entry 9: kb-driven-tests project skill

- **When:** 2026-09-27 17:24
- **Phase / skill:** Phase 0 (skills; tests are built in Phase 2) / `agent-log`
- **Prompt:** "create a skill kb-driven-tests"
- **Output:** `.claude/skills/kb-driven-tests/SKILL.md` and `references/scenario-pattern.md`, built from roadmap Phase 2 (the case list and the configurability proof), tech-stack "Jest + `test.each` over JSON scenario fixtures" and the brief's "all 3 bands, 3+ cases". It covers:
  - one JSON fixture file per factor, run against the real KB and parsed with the real `quoteRequestSchema`
  - a `_base.json` request that triggers no factor, which scenarios override
  - expected values worked out by hand, with the arithmetic in a `why` line
  - the configurability proof as JSON patch ops (`addFactor` / `setPoints` / `removeFactor`) applied through a lookup table
  - a coverage spec that fails if any enabled factor or band has no scenario
- **What changed:** `.claude/skills/kb-driven-tests/` (new); `kb-factor` step 4 and its `git status` check now point to `backend/test/scenarios/<id>.json`; the configurability row in `risk-engine`'s reference names the owner; `CLAUDE.md` and the tech-stack skills table mark it as existing
- **Why:** Tests as data are the test-side proof of "a new factor is a KB change only" (R1 25). The coverage check makes `kb-factor` add a fixture, and `why` lines let the panel check expected values in the live demo (R6). Decisions made here, not in the specs:
  - tests live in `backend/test/`, outside `src/`, so they are not shipped and not caught by the engine no-numbers grep
  - one fixture file per factor
  - exact band boundaries on the real KB are only asserted when real factors can reach them; otherwise the `band.spec` unit table covers them
- **Rejected / corrected:** Three things in the first draft of the reference were fixed before finishing:
  - The configurability runner imported `expectMatches` from `scenarios.spec.ts`, which would have made Jest register the scenario tests twice. It moved to `test/expect-matches.ts`.
  - `readJson(kbPath) as KbJson` was replaced by a Zod parse.
  - An ad hoc `typeof base === 'object'` narrowing was replaced by a Zod parse.
  
  One `as` remains, the typed-lookup cast in `apply`. It is documented as widening a function type only. Expected values captured from `getQuote` output or Jest snapshots are rejected as circular. No code has been compiled, because the backend doesn't exist yet.

## Entry 10: angular-signals-component project skill

- **When:** 2026-09-27 17:27
- **Phase / skill:** Phase 0 (skills; the UI is built in Phases 4–5) / `agent-log`
- **Prompt:** "create a skill angular-signals-componen" (interrupted by the user), then "create a skill angular-signals-component"
- **Output:** `.claude/skills/angular-signals-component/SKILL.md` and `references/component-pattern.md`, built from tech-stack "Frontend" and "Signal design", roadmap Phases 4–5 and the mission's Frontend scope. The skill defines:
  - exactly three writable signals (`loading`, `quoteResult`, `errorMessage`), with everything else derived by `computed()`, including `canSubmit` over `toSignal(statusChanges)`
  - `effect()` used only to move focus to the new result, through `afterNextRender`
  - the Observable stopping at `QuoteService`
  - an `input()`-based `RiskBandBadgeComponent` styled by `data-band`, with a neutral fallback for unknown bands
  - factors rendered with `@for` over `appliedFactors`
  - validators that mirror Zod

  It also has a reject table, a runnable definition of done and a browser checklist.
- **What changed:** `.claude/skills/angular-signals-component/` (new); `CLAUDE.md` and the tech-stack skills table mark it as existing, and `CLAUDE.md` no longer lists any skill as missing
- **Why:** Angular Signals & Reactivity is R3 (20), and KB-driven rendering supports R1. Each signal primitive has one stated job, so each can be explained to the panel.
- **Rejected / corrected:** The upstream `angular-developer` skill's default of Signal Forms for v22 apps was rejected, because the brief requires Reactive Forms. So were `httpResource` for the POST (the brief requires RxJS `HttpClient`) and v20 suffix-less naming (the brief names `RiskBandBadgeComponent`). These are recorded as an explicit override table in the skill. A plain `effect()` that focuses the heading directly was rejected, because effects run before the DOM updates; `afterNextRender` inside the effect is used instead. One bug was fixed in the first draft: the page spec's `validForm.propertyType` widened to `string` and would not type-check against `setValue`, so it is now `'House' as const`. Decisions made here, not in the specs:
  - a failed request clears `quoteResult`, so a stale premium never shows next to an error
  - band ids may appear only as CSS `[data-band]` selectors

  No code has been compiled, because `frontend/` doesn't exist yet.

## Entry 11: Align specs, skills and CLAUDE.md with the brief

- **When:** 2026-09-27 17:47
- **Phase / skill:** Phase 0 (roadmap: fix `lambda-handler`, update `CLAUDE.md`) / `agent-log`
- **Prompt:** "verify the current skills and plans are aligned with constraints and rules, such as [the brief's 8 constraints, pasted]", then "SOLUTION.md is small", then "align plans, skills, and spec fully aligned with requirement document /Users/saj/agi/Exercise_PolicyQuote 1- AIG.pdf"
- **Output:** The agent read the brief (8 pages), all specs, skills and references, and reported the design aligned with all 8 constraints on paper but with gaps in the skill files that an agent would copy into code. It then fixed them:
  - `lambda-handler`: six-field request with `House`/`Flat`/`Bungalow` and `customerName`, KB hot reload in `server.ts`, the Dockerfile from the Containers spec, new reject rows and checks
  - a stronger no-numbers grep, `no-magic-numbers` and an outbound-call grep
  - an `angular-new-app` override, and `CLAUDE.md` rewritten around `specs/` and the 8 constraints
  - `SOLUTION.md` cut to 223 words
- **What changed:** `CLAUDE.md`, `SOLUTION.md`, `specs/tech-stack.md`, `specs/roadmap.md`, `specs/mission.md`, `.claude/skills/lambda-handler/SKILL.md`, `lambda-handler/references/handler-pattern.md`, `risk-engine/SKILL.md`, `risk-engine/references/engine-pattern.md` (`kbPath` exported for the watcher), `angular-signals-component/SKILL.md`, `agent-log/SKILL.md`
- **Why:** Gaps found by checking each constraint against the brief:
  - The number grep `[0-9]{2,}` misses `2.2`, `1.5` and `1.2`, the exact multipliers constraint 3 bans (R1 25). The new regex was tested with macOS grep: it flags `2.2` and `15` and passes `0`, `1` and `ES2023`.
  - Constraint 5 was stated but never checked. Constraint 4 could be broken through `angular-new-app`'s Tailwind step.
  - The brief names different `SOLUTION.md` parts in constraint 8 (architecture) and in Deliverables (agent skill rationale), so the specs now require the union.
  - `CLAUDE.md` still referred to a non-existent `PLAN.md` and was missing `riskBandLabel`.
- **Rejected / corrected:**
  - The handler reference's placeholder property types (`Detached`, `Semi-detached`, `Terraced`) were rejected as drift from the brief, as flagged in Entry 2.
  - The agent broke the `angular-signals-component` description on its first edit ("It with signal-based state") and fixed it.
  - The four-bullet privacy "improvement" was folded into one theme, to match the brief's "one thing".
  - Operator wording in `tech-stack.md` was brought in line with the skill's `matches` (Entry 7).
  - Nothing has been compiled or run yet, because there is no code.

## Entry 12: Generated from KB: kb/types.ts

- **When:** 2026-09-27 17:55
- **Phase / skill:** Phase 1 / `risk-engine` (roadmap "Generate from the KB")
- **Prompt:** "start phase 1" (the agent derived the types as the roadmap's first "generated from the KB" step)
- **Output:** `backend/src/kb/types.ts`, derived from `risk-kb.json`. A script listed every key the KB uses:
  - top level: `version`, `schemaVersion`, `basePremium`, `coverageLoadFactor`, `riskBands`, `coverage`, `factors`
  - bands: `min`, `max`, `riskMultiplier`, `label`, `summary`
  - factors: `id`, `description`, `condition`, `points`, `perOccurrence`
  - leaf conditions: `field`, `operator`, `min`, `max`, `value`

  Each key maps to an interface field; the brief's keys are verbatim and ours are marked `// +`.
- **What changed:** `backend/src/kb/types.ts` (new)
- **Why:** The brief asks for code generated from the KB, not just boilerplate (R2), and for a KB schema typed with interfaces (R5 10). The interfaces are the source of truth: `kb/schema.ts` ends in `satisfies z.ZodType<Kb>`, so `tsc` fails if the Zod schema drifts from them.
- **Rejected / corrected:** A plain `LeafCondition` with named `min`/`max`/`value` fields was not used. Params sit flat on the leaf, as in the brief, and differ per operator, so the leaf has an `unknown` index signature and the registry's Zod schemas define the params. That keeps a new operator to one registry entry. The `all`/`any`/`not` groups and `enabled` are not in the KB yet (Phase 6 adds the compound factor), but they are typed now because the loader and schema must accept them.

## Entry 13: Phase 1: KB, operator registry, schema, loader and quality gates

- **When:** 2026-09-27 17:55
- **Phase / skill:** Phase 1 / `risk-engine` (plus `lambda-handler`'s `quote/request.ts`, which the loader's field check needs)
- **Prompt:** "start phase 1"
- **Output:** The backend scaffold and Phase 1 code:
  - `package.json` (`start`/`build`/`test`/`typecheck`/`lint`), strict `tsconfig` with `noUncheckedIndexedAccess`, `tsconfig.build.json`, Jest (ts-jest), ESLint flat config
  - `risk-kb.json`, extending the brief's example
  - `engine/operators.ts` (10 operators), `engine/template.ts`, `kb/schema.ts`, `kb/loader.ts` (the six checks, cache, `reloadKb`, `KB_PATH`), `quote/request.ts`, `quote/summary-tokens.ts`
  - specs for operators, template and loader

  Results: `tsc` clean; `npm run lint` clean; `jest` 51/51 passed; `npm run build` emits `dist/`; the numbers, `any`/`switch` and outbound-call greps print nothing. A script comparing the KB with the brief's example prints "removed/changed: none", and the additions are the band `riskMultiplier`/`label`/`summary`, `schemaVersion` and `coverage`. The KB's fields `[age, previousClaims, propertyType, propertyValue]` are all in the request schema.
- **What changed:** `risk-kb.json`; `backend/` (`package.json`, `package-lock.json`, `tsconfig*.json`, `jest.config.js`, `eslint.config.mjs`, `src/engine/*`, `src/kb/*`, `src/quote/request.ts`, `src/quote/summary-tokens.ts`); `CLAUDE.md` and `risk-engine/SKILL.md` (numbers-check comment filter)
- **Why:**
  - R1 25: the registry validates params and rejects unknown operators at load, and bands are ordered by `min`.
  - R4 15: "KB loaded correctly" means six checks, each naming its JSON path.
  - R5 10: no `any`, and the Zod schema `satisfies` the interfaces.
  - Lint rules were tested on a deliberately bad `engine/` file: they flagged `any`, `switch`, `2.2` and `15`.
  - Decisions not in the specs:
    - `summaryTokens` lives in `quote/summary-tokens.ts`, as the pattern allows, so the loader doesn't import the Phase 3 service.
    - `schemaVersion` is checked before the full shape, so a v2 KB gets one clear message.
    - Two extra load checks: `max >= min` per band, and `perOccurrence` only on a numeric request field.
- **Rejected / corrected:**
  - The agent's first `kb/schema.ts` had a meaningless `.check(...) &&` expression and a `key as keyof` cast; it was discarded.
  - A plain `z.union` for conditions was probed and rejected. Zod 4 reported a bad operator as a bare `"Invalid input"` with no path, which breaks "every error names the JSON path". The node kind is now chosen by key presence from a lookup table, giving `factors.3.condition.all.1.operator: unknown operator "nope"`.
  - `loader.spec.ts` first used an untyped `JSON.parse` (implicit `any`) and an `as typeof kb.riskBands` cast. Both passed the tests but were replaced with a Zod parse and `Object.fromEntries`.
  - The numbers check was itself wrong: its comment filter missed `/** */` lines and flagged a doc comment. It was fixed in `CLAUDE.md` and the skill.
  - Two doc comments quoting the brief's numbers (25, 75) were reworded, so `risk-kb.json` is the only file in `src` with scoring numbers.
  - Jest `roots` excludes `backend/test/` until Phase 2 creates it.
  - Tooling versions: Zod 4.6, TypeScript 6.0, Jest 30 with ts-jest 29.4. ts-jest 29 predates Jest 30 but ran cleanly.

## Entry 14: Generated from KB: scenario fixtures

- **When:** 2026-09-27 18:03
- **Phase / skill:** Phase 2 / `kb-driven-tests` (roadmap "Generate from the KB")
- **Prompt:** "start phase 2" (the fixtures are the roadmap's Phase 2 "generated from the KB" step)
- **Output:** `backend/test/scenarios/`: `_base.json` plus one file per factor and `bands.json`, 22 scenarios in all. For each factor, the inputs were derived from its condition: the trigger, both boundaries and a near-miss. `outside_range` 25–75 gets 18/24/25/75/76, `between` 1–2 gets 0/1/2/3, `gte 3` gets 2/3/20, `eq Flat` gets Flat/Bungalow, and `gt 750000` gets 750000/750001. The expected score, band and premium were worked out by hand, with the arithmetic in each `why`. `backend/test/configurability/` holds the brief's three cases (add the flood zone, claims 15 → 20, remove the flat factor) plus the compound "Flat AND > £500k".
- **What changed:** `backend/test/scenarios/*.json`, `backend/test/configurability/*.json` (new)
- **Why:** R1 25 asks that adding a factor needs only a KB change; the test side of that is a fixture, not test code, and the coverage check fails if a factor has none. Premiums per band are £360, £540 and £792 (300 × 1.0 / 1.5 / 2.2 × 1.2), so each multiplier is checked. The band boundaries were checked against the real KB by listing every reachable score: 25 and 60 are reachable and asserted; 26 and 61 are not, because all points are multiples of 5. The `why` lines say so, and `band.spec.ts` covers 26 and 61.
- **Rejected / corrected:** The agent's first draft got one expected value wrong. The `bands.json` case "HIGH_RISK: first reachable score above 60" used 70 and claimed 55 was the next score below it. It missed 2 claims (30) + Flat (10) + £900k (25) = 65. This was caught by re-checking the arithmetic before running anything, then confirmed by listing all reachable scores. The case now asserts 65. Nothing was captured from engine output; the tests passed on their first run, so a mutation run (claims weight 20 plus an unfixtured flood factor in the real KB) was used to prove they can fail.

## Entry 15: Phase 2: risk engine, quote service and KB-driven tests

- **When:** 2026-09-27 18:03
- **Phase / skill:** Phase 2 / `risk-engine`, then `kb-driven-tests`
- **Prompt:** "start phase 2"
- **Output:**
  - Engine: `engine/evaluate.ts` (recursion over leaf/all/any/not, registry dispatch), `engine/score.ts` (enabled factors, perOccurrence, typed `AppliedFactor[]`), `engine/band.ts` (last band with `min <= score`, clamp and warn), `engine/test-kb.ts`
  - Brought forward from Phase 3: `quote/response.ts`, `quote/service.ts`
  - Unit specs for evaluate, score, band and service
  - Runners `test/scenarios.spec.ts`, `test/configurability.spec.ts`, `test/coverage.spec.ts`, plus `scenario-schema.ts`, `load-fixtures.ts`, `expect-matches.ts`

  Results: `tsc` clean; lint clean; jest 10 suites, 124/124 passed; `npm run build` ships no spec files; the any/switch, numbers, outbound-call and scoring-literal greps print nothing. In the mutation check (claims 15 → 20 plus an unfixtured `flood_zone` in the real KB), exactly the expected 9 tests failed: the 4 claims scenarios, 2 band sums, 2 configurability "before" states, and the coverage check for `flood_zone`. The KB was restored with a 0-line diff.
- **What changed:** `backend/src/engine/{evaluate,score,band,test-kb}.ts` and their specs; `backend/src/quote/{response,service}.ts`, `service.spec.ts`; `backend/src/quote/request.ts` and `kb/loader.ts` (+ spec) for unscored fields; `backend/test/*.ts`; `backend/jest.config.js` (`test/` root); `specs/roadmap.md` (service moved into Phase 2); `CLAUDE.md` (status)
- **Why:**
  - R1 25 and R4 15: the evaluator is generic, with no switch; the brief's three KB-only changes and the compound factor are each proven against the same engine with an in-memory patched KB.
  - The brief's "Jest tests covering all 3 risk bands (3+ cases)": `bands.json` has 6 cases, with premiums.
  - Decisions not in the specs, each flagged in the roadmap:
    - `service.ts` was moved into Phase 2, because the band scenarios check premiums.
    - `AppliedFactor` lives in `engine/score.ts`, not `quote/response.ts`, so `engine/` never imports `quote/`.
    - `unscoredFields` in `request.ts` is the one source for fields that are never scored.
- **Rejected / corrected:**
  - The pattern's `import { AppliedFactor } from '../quote/response'` in the scorer was rejected, because it inverts the pattern's own dependency direction.
  - `service.spec` showed the loader accepted a factor on `customerName` that the service then stripped, so the factor would silently never fire; `kb-factor` rejects exactly that. The loader now rejects conditions on unscored fields ("collected but never scored"), with a test.
  - The first `baseRequest()` helper narrowed with a hand-written `typeof` check; it was replaced with a Zod parse, as the skill requires.
  - One documented `as` remains, in `configurability.spec.ts` (the typed-lookup idiom for the patch ops). It widens a function type and never touches data.
  - The wrong fixture value is recorded in Entry 14.

## Entry 16: Phase 3: Lambda-style handler, local server with KB hot reload

- **When:** 2026-09-27 18:23
- **Phase / skill:** Phase 3 / `lambda-handler`
- **Prompt:** "start phase 3"
- **Output:**
  - `src/http/types.ts` (local API Gateway-shaped types)
  - `src/handler.ts`: `handler(event, context)` with a `Record<"METHOD /path", fn>` route map, CORS on every response, and 400/404/500 mapping
  - `src/server.ts`: `node:http` translator; `loadKb()` before listen, which exits 1 with the named error; `fs.watchFile` hot reload with last-good fallback
  - `backend/requests/{standard,elevated,high-risk}.json`
  - `src/handler.spec.ts` (12 tests)

  Results: `tsc` clean; lint clean; jest 11 suites, 136/136 passed; the any/switch/framework/AWS and outbound-call greps print nothing. Live on `npm start`:
  - `/health` returns 200 with `kbVersion` 1.0.0.
  - `{"age":12}` returns 400 with 6 field issues.
  - The three samples return 10/STANDARD/£360, 30/ELEVATED/£540 and 85/HIGH_RISK/£792, all hand-computed in advance and matching.
  - Unknown route → 404; preflight → 204 with CORS.
  - Hot reload with no restart: Flat 10 → 20 and v1.0.1 took effect; invalid JSON was logged as "reload rejected; last good KB still serving" while quotes kept returning v1.0.1; the revert brought back 1.0.0 with a 0-line KB diff.
  - A bad `KB_PATH` exits 1 with `factors.0.condition.operator: unknown operator "regex"`, and `node dist/server.js` serves `/health`.
- **What changed:** `backend/src/{http/types,handler,server,handler.spec}.ts`, `backend/requests/*.json` (new); `CLAUDE.md` (status)
- **Why:**
  - R4 15: clean handler export and a table-driven route map; CORS on every status.
  - Constraint 5 and "no internals": a 500 carries only `{ error, requestId }`, and the loader's detail goes to stderr (the spec asserts `regex` is absent from the body).
  - Constraint 6: `npm start` alone runs it.
  - R6 10: hot reload is what lets the live demo change the KB with no restart.
  - The 500 test uses `jest.spyOn(loader, 'loadKb')` instead of `KB_PATH` plus `jest.isolateModules`. Re-requiring through isolateModules returns `any`, or needs dynamic `import()`, which ts-jest's CommonJS mode doesn't intercept. The spy is typed and was shown to take effect: without it the response would have been 200.
- **Rejected / corrected:**
  - Three details of the pattern were changed. Its 404 body echoed the caller's method and path; it is now a fixed `"Not found"`, so no input is reflected. An issue with an empty path now reports `(body)` instead of `""`. `server.ts` now catches the startup error and prints only the loader's message with exit code 1, instead of an uncaught stack trace.
  - The agent's first background `npm start` failed: it ran in the repo root, with no `package.json`, because the `cd` didn't carry over. It was rerun as `npm --prefix backend start`, the form the README will use.
  - Nothing from the reject table appeared in the first draft.
