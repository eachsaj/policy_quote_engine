import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { handler } from './handler';
import type { HttpEvent } from './http/types';
import * as loader from './kb/loader';

const ctx = { awsRequestId: 'req-test-1' };
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, '../requests', `${name}.json`), 'utf8')) as unknown;
const post = (body: unknown): HttpEvent => ({ httpMethod: 'POST', path: '/policy/quote', body: JSON.stringify(body) });
const json = (body: string): unknown => JSON.parse(body) as unknown;

const issuesBody = z.object({ error: z.string(), issues: z.array(z.object({ field: z.string(), message: z.string() })) });

describe('handler', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns 200 with the full response shape and CORS', async () => {
    const res = await handler(post(sample('standard')), ctx);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(json(res.body)).toEqual({
      monthlyPremium: expect.any(Number), annualPremium: expect.any(Number), currency: expect.any(String),
      riskBand: expect.any(String), riskBandLabel: expect.any(String), riskScore: expect.any(Number),
      riskSummary: expect.any(String), coverageDetails: expect.any(Object),
      appliedFactors: expect.any(Array), kbVersion: expect.any(String),
    });
  });

  // Each sample request exists to land in one band. Exact scores and premiums are asserted by the
  // KB-driven scenario fixtures (backend/test/scenarios), so a KB-only change never needs an edit here.
  test.each<[string, string]>([
    ['standard', 'STANDARD'],
    ['elevated', 'ELEVATED'],
    ['high-risk', 'HIGH_RISK'],
  ])('requests/%s.json lands in %s and passes the KB version through', async (name, riskBand) => {
    const body = json((await handler(post(sample(name)), ctx)).body);
    expect(body).toMatchObject({ riskBand, kbVersion: loader.loadKb().version });
  });

  it('returns 400 with field issues for an invalid body', async () => {
    const res = await handler(post({ age: 12, propertyType: 'Detached' }), ctx);
    expect(res.statusCode).toBe(400);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    const fields = issuesBody.parse(json(res.body)).issues.map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(['customerName', 'age', 'propertyType', 'propertyValue', 'postcode', 'previousClaims']));
  });

  test.each<[string, string | null]>([
    ['missing', null],
    ['empty', '  '],
    ['not JSON', '{ "age": '],
  ])('returns 400 for a %s body', async (_name, body) => {
    const res = await handler({ httpMethod: 'POST', path: '/policy/quote', body }, ctx);
    expect(res.statusCode).toBe(400);
    expect(json(res.body)).toEqual({ error: 'Request body must be a JSON object' });
  });

  it('returns 404 with CORS for an unknown route', async () => {
    const res = await handler({ httpMethod: 'GET', path: '/policy/quote', body: null }, ctx);
    expect(res.statusCode).toBe(404);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('answers the CORS preflight with 204', async () => {
    const res = await handler({ httpMethod: 'OPTIONS', path: '/policy/quote', body: null }, ctx);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Methods']).toContain('POST');
  });

  it('reports the KB version on /health', async () => {
    const res = await handler({ httpMethod: 'GET', path: '/health', body: null }, ctx);
    const kb = loader.loadKb();
    expect(json(res.body)).toEqual({ status: 'ok', kbVersion: kb.version, schemaVersion: kb.schemaVersion, factorCount: kb.factors.length });
  });

  it('returns 500 with a requestId and no internals when the KB is invalid', async () => {
    const detail = 'Invalid KB at /kb/risk-kb.json:\n  - factors.0.condition.operator: unknown operator "regex"';
    jest.spyOn(loader, 'loadKb').mockImplementation(() => { throw new loader.KbValidationError('/kb/risk-kb.json', [detail]); });
    const stderr = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await handler(post(sample('standard')), ctx);

    expect(res.statusCode).toBe(500);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(json(res.body)).toEqual({ error: 'Quote engine unavailable', requestId: 'req-test-1' });
    expect(res.body).not.toContain('regex');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('unknown operator'));
  });
});
