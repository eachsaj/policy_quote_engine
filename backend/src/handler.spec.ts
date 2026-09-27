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
      monthlyPremium: expect.any(Number), annualPremium: expect.any(Number),
      riskBand: expect.any(String), riskBandLabel: expect.any(String), riskScore: expect.any(Number),
      riskSummary: expect.any(String), coverageDetails: expect.any(Object),
      appliedFactors: expect.any(Array), kbVersion: expect.any(String),
    });
  });

  // One sample per band, expected values worked out by hand from risk-kb.json.
  test.each<[string, number, string, string, number, number]>([
    ['standard', 10, 'STANDARD', 'STANDARD', 360, 30],     // Flat +10 → 0–25; 300 × 1.0 × 1.2
    ['elevated', 30, 'ELEVATED', 'ELEVATED', 540, 45],     // 2 claims × 15 → 26–60; 300 × 1.5 × 1.2
    ['high-risk', 85, 'HIGH_RISK', 'HIGH RISK', 792, 66],  // 20 + 10 + 25 + 15 × 2 → 61+; 300 × 2.2 × 1.2
  ])('requests/%s.json scores %i → %s', async (name, riskScore, riskBand, riskBandLabel, annualPremium, monthlyPremium) => {
    const res = await handler(post(sample(name)), ctx);
    expect(json(res.body)).toMatchObject({ riskScore, riskBand, riskBandLabel, annualPremium, monthlyPremium, kbVersion: '1.0.0' });
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
    expect(json(res.body)).toEqual({ status: 'ok', kbVersion: '1.0.0', schemaVersion: 1, factorCount: 5 });
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
