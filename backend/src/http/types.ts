// A structural subset of the API Gateway proxy types, defined locally so the backend has no AWS
// dependency. A real Lambda event and context still satisfy these interfaces.

/** The request as the handler sees it: what API Gateway sends, or what server.ts builds from a node:http request. */
export interface HttpEvent {
  readonly httpMethod: string; // e.g. "POST"; matched case-insensitively by the route table
  readonly path: string;       // without the query string, e.g. "/policy/quote"
  readonly body: string | null; // raw JSON text; null when the request has no body
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

/** The response the handler returns. The body is already serialised JSON (or empty for 204). */
export interface HttpResult {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** The one context field the handler uses: a request id, returned in 500 bodies and written to the error log. */
export interface HandlerContext {
  readonly awsRequestId: string;
}
