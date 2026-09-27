import type { HandlerContext, HttpEvent, HttpResult } from './http/types';
import { currentKb } from './kb/refresh';
import { quoteRequestSchema } from './quote/request';
import { getQuote } from './quote/service';

// Protocol only: parse, validate, route, build the envelope, map errors.
// Scoring lives in quote/service.ts and engine/*, driven by the KB.

const corsHeaders: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const respond = (statusCode: number, payload?: unknown): HttpResult => ({
  statusCode,
  headers: corsHeaders,
  body: payload === undefined ? '' : JSON.stringify(payload),
});

const parseJson = (body: string | null): { ok: true; value: unknown } | { ok: false } => {
  if (body === null || body.trim() === '') return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false };
  }
};

const postQuote = (event: HttpEvent): HttpResult => {
  const json = parseJson(event.body);
  if (!json.ok) return respond(400, { error: 'Request body must be a JSON object' });

  const parsed = quoteRequestSchema.safeParse(json.value);
  if (!parsed.success) {
    return respond(400, {
      error: 'Validation failed',
      issues: parsed.error.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message })),
    });
  }
  return respond(200, getQuote(parsed.data, currentKb()));
};

const getHealth = (): HttpResult => {
  const kb = currentKb();
  return respond(200, { status: 'ok', kbVersion: kb.version, schemaVersion: kb.schemaVersion, factorCount: kb.factors.length });
};

/** The route table: "METHOD /path" → handler. POST /policy/quote is the one business endpoint. */
const routes: Readonly<Record<string, (event: HttpEvent) => HttpResult>> = {
  'POST /policy/quote': postQuote,
  'GET /health': getHealth,
  'OPTIONS /policy/quote': () => respond(204),
};

/** Lambda-compatible entry point (API Gateway proxy shape). */
export const handler = async (event: HttpEvent, context: HandlerContext): Promise<HttpResult> => {
  const route = routes[`${event.httpMethod.toUpperCase()} ${event.path}`];
  if (!route) return respond(404, { error: 'Not found' });
  try {
    return route(event);
  } catch (err) {
    // KB unreadable or invalid. The loader's message names the bad path; it goes to stderr, never to the client.
    console.error(JSON.stringify({ requestId: context.awsRequestId, error: err instanceof Error ? err.message : String(err) }));
    return respond(500, { error: 'Quote engine unavailable', requestId: context.awsRequestId });
  }
};
