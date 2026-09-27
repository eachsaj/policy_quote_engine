# Component pattern

Read this before you write or change anything under `frontend/src/app`. Copy the shape. Adjust names only when the code that already exists uses different ones. The code is a pattern, not a compiled artefact: `ng build`, `ng test` and the browser check are the proof.

## Layout

```
frontend/src/app/
├── app.config.ts                       provideZonelessChangeDetection(), provideHttpClient()
├── app.ts                              root: renders <app-quote-page />
├── models/quote.ts                     QuoteRequest, QuoteResponse, AppliedFactor, ApiError (mirrors backend)
├── quote/
│   ├── quote.service.ts                HttpClient → POST /policy/quote (Observable)
│   ├── quote-form.ts                   form factory, validators, toQuoteRequest()
│   ├── quote-page.component.ts|html|css   owns the three signals and the submit flow
│   └── quote-result.component.ts|html|css presentational: input.required<QuoteResponse>()
└── risk-band-badge/
    └── risk-band-badge.component.ts|css   input() badge, data-band styling
```

State lives in `QuotePageComponent`, the one place that writes it. `QuoteResultComponent` and `RiskBandBadgeComponent` only read inputs and derive with `computed()`.

## App config (`app.config.ts`)

```ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideHttpClient()],
};
```

Remove `zone.js` from `polyfills` in `angular.json` if the CLI added it.

## Model (`models/quote.ts`)

Generated from `backend/src/quote/request.ts` and `response.ts`. Record any drift in the log.

```ts
export const propertyTypes = ['House', 'Flat', 'Bungalow'] as const;
export type PropertyType = (typeof propertyTypes)[number];

export interface QuoteRequest {
  customerName: string;
  age: number;
  propertyType: PropertyType;
  propertyValue: number;
  postcode: string;
  previousClaims: number;
}

export interface AppliedFactor { id: string; description: string; points: number; occurrences: number }

export interface CoverageDetails {
  basePremium: number;
  riskMultiplier: number;
  coverageLoadFactor: number;
  sumInsured: number;
  items: ReadonlyArray<{ id: string; description: string }>;
}

export interface QuoteResponse {
  monthlyPremium: number;
  annualPremium: number;
  riskBand: string; // KB band id; string, not a union, so a new band needs no frontend change
  riskBandLabel: string;
  riskScore: number;
  riskSummary: string;
  coverageDetails: CoverageDetails;
  appliedFactors: readonly AppliedFactor[];
  kbVersion: string;
}

export interface ApiIssue { field: string; message: string }
```

## Service (`quote/quote.service.ts`)

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { QuoteRequest, QuoteResponse } from '../models/quote';

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);

  getQuote(request: QuoteRequest): Observable<QuoteResponse> {
    return this.http.post<QuoteResponse>('/policy/quote', request);
  }
}
```

The relative URL goes through `proxy.conf.json` in dev and through nginx in Docker, so there's no environment-specific base URL.

## Form (`quote/quote-form.ts`)

The validators mirror Zod. `toQuoteRequest` narrows the raw value with no `!` or `as`.

```ts
import { FormBuilder, Validators } from '@angular/forms';
import { propertyTypes, type PropertyType, type QuoteRequest } from '../models/quote';

export const eircode = /^[ACDEFHKNPRTVWXY]\d[\dW] ?[\dACDEFHKNPRTVWXY]{4}$/i; // same as backend quote/request.ts

export const buildQuoteForm = (fb: FormBuilder) =>
  fb.group({
    customerName: fb.nonNullable.control('', [Validators.required, Validators.maxLength(100)]),
    age: fb.control<number | null>(null, [Validators.required, Validators.min(18), Validators.max(120), Validators.pattern(/^\d+$/)]),
    propertyType: fb.control<PropertyType | null>(null, Validators.required),
    propertyValue: fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    postcode: fb.nonNullable.control('', [Validators.required, Validators.pattern(eircode)]),
    previousClaims: fb.control<number | null>(0, [Validators.required, Validators.min(0), Validators.max(20), Validators.pattern(/^\d+$/)]),
  });

export type QuoteForm = ReturnType<typeof buildQuoteForm>;

const isPropertyType = (v: unknown): v is PropertyType => propertyTypes.some((p) => p === v);

export const toQuoteRequest = (v: ReturnType<QuoteForm['getRawValue']>): QuoteRequest | null =>
  v.age === null || v.propertyValue === null || v.previousClaims === null || !isPropertyType(v.propertyType)
    ? null
    : {
        customerName: v.customerName.trim(),
        age: v.age,
        propertyType: v.propertyType,
        propertyValue: v.propertyValue,
        postcode: v.postcode.trim().toUpperCase(),
        previousClaims: v.previousClaims,
      };
```

`propertyTypes` feeds the `<select>` options too, so the three options are declared once on the frontend.

## Page (`quote/quote-page.component.ts`)

```ts
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector,
  afterNextRender, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { propertyTypes, type QuoteResponse } from '../models/quote';
import { buildQuoteForm, toQuoteRequest } from './quote-form';
import { QuoteService } from './quote.service';
import { QuoteResultComponent } from './quote-result.component';

@Component({
  selector: 'app-quote-page',
  imports: [ReactiveFormsModule, QuoteResultComponent],
  templateUrl: './quote-page.component.html',
  styleUrl: './quote-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotePageComponent {
  private readonly quotes = inject(QuoteService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly propertyTypes = propertyTypes;
  protected readonly form = buildQuoteForm(inject(FormBuilder));

  // The brief's three state signals, and the only writable state.
  readonly loading = signal(false);
  readonly quoteResult = signal<QuoteResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly canSubmit = computed(() => this.formStatus() === 'VALID' && !this.loading());
  protected readonly hasResult = computed(() => this.quoteResult() !== null);
  protected readonly announcement = computed(() => {
    const q = this.quoteResult();
    return q ? `Quote ready: ${q.riskBandLabel}, €${q.monthlyPremium.toFixed(2)} a month.` : '';
  });

  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');

  constructor() {
    // Side effect only: move focus to the new result once it has rendered. No signal writes.
    effect(() => {
      if (!this.quoteResult()) return;
      afterNextRender(() => this.resultHeading()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  submit(): void {
    this.form.markAllAsTouched();
    const request = toQuoteRequest(this.form.getRawValue());
    if (!this.canSubmit() || !request) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.quotes.getQuote(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (quote) => {
        this.quoteResult.set(quote);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.quoteResult.set(null);
        this.errorMessage.set(describeError(err));
        this.loading.set(false);
      },
    });
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const describeError = (err: unknown): string => {
  const body = err instanceof HttpErrorResponse && isRecord(err.error) ? err.error : {};
  const issues = Array.isArray(body['issues']) ? body['issues'].filter(isRecord) : [];
  if (issues.length) return `Please check: ${issues.map((i) => `${String(i['field'])} (${String(i['message'])})`).join(', ')}`;
  const ref = typeof body['requestId'] === 'string' ? ` (reference ${body['requestId']})` : '';
  return `We couldn't get a quote right now. Please try again${ref}.`;
};
```

The `announcement` wording is UI chrome, not risk wording. The band label and premium come from the response.

## Page template (`quote/quote-page.component.html`)

One field shown in full; the others follow the same pattern.

```html
<form [formGroup]="form" (ngSubmit)="submit()" novalidate>
  <div class="field">
    <label for="age">Age</label>
    <input id="age" type="number" inputmode="numeric" formControlName="age"
           [attr.aria-invalid]="form.controls.age.invalid && form.controls.age.touched"
           aria-describedby="age-error" />
    @if (form.controls.age.invalid && form.controls.age.touched) {
      <p id="age-error" class="error">Enter a whole number from 18 to 120.</p>
    }
  </div>

  <div class="field">
    <label for="propertyType">Property type</label>
    <select id="propertyType" formControlName="propertyType">
      <option [ngValue]="null" disabled>Choose…</option>
      @for (t of propertyTypes; track t) { <option [ngValue]="t">{{ t }}</option> }
    </select>
  </div>

  <!-- customerName, propertyValue (€), postcode, previousClaims ("in the last 5 years"): same pattern -->

  <button type="submit" [disabled]="!canSubmit()" [attr.aria-busy]="loading()">
    {{ loading() ? 'Getting your quote…' : 'Get quote' }}
  </button>
</form>

@if (errorMessage(); as message) { <p class="error-banner" role="alert">{{ message }}</p> }

<div class="sr-only" aria-live="polite">{{ announcement() }}</div>

@if (quoteResult(); as quote) {
  <section aria-labelledby="result-heading">
    <h2 id="result-heading" #resultHeading tabindex="-1">Your quote</h2>
    <app-quote-result [quote]="quote" />
  </section>
}
```

`[ngValue]` needs `ReactiveFormsModule` (already imported). The error texts are form validation copy, not risk wording.

## Result (`quote/quote-result.component.ts`)

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { QuoteResponse } from '../models/quote';
import { RiskBandBadgeComponent } from '../risk-band-badge/risk-band-badge.component';

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

@Component({
  selector: 'app-quote-result',
  imports: [RiskBandBadgeComponent],
  templateUrl: './quote-result.component.html',
  styleUrl: './quote-result.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteResultComponent {
  readonly quote = input.required<QuoteResponse>();

  protected readonly monthly = computed(() => eur.format(this.quote().monthlyPremium));
  protected readonly annual = computed(() => eur.format(this.quote().annualPremium));
  protected readonly sortedFactors = computed(() => [...this.quote().appliedFactors].sort((a, b) => b.points - a.points));
  protected readonly totalPoints = computed(() => this.sortedFactors().reduce((sum, f) => sum + f.points, 0));
}
```

```html
<p class="premium"><strong>{{ monthly() }}</strong> a month · {{ annual() }} a year</p>
<app-risk-band-badge [riskBand]="quote().riskBand" [label]="quote().riskBandLabel" />
<p class="summary">{{ quote().riskSummary }}</p>

<h3>Risk factors applied</h3>
@if (sortedFactors().length) {
  <ul class="factors">
    @for (f of sortedFactors(); track f.id) {
      <li><span>{{ f.description }}</span> <span class="points">+{{ f.points }}</span></li>
    }
  </ul>
  <p class="total">Total risk score: {{ totalPoints() }}</p>
} @else {
  <p>No risk factors applied.</p>
}

<p class="kb-version">Rules version {{ quote().kbVersion }}</p>
```

`totalPoints()` should equal `riskScore`. Show `riskScore` if they ever differ; a mismatch is a bug worth a test, not something to hide.

## Badge (`risk-band-badge/risk-band-badge.component.ts`)

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-risk-band-badge',
  template: `{{ text() }}`,
  styleUrl: './risk-band-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'badge', '[attr.data-band]': 'riskBand()', role: 'status' },
})
export class RiskBandBadgeComponent {
  readonly riskBand = input.required<string>();
  readonly label = input<string>();
  protected readonly text = computed(() => this.label() ?? this.riskBand());
}
```

```css
:host {
  --badge-bg: var(--band-neutral-bg, #e8e8ec);
  --badge-fg: var(--band-neutral-fg, #2b2b33);
  display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px;
  font-weight: 700; letter-spacing: 0.04em; background: var(--badge-bg); color: var(--badge-fg);
}
/* Colour only. The text always carries the KB label. Unknown bands keep the neutral style. */
:host([data-band='STANDARD'])  { --badge-bg: #dff3e4; --badge-fg: #14532d; }
:host([data-band='ELEVATED'])  { --badge-bg: #fff1d6; --badge-fg: #7a4a00; }
:host([data-band='HIGH_RISK']) { --badge-bg: #fde2e1; --badge-fg: #8a1c17; }
```

Check the colour pairs for 4.5:1 contrast. Band ids in these selectors are the one place band names may appear on the frontend.

## Tests

The CLI default runner (Vitest on current Angular). Zoneless, so use `await fixture.whenStable()` rather than `fakeAsync`.

```ts
// risk-band-badge.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { RiskBandBadgeComponent } from './risk-band-badge.component';

const render = async (riskBand: string, label?: string) => {
  const fixture = TestBed.createComponent(RiskBandBadgeComponent);
  fixture.componentRef.setInput('riskBand', riskBand);
  if (label !== undefined) fixture.componentRef.setInput('label', label);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

it.each([
  ['STANDARD', 'STANDARD'],
  ['ELEVATED', 'ELEVATED'],
  ['HIGH_RISK', 'HIGH RISK'],
])('shows the KB label for %s', async (band, label) => {
  const el = await render(band, label);
  expect(el.textContent?.trim()).toBe(label);
  expect(el.getAttribute('data-band')).toBe(band);
});

it('falls back to the band id for an unknown band', async () => {
  const el = await render('SUPER_HIGH');
  expect(el.textContent?.trim()).toBe('SUPER_HIGH');
});
```

`fixture.nativeElement` is typed `any` by Angular. The `as HTMLElement` there narrows a framework `any` and is the accepted idiom; don't spread it further.

```ts
// quote-page.component.spec.ts (signal transitions)
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuotePageComponent } from './quote-page.component';

const validForm = { customerName: 'A Customer', age: 40, propertyType: 'House' as const, propertyValue: 250000, postcode: 'D02 X285', previousClaims: 0 };

beforeEach(() => TestBed.configureTestingModule({
  providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
}));

it('goes loading → result', () => {
  const page = TestBed.createComponent(QuotePageComponent).componentInstance;
  page['form'].setValue(validForm);
  page.submit();
  expect(page.loading()).toBe(true);

  TestBed.inject(HttpTestingController).expectOne('/policy/quote').flush(mockResponse);
  expect(page.loading()).toBe(false);
  expect(page.quoteResult()?.riskBand).toBe(mockResponse.riskBand);
  expect(page.errorMessage()).toBeNull();
});

it('goes loading → error with field issues', () => {
  const page = TestBed.createComponent(QuotePageComponent).componentInstance;
  page['form'].setValue(validForm);
  page.submit();
  TestBed.inject(HttpTestingController).expectOne('/policy/quote')
    .flush({ error: 'Validation failed', issues: [{ field: 'age', message: 'Too small' }] }, { status: 400, statusText: 'Bad Request' });
  expect(page.loading()).toBe(false);
  expect(page.quoteResult()).toBeNull();
  expect(page.errorMessage()).toContain('age');
});
```

`mockResponse` is a `QuoteResponse` fixture with two applied factors. The result spec renders it and asserts one `<li>` per factor, showing each `description` and `+points`, sorted by points. `page['form']` reaches a `protected` member for the test; if lint objects, make `form` `readonly` public.
