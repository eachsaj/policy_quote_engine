# PolicyQuote: Policy Risk & Premium Engine

A single-page home insurance quote tool: an Angular frontend, a Lambda-style Node.js backend, and a risk engine whose rules live entirely in a JSON Knowledge Base, **[`risk-kb.json`](risk-kb.json) at the repo root**. Adding, changing or removing a risk factor is a KB edit, with no code change.

## Run it (4 commands)

Requires Node.js 22 or 24 LTS.

```bash
npm --prefix backend install
npm --prefix backend start        # http://localhost:3000  (POST /policy/quote, GET /health)
npm --prefix frontend install
npm --prefix frontend start       # http://localhost:4200  (proxies /policy and /health to :3000)
```

Run the backend and frontend `start` commands in separate terminals, then open http://localhost:4200.

Sample requests, one per band plus the compound factor, are in [`backend/requests/`](backend/requests):

```bash
curl -s -XPOST localhost:3000/policy/quote -H 'Content-Type: application/json' -d @backend/requests/high-risk.json
```

## Tests

```bash
npm --prefix backend test         # Jest: engine, loader, handler, KB-driven scenarios, configurability proof
npm --prefix frontend test        # Vitest: form validators, signal state, result panel, badge
```

## The Knowledge Base

`risk-kb.json` extends the brief's example without reshaping it. Every key and value from the brief is kept, and additions are new keys only:

| Key | What it holds |
|---|---|
| `version` | the rule-set version, returned as `kbVersion` in every quote and by `/health` |
| `schemaVersion` | the KB *shape* version, checked by the loader |
| `basePremium`, `coverageLoadFactor` | the premium formula inputs: `basePremium × riskMultiplier × coverageLoadFactor` |
| `riskBands` | score ranges, plus each band's `riskMultiplier`, badge `label` and `summary` template |
| `factors[]` | `id`, customer-facing `description`, a `condition`, `points`, optional `perOccurrence` and `enabled` |

A `condition` is either a leaf, `{ "field", "operator", …params }`, or a group, `{ "all": [...] }`, `{ "any": [...] }` or `{ "not": {...} }`, nested to any depth. So "Flat AND over £500k" is data:

```json
{ "id": "flat_high_value", "points": 35, "description": "Flat valued over £500,000 — higher shared-building exposure",
  "condition": { "all": [ { "field": "propertyType", "operator": "eq", "value": "Flat" },
                          { "field": "propertyValue", "operator": "gt", "value": 500000 } ] } }
```

Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` (inclusive), `outside_range` (exclusive), `in`, `starts_with`. `perOccurrence: true` awards `points × the field's value` (2 claims × 15 = 30).

The backend validates the KB at startup and on every change. A bad KB names the offending path, for example `factors.3.condition.all.1.operator: unknown operator "nope"`.

## Adding a factor

1. Append an entry to `factors[]` in `risk-kb.json` and bump `version` (minor for a factor added, changed or removed).
2. Add a scenario fixture, `backend/test/scenarios/<id>.json`, with the expected score worked out by hand. The coverage test fails if a factor has no fixture.
3. The running backend reloads the file within a second; no restart. Check `curl localhost:3000/health` for the new `kbVersion`.

## KB versioning

Two version numbers do different jobs:

- **`version` (the rules).** Bumped on every rule change and returned in every quote, so each quote records the rule set that priced it. A new version is live as soon as the file changes, because the backend watches `KB_PATH` and swaps in a valid KB atomically.
- **`schemaVersion` (the shape).** Bumped only when the KB's structure changes in a way old code can't read. The loader lists the shapes it supports (`supportedSchemaVersions`) and rejects any other with a clear error.

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
backend/            Lambda-style handler(event, context), node:http adapter, risk engine, Jest tests
frontend/           Angular 22 standalone app: signals, Reactive Forms, hand-written CSS
specs/              mission, tech stack, roadmap
CLAUDE.md, .claude/ agent instructions and project skills
AGENT_LOG.md        the agent interaction log
SOLUTION.md         design summary
```
