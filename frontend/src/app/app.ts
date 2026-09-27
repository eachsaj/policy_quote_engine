import { ChangeDetectionStrategy, Component } from '@angular/core';
import { QuotePageComponent } from './quote/quote-page.component';

@Component({
  selector: 'app-root',
  imports: [QuotePageComponent],
  template: '<app-quote-page />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
