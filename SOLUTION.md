# Solution

## Architecture decisions

- **Lambda-style, fully local.** `handler(event, context)` uses local API Gateway-shaped types, with no AWS dependency. A thin `node:http` adapter feeds it events, so local and "Lambda" runs share one code path.
- **Layered backend.** The handler parses, validates with Zod and routes through a lookup map. `quote/service.ts` prices; `engine/` scores as pure functions.
- **Angular signals.** Three writable signals (`loading`, `quoteResult`, `errorMessage`); everything else is `computed()`. Hand-written CSS.
- **Docker.** Multi-stage, non-root images; compose mounts the KB live.

## KB design choices

- **`risk-kb.json` extends the brief's example, never reshapes it**, and holds every number.
- **Generic evaluator.** Conditions are leaves or nested `all` / `any` / `not` groups; operators live in a registry. "Flat AND > £500k" is a JSON edit.
- **Validated, hot-reloaded.** Six load checks name the bad JSON path. Edits go live without a restart; an invalid edit leaves the last good KB serving.
- **Versioned.** Quotes return `kbVersion`; an unsupported `schemaVersion` is rejected, so a breaking KB never mis-scores.
- **Tests are data.** Hand-worked JSON scenarios; a coverage check fails when a factor lacks one.

## Agent configuration

`CLAUDE.md` states the brief's rules. Scoped skills load only for their files, each with a reject table and a runnable definition of done, so agent output is checked, not trusted. `kb-factor` makes the live demo a rehearsed, KB-only change. `AGENT_LOG.md` records every rejection.

## One improvement: data minimisation

The name never reaches the scorer, but it still crosses the API. Next: keep it client-side, score postcodes by outward code, redact logs and add UK GDPR retention and consent notices.
