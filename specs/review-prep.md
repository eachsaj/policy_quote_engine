# Review prep: rubric self-audit and Q&A

Written in Phase 8 against the running app and the code. Each "Evidence" item was produced in this session and is recorded in `AGENT_LOG.md`.

## Rubric self-audit

| # | Area (pts) | Status | Evidence |
|---|---|---|---|
| R1 | KB design & configurability (25) | ✅ | `risk-kb.json` diffs against the brief as additions only (script, Phase 8), and since 1.3.0 the brief's five factors are verbatim again, including the £ wording: Irish quotes get € wording from the additive `descriptions.EUR` key (Entry 31). Add, change and remove are proven by `backend/test/configurability/*` against a frozen baseline. The compound factor was added as a KB-only change (Entry 20: nothing under `src/` changed). The live flood-zone edit appeared in the UI with no frontend change (Entry 19). |
| R2 | Agent workflow & skills (20) | ✅ | 23 chronological log entries, each with a real rejection. 6 project skills with reject tables and runnable definitions of done. Commits cite log entries from #11. Rejections include the skill's own flawed rules (Entries 20, 22). |
| R3 | Angular signals & reactivity (20) | ✅ | Exactly 3 writable signals. `canSubmit`, `announcement`, `sortedFactors` and `totalPoints` are `computed()`. One `effect()`, which only moves focus. `input()` on the badge and result. The Subject import is banned by a lint rule. Factor rows come from `appliedFactors` (a spec renders an unknown factor). |
| R4 | Lambda handler & risk engine (15) | ✅ | `handler(event, context)` with a route lookup map. Loader with six checks, each naming the JSON path. Operator registry, no `switch` (lint rule and grep). Typed `QuoteResponse` with `appliedFactors`. `/health` returns `kbVersion` in Docker. |
| R5 | Code quality & TypeScript (10) | ✅ | Strict TS in both packages, `no-explicit-any` as an error, 0 greps for `any` or casts in shipped code. KB typed by interfaces, and the Zod schema `satisfies` them. Layers: handler, service, engine, loader. |
| R6 | Live demo & explanation (10) | ✅ | `kb-factor` rehearsal took 200 s and found and fixed a demo-breaking coupling (Entry 22). Hot reload works in `npm start` and in Docker (Entries 16, 23). Q&A below. |

Final gates (Phase 8): backend `tsc`, lint, **146/146** Jest, build; frontend build, lint, **38/38** Vitest. All grep gates pass. A fresh clone from GitHub runs with the 4 README commands **and** with `docker compose up --build`.

**Submission branch:** Phases 0–7 reached `main` through PRs #1–#4 (merged 2026-09-27). Phase 8 goes to `main` the same way.

## Q&A: short answers

**Why these skills and this `CLAUDE.md`?**
`CLAUDE.md` stays lean: the brief's 8 constraints, the hard rules and the commands. Know-how lives in skills that load only when their files are touched, which is progressive disclosure, so the context holds only what the task needs. Every skill ends in a reject table (known-bad outputs, e.g. `switch` over operators, `BehaviorSubject`, `any` on the event) and a runnable definition of done, so agent output is verified, not trusted. `kb-factor` exists for the live demo: it restates the rule, edits only the KB, adds a hand-worked fixture and checks with curl and the UI.

**What did you reject from agent output, and why?** (the full list is in `AGENT_LOG.md`)
- A plain `z.union` for conditions. Zod 4 reported bad operators as "Invalid input" with no path, so the node kind is now picked by key presence (Entry 13).
- A fixture expecting 70 as the lowest HIGH_RISK score. 65 is reachable; this was caught by re-doing the arithmetic, then confirmed by listing every reachable score (Entry 14).
- `setValue(v as never)` in a form spec, and untyped `JSON.parse` in a loader spec (Entries 13, 18).
- The skill's own rule to patch the *live* KB in the configurability proof. The rehearsal showed it would turn the panel's flood-zone example red (Entry 22).
- `angular-new-app`'s Tailwind step and global CLI install (constraint 4).

**How does the schema handle a factor that combines two fields ("Flat AND over €500k")?**
A condition is a leaf or a group: `all` (AND), `any` (OR) or `not`, nested to any depth. The evaluator recurses over the four node kinds and looks operators up in a registry. `flat_high_value` is in the KB now, as pure data:
`{ "all": [ { "field": "propertyType", "operator": "eq", "value": "Flat" }, { "field": "propertyValue", "operator": "gt", "value": 500000 } ] }`, +35.

**How would you support version-controlled rule sets in production?** (README "KB versioning")
Rules (`version`) and shape (`schemaVersion`) are versioned separately. The KB lives in git; each change is a pull request whose fixtures prove the new scores. A pipeline validates it with the service's own `parseKb`, runs the scenarios and publishes an immutable versioned artefact. The service selects a version by configuration (`KB_PATH` or a pinned pointer), not by redeploying. Every quote carries `kbVersion` as its audit trail. A breaking shape uses expand/contract, and an unsupported `schemaVersion` is rejected while the last good KB keeps serving (`versioning.spec.ts`).

**What would you change?**
Data minimisation (`SOLUTION.md`). Also: a partial Eircode routing key such as "D0" spans D01–D08 with `starts_with`, so a routing-key operator (exact match on the first 3 characters) would be safer. Negative points (discounts) need a floor at 0 in the band lookup.

## Live-demo script (the panel names a factor)

1. `npm --prefix backend start` and `npm --prefix frontend start` (or `docker compose up --build`); open the UI.
2. Ask the agent, via `kb-factor`: restate the rule in KB terms. If it needs a new operator or field, say so; that's an escalation, not a KB edit.
3. Edit `risk-kb.json` and bump `version` (minor). Add `backend/test/scenarios/<id>.json` with the arithmetic in `why`.
4. `git status`: only the KB, fixtures and sample requests changed. `npm --prefix backend test`: green.
5. `curl localhost:3000/health`: new `kbVersion`, no restart. Submit the form: the new factor row and "Rules version" appear.

Rehearsed for the brief's own example, "+15 if postcode starts with 'EX' or 'PL'" (Entry 31): one KB save (factor + version), then `ex4 4qj` and `PL4 8AA` score +15 with £ wording, and `M1 1AE` doesn't. UK postcodes are accepted alongside Eircodes, so a UK-based factor can be shown working. Save the factor and the version bump **in one edit**, or the backend briefly serves the new rule under the old version (Entry 29).
