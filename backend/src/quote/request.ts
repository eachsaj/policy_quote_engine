import { z } from 'zod';

// Exactly the brief's form options. Do not add options the brief lacks.
export const propertyTypes = ['House', 'Flat', 'Bungalow'] as const;

// Irish Eircode: a 3-character routing key (letter, digit, digit or W as in D6W) and a 4-character unique identifier,
// optional space. Eircodes avoid the letters B, G, I, J, L, M, O, Q, S, U and Z.
const eircode = /^[ACDEFHKNPRTVWXY]\d[\dW] ?[\dACDEFHKNPRTVWXY]{4}$/i;

// The brief's six form fields, in form order (specs/tech-stack.md "Request contract").
// This is the one place the request shape is declared; the KB loader checks every condition.field against it.
export const quoteRequestSchema = z.object({
  customerName: z.string().trim().min(1).max(100), // required by the form; not a scoring input, never logged
  age: z.number().int().min(18).max(120),
  propertyType: z.enum(propertyTypes),
  propertyValue: z.number().positive(),
  postcode: z.string().trim().regex(eircode, 'Must be a valid Eircode').transform((p) => p.toUpperCase()),
  previousClaims: z.number().int().min(0).max(20), // in the last 5 years
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

/** Request fields that are collected but never scored. The loader rejects KB conditions on them; the service strips them. */
export const unscoredFields: ReadonlySet<string> = new Set<keyof QuoteRequest>(['customerName']);
