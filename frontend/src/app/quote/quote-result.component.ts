import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { QuoteResponse } from '../models/quote';
import { RiskBandBadgeComponent } from '../risk-band-badge/risk-band-badge.component';
import { formatMoney } from './money';

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

  // Amounts in the quote's currency (GBP or EUR, from the postcode): same numbers, no conversion.
  protected readonly monthly = computed(() => formatMoney(this.quote().monthlyPremium, this.quote().currency));
  protected readonly annual = computed(() => formatMoney(this.quote().annualPremium, this.quote().currency));
  protected readonly sumInsured = computed(() => formatMoney(this.quote().coverageDetails.sumInsured, this.quote().currency, true));
  protected readonly basePremium = computed(() => formatMoney(this.quote().coverageDetails.basePremium, this.quote().currency));
  /** Highest contribution first. */
  protected readonly sortedFactors = computed(() => [...this.quote().appliedFactors].sort((a, b) => b.points - a.points));
  protected readonly totalPoints = computed(() => this.sortedFactors().reduce((sum, f) => sum + f.points, 0));
  /** Should always hold; if it ever doesn't, the UI shows the backend's riskScore and says so rather than hiding it. */
  protected readonly totalsAgree = computed(() => this.totalPoints() === this.quote().riskScore);
}
