import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { QuoteResponse } from '../models/quote';
import { QuotePageComponent } from './quote-page.component';

const validForm = { customerName: 'A Customer', age: 40, propertyType: 'House' as const, propertyValue: 250000, postcode: 'sw1a 1aa', previousClaims: 0 };

const mockResponse: QuoteResponse = {
  monthlyPremium: 45, annualPremium: 540, riskBand: 'ELEVATED', riskBandLabel: 'ELEVATED', riskScore: 30,
  riskSummary: 'Elevated risk profile.', kbVersion: '1.0.0',
  coverageDetails: { basePremium: 300, riskMultiplier: 1.5, coverageLoadFactor: 1.2, sumInsured: 250000, items: [] },
  appliedFactors: [{ id: 'previous_claims_low', description: '1–2 previous claims', points: 30, occurrences: 2 }],
};

describe('QuotePageComponent signal state', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const create = () => {
    const fixture = TestBed.createComponent(QuotePageComponent);
    fixture.componentInstance.form.setValue(validForm);
    return fixture;
  };

  it('starts idle', () => {
    const page = TestBed.createComponent(QuotePageComponent).componentInstance;
    expect([page.loading(), page.quoteResult(), page.errorMessage()]).toEqual([false, null, null]);
  });

  it('goes loading → result, posting the normalised request', async () => {
    const fixture = create();
    const page = fixture.componentInstance;
    page.submit();
    expect(page.loading()).toBe(true);

    const req = http.expectOne('/policy/quote');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...validForm, postcode: 'SW1A 1AA' });
    req.flush(mockResponse);

    expect(page.loading()).toBe(false);
    expect(page.quoteResult()).toEqual(mockResponse);
    expect(page.errorMessage()).toBeNull();

    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.result')?.textContent).toContain('ELEVATED');
    expect(el.querySelector('[aria-live]')?.textContent).toContain('Quote ready: ELEVATED');
  });

  it('disables the button while a quote is in flight, so it cannot be submitted twice', async () => {
    const fixture = create();
    fixture.componentInstance.submit();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector<HTMLButtonElement>('button[type=submit]');
    expect(button?.disabled).toBe(true);
    fixture.componentInstance.submit(); // ignored while loading
    http.expectOne('/policy/quote').flush(mockResponse);
  });

  it('goes loading → error with the backend field issues named by their labels', () => {
    const page = create().componentInstance;
    page.quoteResult.set(mockResponse); // a previous quote
    page.submit();
    http.expectOne('/policy/quote').flush(
      { error: 'Validation failed', issues: [{ field: 'age', message: 'Too small: expected number to be >=18' }] },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(page.loading()).toBe(false);
    expect(page.quoteResult()).toBeNull(); // no stale premium next to an error
    expect(page.errorMessage()).toContain('Age: Too small');
  });

  it('shows a generic message with the reference on a 500', () => {
    const page = create().componentInstance;
    page.submit();
    http.expectOne('/policy/quote').flush({ error: 'Quote engine unavailable', requestId: 'abc-123' }, { status: 500, statusText: 'Server Error' });
    expect(page.errorMessage()).toBe("We couldn't get a quote right now. Please try again (reference abc-123).");
  });

  it('shows a connection message when the backend is unreachable', () => {
    const page = create().componentInstance;
    page.submit();
    http.expectOne('/policy/quote').error(new ProgressEvent('error'), { status: 0 });
    expect(page.errorMessage()).toContain("couldn't reach the quote service");
  });

  it('does not post an invalid form, and shows inline errors', async () => {
    const fixture = TestBed.createComponent(QuotePageComponent);
    fixture.componentInstance.submit();
    await fixture.whenStable();
    http.expectNone('/policy/quote');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#age')?.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#age-error')?.textContent).toContain('18 to 120');
  });
});
