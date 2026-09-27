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
  readonly riskBand = input.required<string>();
  readonly label = input<string>();

  protected readonly text = computed(() => this.label() ?? this.riskBand());
}
