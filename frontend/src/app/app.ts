import { ChangeDetectionStrategy, Component } from '@angular/core';
import { QuotePageComponent } from './quote/quote-page.component';

/** The root component. The app is a single page, so it only hosts the quote page. */
@Component({
  selector: 'app-root',
  imports: [QuotePageComponent],
  template: '<app-quote-page />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
