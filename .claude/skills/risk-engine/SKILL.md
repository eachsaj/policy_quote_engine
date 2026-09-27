---
name: risk-engine
description: Builds and changes the PolicyQuote risk engine and KB loading, the table-driven code that turns a quote request plus risk-kb.json into a score, a band and a premium. Use for anything touching backend/src/engine/* (operators, evaluate, score, band, template), backend/src/kb/* (types, schema, loader), backend/src/quote/service.ts or quote/response.ts, or the shape of risk-kb.json. That includes the operator registry, compound all/any/not conditions, perOccurrence, band lookup, the premium formula, riskSummary templates, appliedFactors, kbVersion/schemaVersion and the loader's validation and hot-reload. Use it even when the request only says "add an operator", "the score is wrong", "the KB won't load" or "support OR conditions". For adding, changing or removing a single factor in the KB, prefer kb-factor if it exists.
---

# Risk engine

The engine is a generic interpreter for `risk-kb.json`. It iterates the factors, evaluates each `condition` through an operator registry, sums the points, looks up the band and prices the quote. Every number, threshold, label and piece of customer wording lives in the KB. Code holds only mechanisms.

The protocol layer (`handler.ts`, `server.ts`, `quote/request.ts`) belongs to the `lambda-handler` skill. This skill ends at `getQuote(request, kb)`.

## Before you write code

1. Read the specs. They hold the agreed decisions; don't re-decide them. If a request conflicts with them, stop and ask, then update the spec in the same turn.
   - `specs/mission.md`: "The core principle" (the four KB-only changes the engine must support) and the Knowledge Base scope, including the `perOccurrence` decision.
   - `specs/tech-stack.md`: "Knowledge Base" (schema decisions table), "Engine design", "Module boundaries", "Loading the KB correctly" (the six checks), "Premium and response" and "Quality gates".
   - `specs/roadmap.md`: Phase 1 (KB schema, loader, gates) and Phase 2 (engine) for build order and their "Done when" checks. Work one phase at a time, and don't start Phase 2 until Phase 1's checks pass.
2. Read `risk-kb.json` if it exists, and the brief's example KB. **Extend the brief's example, never reshape it:** `riskBands` stays an object keyed by band id with `min`/`max` (including `999`), factors keep `id`, `description`, `condition`, `points`, `perOccurrence`. Additions are new keys only.
3. Read `references/engine-pattern.md` and copy its shape: registry, evaluator, scorer, band lookup, template, loader checks, service, specs.
4. Check that every `condition.field` in the KB exists in `quote/request.ts` (one-liner in `CLAUDE.md`).

## Rules

- **The operator registry is the only place operators exist.** Each entry is a Zod parameter schema plus a pure `test`. The KB schema validates leaf params from the registry, so an unknown operator or bad params fails at load. A new operator is one registry entry and nothing else.
- **No `switch` and no if/else ladder over operators, factor ids, band ids or field names.** Recursion over the four condition node kinds (leaf / `all` / `any` / `not`) through type guards is structural and allowed.
- **No KB field names and no scoring numbers in `engine/`.** No `previousClaims`, `'Flat'`, `15`, `2.2`, `999`. The engine reads `condition.field` from the KB and looks it up on the input generically.
- **`perOccurrence: true` awards `points × value of the condition's field`.** It is only valid on a leaf condition over a numeric field; the loader rejects it on a group.
- **Bands:** sort by `min` at load. Lookup takes the last band whose `min <= score`. A score above the top band's `max` stays in the top band and logs a warning; never throw.
- **Premium:** `annualPremium = basePremium × band.riskMultiplier × coverageLoadFactor`, `monthlyPremium = annualPremium / 12`. Round to 2 dp only when building the response.
- **Wording:** `riskSummary` comes from the band's `summary` template via a generic `{token}` interpolator. The loader rejects tokens the service doesn't supply.
- **Types:** `kb/types.ts` interfaces are the source; the Zod schema in `kb/schema.ts` is checked against them. No `any`, no `as` casts on KB data. Parse to `unknown`, narrow with Zod.
- **Loader:** `loadKb()` caches; `reloadKb()` re-validates and swaps atomically, keeping the last good KB on failure. `KB_PATH` overrides the default `../risk-kb.json`. Every error message names the offending JSON path (`factors[3].condition.all[1].operator`).
- **Purity:** `engine/*` and `quote/service.ts` are pure functions of `(input, kb)`. No `fs`, no `process.env`, no clock, no logging except the band-clamp warning. Tests use in-memory KBs.

## Reject these outputs

| Output | Why |
|---|---|
| `switch (op)` or `if (op === 'gt') … else if …` | the rubric's "generic evaluator, no switch" line (R4 15) |
| `if (factor.id === 'flood_zone')` or any factor-specific branch | the engine is no longer table-driven (R1 25) |
| `previousClaims`, `'Flat'` or a multiplier/threshold literal in `engine/` | hardcoded scoring; fails the no-numbers grep |
| `riskBands` rewritten as an array, `999` replaced by `null`, `description` renamed `label` | reshapes the brief's KB; rejected in AGENT_LOG Entry 5 |
| Band order taken from object key order | keys carry no order; sort by `min` |
| `perOccurrence` counted as "1 if matched" or applied to a group condition | contradicts the agreed definition in `specs/mission.md` |
| Unknown operator silently evaluates to `false` | must fail at load with the path |
| `value: any`, `params as BetweenParams`, `JSON.parse(raw) as Kb` | "no `any`" (Code 10); narrow with Zod |
| Rounding inside the scorer or on the multiplier | rounding only at the response boundary |
| `readFileSync` or `process.env` inside `engine/` or `service.ts` | I/O belongs to the loader |
| An LLM or HTTP call for scoring, or a KB fetched from a URL | the brief's constraint 5: deterministic and self-contained, the KB is a local file |

## Definition of done

Run all of these and report the real output. Don't claim success without it.

These combine roadmap Phase 1 and Phase 2 "Done when" with the `tech-stack.md` quality gates.

```bash
cd backend && npx tsc --noEmit
cd backend && npm run lint                                  # no-explicit-any, SwitchStatement ban, no-magic-numbers (ignore 0, 1) in engine/
cd backend && npx jest src/engine src/kb src/quote
grep -rnE 'switch\s*\(|:\s*any\b|as any' backend/src/engine backend/src/kb backend/src/quote/service.ts    # must print nothing
grep -rnE --exclude='*.spec.ts' --exclude='test-kb.ts' '\b[0-9]+\.[0-9]+\b|\b([2-9]|[1-9][0-9]+)\b' backend/src/engine | grep -vE '^\S+:\s*(//|\*)'   # must print nothing: catches 2.2, 1.5, 15, 999; allows 0 and 1
grep -rnE 'fetch\(|https?\.request|axios|openai|anthropic' backend/src                                   # must print nothing (constraint 5)
node -e 'const kb=require("./risk-kb.json");const f=new Set();const w=c=>c.field?f.add(c.field):[...(c.all??[]),...(c.any??[]),...(c.not?[c.not]:[])].forEach(w);kb.factors.forEach(x=>w(x.condition));console.log([...f])'   # every field is in quote/request.ts
```

The tests must include: one scenario per band, the band boundaries (25/26, 60/61), a score above the top `max`, `perOccurrence` maths, each operator, `all`/`any`/`not`, each loader failure named by path, and the configurability proof (add a factor, change a weight, remove a factor on an in-memory KB, with no engine change).

Also confirm by hand (Phase 1): `risk-kb.json` is the only file with scoring numbers, and diffing it against the brief's example shows additions only.

Finish with an `agent-log` entry, and record anything from the reject table that the first draft contained. The roadmap asks for a separate "Generated from KB" entry whenever the agent derives code from the KB (`kb/types.ts` in Phase 1, scenario fixtures in Phase 2).
