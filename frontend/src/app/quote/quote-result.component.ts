import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { QuoteResponse } from '../models/quote';
import { RiskBandBadgeComponent } from '../risk-band-badge/risk-band-badge.component';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbpWhole = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

/**
 * Presentational: reads one quote and derives everything with computed(). Every piece of risk wording
 * (badge label, summary, factor descriptions) comes from the response, and so from the KB.
 */
@Component({
  selector: 'app-quote-result',
  imports: [RiskBandBadgeComponent],
  templateUrl: './quote-result.component.html',
  styleUrl: './quote-result.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteResultComponent {
  readonly quote = input.required<QuoteResponse>();

  protected readonly monthly = computed(() => gbp.format(this.quote().monthlyPremium));
  protected readonly annual = computed(() => gbp.format(this.quote().annualPremium));
  protected readonly sumInsured = computed(() => gbpWhole.format(this.quote().coverageDetails.sumInsured));
  protected readonly basePremium = computed(() => gbp.format(this.quote().coverageDetails.basePremium));
  /** Highest contribution first. */
  protected readonly sortedFactors = computed(() => [...this.quote().appliedFactors].sort((a, b) => b.points - a.points));
  protected readonly totalPoints = computed(() => this.sortedFactors().reduce((sum, f) => sum + f.points, 0));
  /** Should always hold; if it ever doesn't, the UI shows the backend's riskScore and says so rather than hiding it. */
  protected readonly totalsAgree = computed(() => this.totalPoints() === this.quote().riskScore);
}
