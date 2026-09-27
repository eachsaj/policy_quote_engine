---
name: kb-driven-tests
description: Writes and maintains the PolicyQuote KB-driven Jest tests, JSON scenario fixtures run through test.each against the real risk-kb.json, plus the configurability proof (the same engine against patched in-memory KBs) and the coverage check that every factor and band has a scenario. Use for anything under backend/test/scenarios/, backend/test/configurability/ or the specs that run them, for "generate test cases from the KB", "cover all three bands", "prove a factor is a KB-only change", "why did the scenario test fail", or when a KB edit moves expected scores. kb-factor calls it to add a factor's fixture. Unit tests of individual engine functions (operators, evaluate, band) belong to risk-engine; handler tests belong to lambda-handler.
---

# KB-driven tests

The tests are data. Each scenario is a JSON file: a request, the result a person worked out from the KB by hand, and one line showing the arithmetic. One `test.each` runner loads them all. Adding a factor means adding a fixture, not a test function. That is the test-side half of "a new factor is a KB change only" (R1 25), and it covers the brief's "Jest tests covering all 3 risk bands (3+ cases)".

## Scope

| Layer | Owner | What |
|---|---|---|
| Unit: `operators`, `evaluate`, `band`, `template`, loader failures | `risk-engine` | in-memory tables in `src/engine/*.spec.ts` and `src/kb/*.spec.ts` |
| **Scenarios** against the real `risk-kb.json` | **this skill** | `backend/test/scenarios/*.json` → `backend/test/scenarios.spec.ts` |
| **Configurability proof** against a patched, frozen baseline KB | **this skill** | `backend/test/configurability/*.json` + `_baseline-kb.json` → `backend/test/configurability.spec.ts` |
| **Coverage check**: every factor and band has a scenario | **this skill** | `backend/test/coverage.spec.ts` |
| HTTP envelope, 400/404/500 | `lambda-handler` | `src/handler.spec.ts` |

## Before you write tests

1. Read the specs: roadmap Phase 2 (the required case list and "Configurability proof"), `specs/tech-stack.md` "Knowledge Base" (the `perOccurrence` and band decisions) and "Quality gates", and `specs/mission.md` "The core principle" (the four KB-only changes).
2. Read `risk-kb.json`: every factor's condition and points, and every band's `min`, `max` and `riskMultiplier`.
3. Read `backend/src/quote/request.ts`. Fixtures are parsed with the real `quoteRequestSchema`, so they can't drift from the contract.
4. Read `references/scenario-pattern.md` and copy its file formats and runners.

## Rules

- **Expected values are worked out by hand from the KB, never by running the engine.** Every scenario has a `why` line with the arithmetic: `"2 claims × 15 = 30 → ELEVATED (26–60); 300 × 1.5 × 1.2 = 540"`. A fixture captured from `getQuote` output only proves the code agrees with itself.
- **"Generated from the KB"** (roadmap) means the agent derives the *inputs* from each factor's condition: the value that triggers it, the boundary, and the near-miss. It then works out the outputs with its reasoning shown. Log each generation as its own `agent-log` entry.
- **One scenario file per factor** (`<factor_id>.json`), plus `bands.json` for whole-quote band cases. At minimum each factor file has a trigger and a near-miss. `between`, `gt` and similar get both boundary values. Compound factors get one case per failing branch.
- **Scenarios override a base request.** `_base.json` is a request that triggers no factor. `coverage.spec.ts` asserts it scores 0, so a KB change that makes the base request trigger a factor is caught straight away.
- **Assert ids, not wording.** `appliedFactorIds` is compared as a set. Text belongs in the KB and is checked once, for the description passing through unchanged.
- **Band boundaries on the real KB only when reachable.** If no combination of real factors lands exactly on 25/26 or 60/61, say so in `bands.json`'s `why`. The `band.spec.ts` unit table (`risk-engine`) covers the exact boundaries.
- **Configurability proof uses data patches, never code.** Each case applies `addFactor`, `setPoints` or `removeFactor` to an in-memory copy of the **frozen baseline** `configurability/_baseline-kb.json` (the v1.0.0 KB), never the live `risk-kb.json`. The proof is about the engine, so it must not move when the live rules do: patching the live KB made the flood-zone case collide with a live `flood_zone` edit in the Phase 6 rehearsal (AGENT_LOG Entry 22). The live KB is covered by the scenario fixtures and the coverage check. The ops are a lookup table in the runner, not a `switch`. The result must differ from the unpatched baseline for the same request. Never edit the baseline to make a case pass.
- **When a KB edit moves expected values,** update only the scenarios whose arithmetic changed, and rewrite their `why`. Report which ones moved. That list is the review evidence.
- No `any` in runners. Fixture files are parsed from `unknown` with Zod, so a malformed fixture fails with its file name and path.

## Reject these outputs

| Output | Why |
|---|---|
| Expected values copied from running `getQuote` or a Jest snapshot | circular: proves nothing about the KB |
| A scenario without `why`, or a `why` that doesn't add up | the reviewer can't check it, and neither can you in the live demo |
| A new `it(...)` block per factor instead of a fixture file | the tests stop being table-driven; adding a factor would need code |
| Factor ids, points or band names hardcoded in a `.spec.ts` runner | the runner must be generic, like the engine |
| Scenarios typed with `as QuoteRequest`, or parsed without Zod | fixtures silently drift from the request contract |
| Asserting `riskSummary` or `description` text in scenarios | wording changes would break scoring tests |
| Changing expected values to make a failing test pass without explaining the arithmetic | hides a regression |
| Configurability proof that edits `risk-kb.json` on disk, patches the live KB, or mocks the engine | must be the same engine against a different in-memory KB, independent of today's rules |
| A factor in the KB with no scenario, fixed by skipping the coverage check | the check is how a missing fixture is caught |

## Definition of done

Run these and report the real output.

```bash
cd backend && npx tsc --noEmit
cd backend && npx jest test/                     # scenarios, configurability, coverage
cd backend && npx jest                           # full suite still green
grep -nE ':\s*any\b|as any|switch\s*\(' backend/test/*.ts    # must print nothing
```

Check the output shows:
- at least one scenario per band (STANDARD, ELEVATED, HIGH_RISK)
- a scenario file for every enabled factor id
- `_base` scoring 0
- the three configurability cases from the brief (add a factor, change a weight, remove a factor), each changing the result

Finish with an `agent-log` entry. Mark fixtures generated from the KB as such, and record any expected value the first draft got wrong, and why.
