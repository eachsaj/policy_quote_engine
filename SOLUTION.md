# Solution

## Architecture decisions

- **Lambda-style, fully local.** `handler(event, context)` uses local, API Gateway-shaped types and has no AWS dependency. A thin `node:http` adapter turns requests into events, so local and "Lambda" runs share one code path.
- **Layered backend.** The handler only parses, Zod-validates, routes through a lookup map and maps errors. `quote/service.ts` applies `basePremium × riskMultiplier × coverageLoadFactor`, and `engine/` does the scoring.
- **Angular standalone and signals.** `loading`, `quoteResult` and `errorMessage` are signals, and display state is `computed()`. `RiskBandBadgeComponent` is reusable. CSS is hand-written.

## KB design choices

- **`risk-kb.json` at the repo root** holds every number: the base premium, the load factor, the band ranges with their multipliers, and the factors. The code contains none of them.
- **Generic evaluator.** A condition is a leaf (`field`, `operator`, value or range) or a group (`all` / `any` / `not`). Operators live in a registry map, not a `switch`. A new factor, including "Flat AND > £500k", is a JSON edit only.
- **`perOccurrence`** awards points × the field's value.
- **Versioning.** Every quote returns `kbVersion`. The loader validates the KB at startup and gates on `schemaVersion`, so a breaking KB fails fast instead of mis-scoring.

## Agent configuration

`CLAUDE.md` plus scoped skills (`lambda-handler`, `agent-log` and others) encode the project's rules. Each skill has a reject table (`any`, `switch`, AWS SDK, logic in the handler) and a runnable definition of done. `AGENT_LOG.md` records the prompts, the rejected output and the corrections.

## Future improvement: data privacy protection

- Don't send the customer's name to the scoring API.
- Score the postcode by its outward code only.
- Redact personal data from logs, and store no quotes server-side.
- Enforce TLS, add explicit retention rules and a consent notice, in line with UK GDPR.
