// A structural subset of the API Gateway proxy types, defined locally so the backend has no AWS
// dependency. A real Lambda event and context still satisfy these interfaces.

export interface HttpEvent {
  readonly httpMethod: string;
  readonly path: string;
  readonly body: string | null;
  readonly headers?: Readonly<Record<string, string | undefined>>;
}

export interface HttpResult {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface HandlerContext {
  readonly awsRequestId: string;
}
