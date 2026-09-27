# Solution

## Architecture decisions

- **Lambda-style, fully local.** `handler(event, context)` uses local API Gateway-shaped types, with no AWS dependency. A thin `node:http` adapter feeds it events, so local and "Lambda" runs share one code path.
- **Layered backend.** The handler parses, validates with Zod, routes through a lookup map and maps errors. `quote/service.ts` prices; `engine/` scores.
- **Angular signals.** `loading`, `quoteResult` and `errorMessage` are signals, display state is `computed()`, and CSS is hand-written.

## KB design choices

- **`risk-kb.json` extends the brief's example without reshaping it** and holds every number: base premium, load factor, bands, multipliers, factors.
- **Generic evaluator.** A condition is a leaf (`field`, `operator`, params) or an `all` / `any` / `not` group. Operators live in a registry, not a `switch`, so "Flat AND > £500k" is a JSON edit.
- **`perOccurrence`** awards points × the field's value.
- **Versioning.** Quotes return `kbVersion`; the loader gates on `schemaVersion` and fails fast.

## Agent configuration

`CLAUDE.md` holds the brief's rules; scoped skills load only for their files. Each has a reject table and a runnable definition of done, making output checkable. `AGENT_LOG.md` records the rejections.

## One improvement: data privacy

Minimise personal data: drop the customer's name from the scoring request, score postcodes by outward code, redact logs, store no quotes, and add retention and consent notices under UK GDPR.
