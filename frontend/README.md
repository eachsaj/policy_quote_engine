# PolicyQuote frontend

Angular 22 single-page quote form (standalone, zoneless, OnPush, signals, Reactive Forms, hand-written CSS).

```bash
npm install
npm start        # ng serve on http://localhost:4200; /policy and /health are proxied to the backend on :3000 (proxy.conf.json)
npm test         # Vitest via ng test
npm run lint     # angular-eslint: no any, no Subject/BehaviorSubject imports, signal inputs
npm run build    # production build to dist/frontend
```

Start the backend first (`npm --prefix ../backend start`), or run both from the repo root with `npm start`. See the repository root README for the full picture.

## Structure (`src/app`)

| File | Role |
|---|---|
| `models/quote.ts` | The request and response types, mirrored from the backend contract, plus postcode → currency. |
| `quote/quote.service.ts` | `HttpClient` POST to `/policy/quote`. The Observable stops here. |
| `quote/quote-form.ts` | The six-field reactive form. Validators mirror the backend's Zod schema. |
| `quote/quote-page.component.*` | The page: the form, the three state signals (`loading`, `quoteResult`, `errorMessage`), derived `computed()` state, and two side-effect-only `effect()`s (focus the result, set the tab title). |
| `quote/quote-result.component.*` | Renders a quote: premiums, badge, KB summary, applied factors and the formula breakdown. |
| `quote/money.ts` | Formats amounts in £ or €, following the quote's `currency`. |
| `risk-band-badge/` | The reusable `RiskBandBadgeComponent` (`riskBand` input, optional KB `label`). |

