import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Reusable risk band badge. The text is the band's KB label; the band id only selects a colour
 * through the host `data-band` attribute. A band the CSS doesn't know keeps a neutral style, so a new KB band
 * needs no frontend change.
 */
@Component({
  selector: 'app-risk-band-badge',
  template: `{{ text() }}`,
  styleUrl: './risk-band-badge.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'badge', '[attr.data-band]': 'riskBand()' },
})
export class RiskBandBadgeComponent {
  /** The KB band id, e.g. HIGH_RISK. Selects the colour only; it is shown as text only when there is no label. */
  readonly riskBand = input.required<string>();
  /** The KB's customer-facing label, e.g. "HIGH RISK". */
  readonly label = input<string>();

  /** The badge text: the label, falling back to the band id. */
  protected readonly text = computed(() => this.label() ?? this.riskBand());
}
