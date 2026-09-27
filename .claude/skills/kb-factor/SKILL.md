---
name: kb-factor
description: Adds, changes, disables or removes a risk factor in the PolicyQuote knowledge base (risk-kb.json) as a KB-only edit, then proves it with a scenario fixture, the tests, a curl against the running backend and the UI. This is the live-demo skill. Use it whenever someone describes a scoring rule in plain English, such as "add a flood zone factor for Eircodes in routing areas T12 or N37, +15", "claims penalty should be 20 not 15", "remove the young driver factor", "Flat AND over €500k is +35", "bump the KB version", or when the panel asks for a new factor during the live review. Also use it to turn an underwriter's wording into a condition. If the rule needs a new operator, a new request field or an engine change, this skill stops and hands over to risk-engine or lambda-handler.
---

# KB factor

A factor change is a KB edit, never a code edit. This skill turns a plain-English rule into a `factors[]` entry in `risk-kb.json`, and shows it working with a fixture, the tests, a curl request and the UI, with no file under `backend/src` or `frontend/src` changed. That shows the four KB-only changes from `specs/mission.md` ("The core principle"): add a factor, change a weight, remove a factor, combine fields.

It is the skill used in the live review (R6 10) and the proof for R1 (25), so it is written for speed and for explaining each step out loud.

## Before you edit

1. Read `risk-kb.json`, and `backend/src/engine/operators.ts` for the operators that **actually exist**. Don't trust a list from memory. `specs/tech-stack.md` "Engine design" names the starting set.
2. Read `backend/src/quote/request.ts` for the request fields and their types and ranges. A factor can only read those fields.
3. Read `specs/tech-stack.md` "Knowledge Base" for the factor shape and schema decisions, and roadmap Phase 6 for the rehearsal steps.

## Steps

1. **Restate the rule** back to the user in one line of KB terms before editing, for example: *"`flood_zone`: `postcode starts_with [T12, N37]`, +15, not per occurrence."* Settle any ambiguity now (see "Pinning down the wording"). In the live demo, say it out loud.
2. **Check it fits.** Stop and escalate (see "When to stop") if it needs an operator, a field or a behaviour that doesn't exist. Don't work around it inside the KB.
3. **Edit `risk-kb.json`.**
   - **Add:** append to `factors[]`. `id` is new and snake_case. `description` is customer-facing text, because the UI shows it verbatim ("Property in a flood-risk Eircode routing area", not "PC_FLOOD"). Integer `points`. `perOccurrence` only when points scale with a numeric field ("per claim").
   - **Change:** edit only the requested key of the existing factor. Keep its `id`, so history and fixtures still line up.
   - **Disable** ("turn off", "pause"): set `"enabled": false` and keep the entry.
   - **Remove** ("delete", "drop"): delete the entry.
   - The brief's five original factors change only when the user explicitly asks. Never reshape the KB: `riskBands` stays an object, `999` stays, and the keys stay as they are.
   - **Bump `version`:** minor for add, remove or change of a factor, patch for wording only. `schemaVersion` never changes for a factor edit.
4. **Add or update the scenario fixture** following the `kb-driven-tests` skill: a new factor gets `backend/test/scenarios/<id>.json` (its "Writing a factor's fixture" table lists the cases for each operator). Expected values are worked out by hand, with the arithmetic in `why`. The coverage test fails if a new factor has no fixture. At minimum add:
   - one request that triggers the factor, with the expected `riskScore`, `riskBand` and applied ids
   - one near-miss that doesn't (a boundary value, the other half of an AND)

   For a change or removal, update the expected values of the existing scenarios that move, and say which ones moved and why. That diff is the proof.
5. **Add a sample request** to `backend/requests/<id>.json` for a new factor (`flood-zone.json` and `compound.json` are the spec's names for the demo ones).
6. **Verify** with the definition of done below. The server hot-reloads the KB, so don't restart it; a restart would hide a broken reload.
7. **Log it** with `agent-log`: the prompt verbatim, the factor as written, and anything the agent got wrong on the first try.

## Pinning down the wording

| The rule says | Write | Watch for |
|---|---|---|
| "over €500k", "more than" | `gt 500000` | "€500k or more" means `gte` |
| "under 25", "younger than 25" | `lt 25` | "25 and under" means `lte` |
| "between 1 and 2 claims" | `between min 1 max 2` | `between` is inclusive at both ends |
| "under 21 or over 70" | `outside_range min 21 max 70` | exclusive: 21 and 70 don't match |
| "Eircode in T12 or N37" | `starts_with values ["T12","N37"]` | routing keys are always 3 characters, so give the whole key: a partial `"D0"` spans D01–D08, and `"D6"` also matches `D6W`. Grouping by county needs an area-aware operator, so escalate |
| "flats or bungalows" | `in values ["Flat","Bungalow"]` | values must be the request enum's spelling exactly (`House` / `Flat` / `Bungalow`) |
| "Flat AND over €500k" | `all: [eq Flat, gt 500000]` | two fields means a group, not two factors |
| "X OR Y" | `any: [...]` | if both X and Y should score separately, that's two factors |
| "not a House" | `not: { eq House }`, or `neq House` | prefer the single leaf when it says the same thing |
| "+15 per claim" | `perOccurrence: true` on a leaf over the numeric field | not allowed on `all`/`any`/`not`; the loader rejects it |

If the points or the boundary are ambiguous, ask. Don't guess a number in front of the panel.

## When to stop

Stop and say what's missing instead of improvising. Each of these is a code change owned by another skill:

| Need | Hand over to | Why not in the KB |
|---|---|---|
| An operator that isn't in the registry (regex, postcode area, date maths) | `risk-engine` (one registry entry plus tests) | the loader rejects unknown operators; that's the design working |
| A field the request doesn't have (`yearBuilt`, `hasAlarm`) | `lambda-handler` (Zod schema) and the Angular form | the loader rejects unknown fields; the form must collect it |
| Points that aren't integers, a multiplier instead of points, or a new band | `risk-engine` and the specs | changes the scoring model, not a factor |
| A discount (negative points) that could push the total below 0 | `risk-engine` | band lookup assumes a score of 0 or more |

When escalating in the live demo, say it plainly: *"This needs a new operator. That's one registry entry, which the risk-engine skill covers; the factor itself stays a KB edit."* Then continue only if the user agrees.

## Reject these outputs

| Output | Why |
|---|---|
| Any edit under `backend/src` or `frontend/src` (apart from test fixtures) | the change is no longer KB-only, which is the claim being demonstrated (R1 25) |
| `if (factor.id === '…')`, or a new field, operator or label hardcoded to make the factor work | hardcoded scoring; escalate instead |
| A new factor that repeats an existing one's condition instead of changing it | two factors silently double-count |
| Reworded, reordered or reshaped brief factors, bands or keys nobody asked to change | the KB must diff as additions only against the brief |
| `description` that's an internal code, or that says what the code does | the UI shows it to the customer verbatim |
| `"points": "15"`, a decimal, or `perOccurrence` on a group | fails the loader; catch it before running |
| Enum values that don't match the request (`"flat"`, `"Detached"`) | the factor never fires, and nothing errors |
| `version` not bumped | `kbVersion` in the UI and `/health` wouldn't show the change |
| Expected values in fixtures changed without saying which and why | hides a regression inside the "proof" |
| Restarting the backend to pick up the change | hides whether hot reload works; the demo depends on it |

## Definition of done

Run these and report the real output. Don't claim success without it.

```bash
# 1. The KB loads (named error on failure)
cd backend && npx tsx -e 'import("./src/kb/loader").then(m => console.log("KB ok", m.loadKb().version))'

# 2. Only KB, fixtures and sample requests changed
git status --short          # expect risk-kb.json, backend/test/scenarios/*, backend/requests/*; nothing under src/ (the configurability proof uses a frozen baseline KB, so it never needs a change here)

# 3. Tests
cd backend && npx jest

# 4. Live, against the running backend (npm start or docker compose; no restart)
curl -s localhost:3000/health                                   # kbVersion is the bumped version
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' \
  -d @backend/requests/<id>.json                                # appliedFactors contains the id and its description; riskScore and band as the fixture expects
```

For a removal or disable, step 4 checks the id is **absent** from `appliedFactors` for a request that used to trigger it.

Then check the UI (`http://localhost:4200`, or `:8080` under Docker): submit the sample request, and the new factor's `description` and points appear in the applied factors list, and the page shows the new `kbVersion`.

If a step fails, don't hide it. An invalid KB edit leaves the last good KB serving, so fix the JSON and let it reload. Finish with an `agent-log` entry.
