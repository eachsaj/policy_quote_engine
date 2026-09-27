import { TestBed } from '@angular/core/testing';
import type { QuoteResponse } from '../models/quote';
import { QuoteResultComponent } from './quote-result.component';

// A response shaped like the backend's for requests/high-risk.json (85 → HIGH_RISK, 300 × 2.2 × 1.2 = 792).
const highRisk: QuoteResponse = {
  monthlyPremium: 66, annualPremium: 792, riskBand: 'HIGH_RISK', riskBandLabel: 'HIGH RISK', riskScore: 85,
  riskSummary: 'High risk profile: 4 risk factor(s) applied for a total score of 85.', kbVersion: '1.0.0',
  coverageDetails: { basePremium: 300, riskMultiplier: 2.2, coverageLoadFactor: 1.2, sumInsured: 900000, items: [{ id: 'buildings', description: 'Buildings cover' }] },
  appliedFactors: [
    { id: 'age_young_elderly', description: 'Under 25 or over 75 — higher risk profile', points: 20, occurrences: 1 },
    { id: 'previous_claims_low', description: '1–2 previous claims', points: 30, occurrences: 2 },
    { id: 'property_type_flat', description: 'Flat — higher shared risk', points: 10, occurrences: 1 },
    { id: 'property_value_high', description: 'Property value over €750,000', points: 25, occurrences: 1 },
  ],
};

const render = async (quote: QuoteResponse): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(QuoteResultComponent);
  fixture.componentRef.setInput('quote', quote);
  await fixture.whenStable();
  return fixture.nativeElement;
};
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();

describe('QuoteResultComponent', () => {
  it('shows the premiums in euro', async () => {
    const el = await render(highRisk);
    expect(text(el.querySelector('.premium-monthly'))).toBe('€66.00');
    expect(text(el.querySelector('.premium-annual'))).toBe('€792.00 a year');
  });

  it('passes the KB band and label to the badge, and shows the KB summary verbatim', async () => {
    const el = await render(highRisk);
    const badge = el.querySelector('app-risk-band-badge');
    expect(badge?.getAttribute('data-band')).toBe('HIGH_RISK');
    expect(text(badge)).toBe('HIGH RISK');
    expect(text(el.querySelector('.summary'))).toBe(highRisk.riskSummary);
  });

  it('renders one row per applied factor, from the response, highest points first', async () => {
    const el = await render(highRisk);
    const rows = [...el.querySelectorAll('.factor')];
    expect(rows.map((r) => text(r.querySelector('.factor-points')))).toEqual(['+30', '+25', '+20', '+10']);
    expect(text(rows[0]?.querySelector('.factor-text'))).toBe('1–2 previous claims × 2');
    expect(text(rows[1])).toContain('Property value over €750,000');
    expect(text(el.querySelector('.total strong'))).toBe('85');
    expect(el.querySelector('.mismatch')).toBeNull();
  });

  it('renders a factor it has never seen, because rows come from appliedFactors, not code', async () => {
    const withNew: QuoteResponse = {
      ...highRisk, riskScore: 100,
      appliedFactors: [...highRisk.appliedFactors, { id: 'flood_zone', description: 'Property in a flood-risk Eircode routing area', points: 15, occurrences: 1 }],
    };
    const el = await render(withNew);
    expect(el.querySelectorAll('.factor')).toHaveLength(5);
    expect(el.textContent).toContain('Property in a flood-risk Eircode routing area');
  });

  it('says so when no factors applied', async () => {
    const el = await render({ ...highRisk, riskScore: 0, riskBand: 'STANDARD', riskBandLabel: 'STANDARD', appliedFactors: [] });
    expect(el.querySelector('.factors')).toBeNull();
    expect(text(el.querySelector('.no-factors'))).toBe('No risk factors applied. Risk score 0.');
  });

  it('flags a mismatch between the factor total and riskScore instead of hiding it', async () => {
    const el = await render({ ...highRisk, riskScore: 90 });
    expect(text(el.querySelector('.total strong'))).toBe('90');
    expect(text(el.querySelector('.mismatch'))).toContain('add up to 85');
  });

  it('shows the coverage breakdown and KB version', async () => {
    const el = await render(highRisk);
    const rows = Object.fromEntries(
      [...el.querySelectorAll('.breakdown dl > div')].map((d) => [text(d.querySelector('dt')), text(d.querySelector('dd'))]),
    );
    expect(rows).toEqual({
      'Base premium': '€300.00', 'Risk multiplier': '× 2.2', 'Coverage load factor': '× 1.2',
      'Annual premium': '€792.00', 'Property value': '€900,000', 'Cover included': 'Buildings cover',
    });
    expect(text(el.querySelector('.kb-version'))).toBe('Rules version 1.0.0');
  });
});
