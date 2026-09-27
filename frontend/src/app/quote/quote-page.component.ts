import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector,
  afterNextRender, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { propertyTypes, type QuoteRequest, type QuoteResponse } from '../models/quote';
import { buildQuoteForm, fieldLabels, toQuoteRequest } from './quote-form';
import { QuoteResultComponent } from './quote-result.component';
import { QuoteService } from './quote.service';

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
  protected readonly labels = fieldLabels;
  readonly form = buildQuoteForm(inject(FormBuilder));

  // The brief's three UI state signals, and the only writable state on the page.
  readonly loading = signal(false);
  readonly quoteResult = signal<QuoteResponse | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Derived state: computed(), never copied into another signal.
  private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  protected readonly canSubmit = computed(() => this.formStatus() === 'VALID' && !this.loading());
  protected readonly announcement = computed(() => {
    const q = this.quoteResult();
    return q ? `Quote ready: ${q.riskBandLabel}, ${q.monthlyPremium.toFixed(2)} euro a month.` : '';
  });

  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');

  constructor() {
    // A genuine side effect only: move focus to a new result once it has rendered. No signal writes.
    effect(() => {
      if (!this.quoteResult()) return;
      afterNextRender(() => this.resultHeading()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  /** True once a control is touched and invalid: drives the inline error, aria-invalid and aria-describedby. */
  protected showError(name: keyof QuoteRequest): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
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
        this.quoteResult.set(null); // never show a stale premium next to an error
        this.errorMessage.set(describeError(err));
        this.loading.set(false);
      },
    });
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isField = (f: unknown): f is keyof QuoteRequest => typeof f === 'string' && Object.hasOwn(fieldLabels, f);

/** Turns an HTTP failure into customer-facing text. The error body is `unknown` and narrowed, never `any`. */
const describeError = (err: unknown): string => {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return "We couldn't reach the quote service. Please check your connection and try again.";
  }
  const body = err instanceof HttpErrorResponse && isRecord(err.error) ? err.error : {};
  const issues = Array.isArray(body['issues']) ? body['issues'].filter(isRecord) : [];
  if (issues.length > 0) {
    const named = issues.map((i) => `${isField(i['field']) ? fieldLabels[i['field']] : String(i['field'])}: ${String(i['message'])}`);
    return `Please check your details. ${named.join('; ')}.`;
  }
  const ref = typeof body['requestId'] === 'string' ? ` (reference ${body['requestId']})` : '';
  return `We couldn't get a quote right now. Please try again${ref}.`;
};
