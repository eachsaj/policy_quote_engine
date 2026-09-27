import type { HandlerContext, HttpEvent, HttpResult } from './http/types';
import { currentKb } from './kb/refresh';
import { quoteRequestSchema } from './quote/request';
import { getQuote } from './quote/service';

// Protocol only: parse, validate, route, build the envelope, map errors.
// Scoring lives in quote/service.ts and engine/*, driven by the KB.

/** Sent on every response, errors included, so a browser on another origin can read 400 and 500 bodies too. */
const corsHeaders: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Builds the response envelope: status, CORS headers and a JSON body (empty when there is no payload). */
const respond = (statusCode: number, payload?: unknown): HttpResult => ({
  statusCode,
  headers: corsHeaders,
  body: payload === undefined ? '' : JSON.stringify(payload),
});

/** Parses the body to `unknown` for Zod to narrow. A missing, blank or malformed body is `{ ok: false }`, never a throw. */
const parseJson = (body: string | null): { ok: true; value: unknown } | { ok: false } => {
  if (body === null || body.trim() === '') return { ok: false };
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false };
  }
};

/** POST /policy/quote: 400 with per-field issues for a bad body, otherwise 200 with the priced quote. */
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

/** GET /health: liveness plus the active KB's version and size, used by the Docker HEALTHCHECK. */
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

/**
 * Lambda-compatible entry point (API Gateway proxy shape). An unknown route is a 404. Any error while
 * handling a route (in practice an unreadable KB) is a 500 carrying only the request id; the detail goes to stderr.
 */
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
