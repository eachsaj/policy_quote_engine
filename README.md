# PolicyQuote: Policy Risk & Premium Engine

A single-page home insurance quote tool: an Angular frontend, a Lambda-style Node.js backend, and a risk engine whose rules live entirely in a JSON Knowledge Base, **[`risk-kb.json`](risk-kb.json) at the repo root**. Adding, changing or removing a risk factor is a KB edit, with no code change.

## Run it (1 command)

Requires Node.js 22 or 24 LTS.

```bash
npm start                         # from the repo root: backend :3000 + frontend :4200
```

Then open http://localhost:4200. The root `npm start` runs [`scripts/start.mjs`](scripts/start.mjs), which has no dependencies. It installs each package's dependencies on the first run (`npm ci`), starts both services with `[backend]` / `[frontend]` prefixed output, and stops both on Ctrl+C or when either one exits.

Each package still starts on its own, as the brief requires:

```bash
npm --prefix backend install && npm --prefix backend start     # http://localhost:3000  (POST /policy/quote, GET /health)
npm --prefix frontend install && npm --prefix frontend start   # http://localhost:4200  (proxies /policy and /health to :3000)
```

### Or with Docker (1 command)

```bash
docker compose up --build         # http://localhost:8080  (backend also on :3000)
docker compose down               # stop and remove the containers
```

Under Docker the UI is on **:8080**, not :4200 (that port is only used by `npm start`).

- `backend/Dockerfile` is a multi-stage, Fargate-ready image: non-root, configured by env, with a `HEALTHCHECK` on `GET /health` (which returns the active KB version) and only production dependencies. It runs locally only.
- `frontend/Dockerfile` builds Angular and serves it with nginx, which proxies `/policy` and `/health` to the backend, so the browser stays same-origin.
- Compose mounts the repo root **read-only** at `/app/kb`, so `KB_PATH=/app/kb/risk-kb.json` is the live file. Edit `risk-kb.json` on the host and the next quote uses it: no rebuild, no restart.

Sample requests are in [`backend/requests/`](backend/requests): one per band (`standard`, `elevated`, `high-risk`), plus the `compound` and `flood-zone` demos. `standard` and `high-risk` use UK postcodes; the others use Eircodes.

```bash
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' -d @backend/requests/high-risk.json
```

## Tests

```bash
npm --prefix backend test         # Jest: engine, loader, handler, KB-driven scenarios, configurability proof
npm --prefix frontend test        # Vitest: form validators, signal state, result panel, badge
```

## How it works

```
browser ── POST /policy/quote ──▶ server.ts (node:http, or API Gateway in a real Lambda)
                                    └─▶ handler(event, context)   parse JSON, validate with Zod, route
                                          └─▶ getQuote(request, kb)   quote/service.ts: premium formula, currency, response
                                                └─▶ scoreRisk / findBand   engine/: evaluate each KB factor, sum points, pick the band
                                    risk-kb.json ──▶ kb/loader.ts   validated at startup, hot-reloaded on change
```

| Folder (`backend/src`) | Responsibility |
|---|---|
| `handler.ts`, `http/` | Protocol only: the Lambda entry point, route table, CORS and error mapping. No scoring. |
| `server.ts` | Local adapter from `node:http` to the handler, plus the KB file watcher. No routing or validation. |
| `quote/` | The request contract (Zod), postcode → currency, and `getQuote`: the brief's premium formula. |
| `engine/` | Pure scoring: the operator registry, the condition evaluator, points and band lookup. No numbers of its own. |
| `kb/` | KB types, schema, loader (six checks, each naming the JSON path), hot reload and the Lambda refresh. |

The frontend (`frontend/src/app`) is one standalone page: `quote/quote-page.component` holds the form and the three state signals (`loading`, `quoteResult`, `errorMessage`), `quote-result.component` renders the quote, and `risk-band-badge` is the reusable badge.

### API

`POST /policy/quote` takes the brief's six fields and returns the brief's seven fields, plus `currency`, `riskBandLabel` and `kbVersion`:

```bash
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' \
  -d '{ "customerName": "Cara Compound", "age": 40, "propertyType": "Flat", "propertyValue": 600000, "postcode": "SW1A 1AA", "previousClaims": 0 }'
```

```json
{
  "monthlyPremium": 45, "annualPremium": 540, "currency": "GBP",
  "riskBand": "ELEVATED", "riskBandLabel": "ELEVATED", "riskScore": 45,
  "riskSummary": "Elevated risk profile: 2 risk factor(s) applied for a total score of 45. A loading has been added to the premium.",
  "coverageDetails": { "basePremium": 300, "riskMultiplier": 1.5, "coverageLoadFactor": 1.2, "sumInsured": 600000,
                       "items": [{ "id": "buildings", "description": "Buildings cover" }] },
  "appliedFactors": [
    { "id": "property_type_flat", "description": "Flat — higher shared risk", "points": 10, "occurrences": 1 },
    { "id": "flat_high_value", "description": "Flat valued over £500,000 — higher shared-building exposure", "points": 35, "occurrences": 1 }
  ],
  "kbVersion": "1.3.0"
}
```

| Field | Rule |
|---|---|
| `customerName` | 1–100 characters. Collected, but never scored. |
| `age` | Integer, 18–120. |
| `propertyType` | `House`, `Flat` or `Bungalow`. |
| `propertyValue` | Greater than 0, in the postcode's currency. |
| `postcode` | A UK postcode or an Irish Eircode; upper-cased. |
| `previousClaims` | Integer, 0–20, in the last 5 years. |

Errors: **400** `{ error, issues: [{ field, message }] }` names every invalid field, for example `{ "field": "postcode", "message": "Must be a valid UK postcode or Eircode" }`. **404** `{ error }` for an unknown route. **500** `{ error, requestId }` with no internal detail (that goes to the server log). `GET /health` returns `{ status, kbVersion, schemaVersion, factorCount }`.

## The Knowledge Base

`risk-kb.json` extends the brief's example without reshaping it. Every key and value from the brief is kept, and additions are new keys only:

| Key | What it holds |
|---|---|
| `version` | the rule-set version, returned as `kbVersion` in every quote and by `/health` |
| `schemaVersion` | the KB *shape* version, checked by the loader |
| `basePremium`, `coverageLoadFactor` | the premium formula inputs: `basePremium × riskMultiplier × coverageLoadFactor` |
| `riskBands` | score ranges, plus each band's `riskMultiplier`, badge `label` and `summary` template |
| `factors[]` | `id`, customer-facing `description` (the brief's wording, shown for £), optional `descriptions` (wording per currency, e.g. `{ "EUR": "…€750,000" }`), a `condition`, `points`, optional `perOccurrence` and `enabled` |

A `condition` is either a leaf, `{ "field", "operator", …params }`, or a group, `{ "all": [...] }`, `{ "any": [...] }` or `{ "not": {...} }`, nested to any depth. So "Flat AND over €500k" is data:

```json
{ "id": "flat_high_value", "points": 35, "description": "Flat valued over £500,000 — higher shared-building exposure",
  "descriptions": { "EUR": "Flat valued over €500,000 — higher shared-building exposure" },
  "condition": { "all": [ { "field": "propertyType", "operator": "eq", "value": "Flat" },
                          { "field": "propertyValue", "operator": "gt", "value": 500000 } ] } }
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` (inclusive), `outside_range` (exclusive), `in`, `starts_with`. `perOccurrence: true` awards `points × the field's value` (2 claims × 15 = 30).

The backend validates the KB at startup and on every change. A bad KB names the offending path, for example `factors.3.condition.all.1.operator: unknown operator "nope"`.

## UK and Ireland

The `postcode` field accepts a **UK postcode** (for example `SW1A 1AA`) or an **Irish Eircode** (for example `D02 X285`), upper-cased by the backend. The two formats never overlap, so the postcode also picks the currency ([`quote/market.ts`](backend/src/quote/market.ts)):

| Postcode | `currency` in the response | Premiums shown | Factor wording |
|---|---|---|---|
| UK | `GBP` | £ | `description`: the brief's wording, verbatim |
| Eircode | `EUR` | € | `descriptions.EUR` when a factor has one, otherwise `description` |

The KB's numbers are the same in both markets, and amounts aren't converted: €750,000 and £750,000 trip the same factor. The form's value field shows £ or € as the postcode is typed.

## Modifying the Knowledge Base

Every scoring rule is in `risk-kb.json`. Changing a rule edits that file and its test fixtures only. Nothing under `backend/src` or `frontend/src` changes, and the running backend picks the edit up within a second, without a restart.

### With the `kb-factor` skill (recommended)

In Claude Code, describe the rule in plain English. Invoke the skill by name, or just describe the rule and it triggers on its own:

```
/kb-factor add a flood zone factor: +15 if the postcode starts with EX or PL
/kb-factor add a flood zone factor for Eircodes in routing areas T12 or N37, +15
claims penalty should be 20 not 15
pause the flat factor
```

The skill ([`.claude/skills/kb-factor/SKILL.md`](.claude/skills/kb-factor/SKILL.md)) then:

1. **Restates the rule in KB terms** before editing, for example `flood_zone: postcode starts_with [EX, PL], +15`. If the wording is ambiguous ("over" or "or more"?), it asks.
2. **Edits `risk-kb.json`** and bumps `version`, in one save, so the new rule never goes live under the old version.
3. **Adds or updates a scenario fixture** in `backend/test/scenarios/<id>.json`, with one request that triggers the factor, one near-miss that doesn't, and the arithmetic in `why`. For a new factor it also adds a sample request in `backend/requests/<id>.json`.
4. **Proves the change**: the KB loads, `git status` shows nothing changed under `src/`, `npx jest` passes, `/health` shows the new `kbVersion`, a `curl` quote lists the factor in `appliedFactors`, and the UI shows it.
5. **Logs the change** in `AGENT_LOG.md`.

| Change | Example request | What it does to `risk-kb.json` |
|---|---|---|
| Add | "flood zone postcode prefix EX or PL, +15" | appends a new entry to `factors[]` |
| Change a weight | "the age factor should be +25" | edits only `points`; the `id` stays the same |
| Disable | "pause the flat factor" | sets `"enabled": false` and keeps the entry |
| Remove | "drop property_value_high" | deletes the entry |
| Combine fields | "Flat AND over €500k is +35" | adds a condition group: `all` (AND), `any` (OR) or `not` |

**When it stops.** A rule can only read the six request fields (`customerName`, `age`, `propertyType`, `propertyValue`, `postcode`, `previousClaims`) and use the operators listed above. If a rule needs more, the skill says so instead of working around it:
- a new field (such as `yearBuilt`) goes to the `lambda-handler` skill and the Angular form;
- a new operator (such as a regex) goes to `risk-engine`;
- a discount, a multiplier or a new band is a scoring-model change for `risk-engine`.

### By hand

1. **Edit `risk-kb.json`.**
   - To add a factor, append an entry to `factors[]` with a new snake_case `id`, a customer-facing `description` (the UI shows it verbatim), an integer `points`, and a `condition`.
   - To change a factor, edit only the key that changes and keep its `id`.
   - Set `"enabled": false` to pause a factor, or delete the entry to remove it.
   - Field names and enum values must match the request exactly: `propertyType` is `House`, `Flat` or `Bungalow`.

   ```json
   { "id": "flood_zone_uk", "points": 15, "description": "Property in a flood-risk postcode area",
     "condition": { "field": "postcode", "operator": "starts_with", "values": ["EX", "PL"] } }
   ```

2. **Bump `version`** in the same save: minor (`1.3.0` → `1.4.0`) for a factor added, changed, disabled or removed, and patch for a wording-only change. Leave `schemaVersion` unchanged.
3. **Update the fixtures.**
   - A new factor needs `backend/test/scenarios/<id>.json`, with each expected score worked out by hand. The coverage test fails if a factor has no fixture.
   - A change or removal moves expected scores in existing fixtures. Update them and note which moved and why.
   - The fixture format is described in [`.claude/skills/kb-driven-tests/SKILL.md`](.claude/skills/kb-driven-tests/SKILL.md).
4. **Verify** with the backend still running (don't restart it, because that hides whether hot reload works):

   ```bash
   npm --prefix backend test
   curl -s localhost:3000/health                          # shows the new kbVersion
   curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' \
     -d @backend/requests/<id>.json                       # appliedFactors lists the factor
   ```

   If the edit is invalid, the backend logs an error naming the JSON path and **keeps serving the last good KB**. Fix the file and it reloads.

## KB versioning

Two version numbers do different jobs:

- **`version` (the rules).** Bumped on every rule change and returned in every quote, so each quote records the rule set that priced it. A new version is live as soon as the file changes, without a restart or a redeploy (see "Picking up a new KB" below).
- **`schemaVersion` (the shape).** Bumped only when the KB's structure changes in a way old code can't read. The loader lists the shapes it supports (`supportedSchemaVersions`) and rejects any other with a clear error.

Picking up a new KB, in each place the handler runs:

| Runs as | How a changed `KB_PATH` goes live |
|---|---|
| `npm start` / Docker | `server.ts` watches the file (`fs.watchFile`, stat polling) and reloads within a second. |
| A Lambda container | No `server.ts`, so no watcher. Set **`KB_REFRESH_SECONDS`** (for example `30`): the handler stats the file at most once per interval and reloads when its mtime changes ([`kb/refresh.ts`](backend/src/kb/refresh.ts)). The KB file sits on a mounted file system (such as EFS) that the publishing pipeline writes to, so there is no redeploy and no wait for a cold start. Unset or `0` means a container keeps the KB it loaded at cold start. |

Both paths go through the same `reloadKb()`, so the rules below hold in both. `backend/src/kb/refresh.spec.ts` drives the handler as a warm container would.

How breaking schema changes are handled **without redeploying**:

- **Additive changes are backward compatible.** New keys are ignored by code that doesn't know them, so they ship as a normal KB edit with no `schemaVersion` bump.
- **A breaking change can't take the service down.** If a KB with an unsupported `schemaVersion` is published, the reload is rejected with `schemaVersion: 2 is not supported (supported: 1)` and **the last good KB keeps serving**. Quotes never run on rules the code can't interpret. `backend/src/kb/versioning.spec.ts` proves this.
- **Rolling out a breaking change uses expand/contract:**
  1. Ship code that reads both N and N+1 (add N+1 to `supportedSchemaVersions`).
  2. Publish the N+1 KB. No deploy is needed; the running service picks it up.
  3. Once nothing publishes N any more, drop N support in a later release.

In production, rule sets would be version-controlled like code:
- The KB lives in git, and each change is a reviewed pull request whose fixtures prove the new scores.
- A pipeline validates it with the same loader the service uses (`parseKb`), runs the scenario tests, and publishes an immutable, versioned artefact (for example `risk-kb/1.2.0.json` in object storage).
- The service is pointed at a version by configuration (`KB_PATH`, or a pinned "current version" pointer), not by a redeploy. Rolling back means pointing at the previous version, and `kbVersion` on every quote gives the audit trail.

## Layout

```
risk-kb.json        the Knowledge Base
backend/
  src/              handler, server, quote/, engine/, kb/, http/ (see "How it works")
  test/             KB-driven scenario fixtures, configurability proof, coverage check
  requests/         sample requests for curl and the demo
  Dockerfile        multi-stage, non-root image with a HEALTHCHECK
frontend/           Angular 22 standalone app: signals, Reactive Forms, hand-written CSS, Dockerfile + nginx.conf
docker-compose.yml  the whole app on :8080 with the KB mounted live
package.json        root npm start: runs both services via scripts/start.mjs (no dependencies)
specs/              mission, tech stack, roadmap, review prep
CLAUDE.md, .claude/ agent instructions and project skills
AGENT_LOG.md        the agent interaction log
SOLUTION.md         design summary
```
