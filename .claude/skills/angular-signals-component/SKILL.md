---
name: angular-signals-component
description: Builds and changes PolicyQuote's Angular UI with signal-based state, covering the quote page, the reactive quote form, the results panel and the reusable RiskBandBadgeComponent. Use for anything under frontend/src/app, including loading/quoteResult/errorMessage signals, computed() display state, effect() side effects, input() components, QuoteService (HttpClient POST /policy/quote), models/quote.ts, form validators, rendering appliedFactors from the KB, the risk band badge and its tests. Use it even when the request only says "show the premium", "the badge colour is wrong", "add a field to the form", "the button doesn't disable" or "render the applied factors". It sits on top of angular-developer and angular-new-app and overrides them where the brief differs (Reactive Forms, RxJS HttpClient, no Tailwind or UI libraries).
---

# Angular signals component

The UI is the brief's single page: a six-field reactive form, then the quote with a risk band badge, a plain-English summary and the applied factors. Every piece of UI state is a signal or a `computed()`. Everything the customer reads about risk (band label, summary, factor descriptions, points) comes from the response, and so from the KB. A new factor or band shows up with no frontend change.

Rubric: Angular Signals & Reactivity (R3 20), plus "the UI reflects `appliedFactors` from the KB" for R1.

## Before you write code

1. Read the specs:
   - `specs/tech-stack.md`: "Frontend" (the choices table), "Signal design" (one job per primitive) and "Quality gates".
   - `specs/roadmap.md`: Phase 4 (scaffold, form, state) and Phase 5 (results UI, badge, tests), including their "Done when" checks.
   - `specs/mission.md`: the Frontend scope and the display list.
2. Read `backend/src/quote/request.ts` and `quote/response.ts`. `frontend/src/app/models/quote.ts` and the form validators mirror them. The roadmap asks for `models/quote.ts` to be **generated from the backend contract**, with any drift recorded in its own log entry.
3. Read `references/component-pattern.md` and copy its shape.
4. Use `angular-developer` for general API questions (`references/signals-overview.md`, `inputs.md`, `effects.md`, `reactive-forms.md`, `testing-fundamentals.md`). Where it conflicts with the rules below, these rules win.

## Where this overrides angular-developer

| angular-developer says | This project does | Why |
|---|---|---|
| New v22 apps should prefer Signal Forms | **Reactive Forms** (`FormGroup`, `Validators`) | The brief requires reactive forms explicitly (`tech-stack.md` Frontend) |
| `httpResource` / `resource` for async data | **`HttpClient` returning an Observable**, results written into signals | The brief requires RxJS `HttpClient` for `POST /policy/quote`; `httpResource` is for reads |
| v20 naming ("intent over role", no `Component` suffix) | Keep **`RiskBandBadgeComponent`** | The brief names the class |
| Tailwind reference | Hand-written CSS with custom properties | The brief's constraint 4 asks us to show our own CSS; no UI libraries or Tailwind (`tech-stack.md`) |
| `angular-new-app`: "add tailwind" step, global `npm install -g @angular/cli` | Skip the Tailwind step; scaffold with `npx @angular/cli new … --style=css` | Constraint 4; the global `ng` isn't installed (`tech-stack.md` Frontend) |

## Rules

- **Exactly three writable signals for the brief's state:** `loading`, `quoteResult`, `errorMessage`. Everything else the template reads is a `computed()` (`hasResult`, `sortedFactors`, `totalPoints`, formatted premiums, `canSubmit`). Update state with `.set()` or `.update()` and new objects, never by mutating a signal's value in place.
- **`canSubmit` is a `computed()`** over `toSignal(form.statusChanges)` and `!loading()`, so a quote in flight can't be submitted twice.
- **`effect()` does real side effects only.** When a new quote arrives, it moves focus to the results heading and fills the `aria-live` announcement, using `afterNextRender` inside it so the DOM exists. It never calls `.set()` to copy one signal into another; that's what `computed()` is for.
- **The Observable stops at the service edge.** `QuoteService.getQuote()` returns `Observable<QuoteResponse>`. The component subscribes once per submit, with `takeUntilDestroyed`, and writes signals. There is no `BehaviorSubject`/`Subject`, no `.subscribe` in templates and no `async` pipe for this state.
- **Inputs are `input()` / `input.required()`,** never `@Input()`. The badge takes `riskBand = input.required<string>()` and `label = input<string>()`. It shows `label() ?? riskBand()` and styles itself through a host `data-band` attribute, with a neutral fallback for bands the CSS doesn't know.
- **KB-driven rendering.** Factor rows are `@for (f of sortedFactors(); track f.id)`, showing `f.description` and `f.points` from the response. The badge text is `riskBandLabel`. The summary is `riskSummary`. No band names, labels, factor ids or wording in TypeScript or templates. Band ids may appear **only** as CSS `[data-band=…]` selectors, for colour.
- **Validators mirror Zod** in `quote/request.ts`: `customerName` required and at most 100 characters, `age` integer 18–120, `propertyType` House/Flat/Bungalow, `propertyValue` greater than 0, `postcode` the same UK regex, `previousClaims` integer 0–20. When the backend schema changes, change both in the same turn.
- **Show backend errors.** A 400 `issues[]` becomes a readable `errorMessage` naming the fields. A network error or 500 gets a generic message plus `requestId` when there is one.
- **Standalone, `ChangeDetectionStrategy.OnPush`, zoneless.** No NgModules, no `zone.js`, and no Material, PrimeNG, Bootstrap or Tailwind.
- **Accessible:** every input has a `<label>`. Errors show once a field is touched, linked with `aria-describedby` and marked `aria-invalid`. The results region is announced through `aria-live="polite"`. The badge's colour is never the only signal, because the text always shows the label.
- **No `any`,** including HTTP error bodies. Narrow `HttpErrorResponse.error` from `unknown`.
- **The dev proxy stays wired:** `proxy.conf.json` sends `/policy` and `/health` to `:3000`, so `npm start` alone works.

## Reject these outputs

| Output | Why |
|---|---|
| `BehaviorSubject`, `Subject` or a store service of Observables for UI state | the brief's constraint 1; R3 penalises it |
| `effect(() => this.total.set(...))`, or any effect that writes a signal | copies state; `computed()` is the answer (R3) |
| Signal Forms, template-driven forms or hand-rolled validation | the brief requires Reactive Forms |
| `httpResource` or `resource` for the POST, or `fetch` | the brief requires RxJS `HttpClient` |
| `@Input()`, `ngOnChanges` or `EventEmitter` in new components | old APIs; use `input()` / `output()` |
| `@switch (riskBand)` or `riskBand === 'HIGH_RISK' ? 'High risk' : …` | band wording in code; the label comes from the KB |
| A hardcoded list of factors, or factor text in the template | factors must come from `appliedFactors` |
| `NgModule`, `standalone: false`, or `zone.js` in `polyfills` | the brief's standalone requirement; zoneless by decision |
| `form.value.age!` or `as QuoteRequest` on form values | skips narrowing; build the request through a typed function |
| `.subscribe` without `takeUntilDestroyed`, or nested subscribes | leaks, and hides the data flow |
| Material, PrimeNG, Bootstrap or Tailwind in `package.json` | the brief's constraint 4 |
| Colour as the only band signal, or inputs without labels | accessibility |

## Definition of done

Run these and report the real output. Don't claim success without it.

```bash
cd frontend && npx ng build
cd frontend && npx ng test --watch=false
cd frontend && npm run lint
grep -rnE 'BehaviorSubject|\bSubject\b|NgModule|standalone:\s*false|:\s*any\b|as any|@Input\(' frontend/src/app    # must print nothing
grep -rnE 'effect\(' -A6 frontend/src/app | grep -E '\.(set|update)\('                                                   # must print nothing
grep -rLE 'ChangeDetectionStrategy.OnPush' $(grep -rl '@Component' frontend/src/app --include='*.ts' --exclude='*.spec.ts')   # must print nothing
grep -nE 'material|primeng|bootstrap|tailwind' frontend/package.json                                            # must print nothing
```

Then, with the backend on `:3000` and `cd frontend && npm start`:
- submit each of `backend/requests/standard.json`, `elevated.json` and `high-risk.json` through the form. Each shows the right badge label, premiums, summary and factor rows
- a submit shows loading and a disabled button, then the result, and focus moves to the results
- an invalid field shows its inline error, and a backend 400 shows in `errorMessage`
- a factor added to the KB with `kb-factor` appears in the list with no frontend change (Phase 5 "Done when")

The tests must cover: the badge for each band and for an unknown band (neutral style, id shown), factor rows rendered from a mock response, and the signal transitions loading → result and loading → error, using `HttpTestingController`.

Finish with an `agent-log` entry, and record anything from the reject table that the first draft contained.
