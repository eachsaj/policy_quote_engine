import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { QuoteRequest, QuoteResponse } from '../models/quote';

/** The Observable stops here: the page subscribes once per submit and writes signals. */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly http = inject(HttpClient);

  /** Relative URL: proxied to the backend by proxy.conf.json in dev, and by nginx in Docker. */
  getQuote(request: QuoteRequest): Observable<QuoteResponse> {
    return this.http.post<QuoteResponse>('/policy/quote', request);
  }
}
