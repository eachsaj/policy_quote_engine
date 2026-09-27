import { TestBed } from '@angular/core/testing';
import { RiskBandBadgeComponent } from './risk-band-badge.component';

const render = async (riskBand: string, label?: string): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(RiskBandBadgeComponent);
  fixture.componentRef.setInput('riskBand', riskBand);
  if (label !== undefined) fixture.componentRef.setInput('label', label);
  await fixture.whenStable();
  return fixture.nativeElement;
};

describe('RiskBandBadgeComponent', () => {
  // The KB's three bands: the id styles the badge, the KB label is the text.
  it.each([
    ['STANDARD', 'STANDARD'],
    ['ELEVATED', 'ELEVATED'],
    ['HIGH_RISK', 'HIGH RISK'],
  ])('shows the KB label for %s', async (band, label) => {
    const el = await render(band, label);
    expect(el.textContent?.trim()).toBe(label);
    expect(el.getAttribute('data-band')).toBe(band);
  });

  it('falls back to the band id, with a neutral style, for a band the CSS does not know', async () => {
    const el = await render('SUPER_HIGH');
    expect(el.textContent?.trim()).toBe('SUPER_HIGH');
    expect(el.getAttribute('data-band')).toBe('SUPER_HIGH'); // no [data-band='SUPER_HIGH'] rule exists, so :host defaults apply
  });

  it('updates when the input changes', async () => {
    const fixture = TestBed.createComponent(RiskBandBadgeComponent);
    fixture.componentRef.setInput('riskBand', 'STANDARD');
    fixture.componentRef.setInput('label', 'STANDARD');
    await fixture.whenStable();
    fixture.componentRef.setInput('riskBand', 'HIGH_RISK');
    fixture.componentRef.setInput('label', 'HIGH RISK');
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect([el.textContent?.trim(), el.getAttribute('data-band')]).toEqual(['HIGH RISK', 'HIGH_RISK']);
  });
});
