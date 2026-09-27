import { type AbstractControl, FormBuilder, type ValidationErrors, type ValidatorFn, Validators } from '@angular/forms';
import { currencyOf, propertyTypes, type PropertyType, type QuoteRequest } from '../models/quote';

// Validators mirror the backend Zod schema (backend/src/quote/request.ts). Change both in the same turn.


const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '';

/** z.number().int() */
const integer: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  isBlank(c.value) || Number.isInteger(c.value) ? null : { integer: true };

/** z.number().positive(): strictly greater than 0 (Validators.min is inclusive). */
const positive: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  isBlank(c.value) || (typeof c.value === 'number' && c.value > 0) ? null : { positive: true };

/** The backend's isKnownPostcode: a UK postcode or an Irish Eircode. */
const ukPostcodeOrEircode: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  isBlank(c.value) || (typeof c.value === 'string' && currencyOf(c.value) !== undefined) ? null : { postcode: true };

/** z.string().trim().min(1): whitespace-only fails, as it does on the backend. */
const notBlank: ValidatorFn = (c: AbstractControl): ValidationErrors | null =>
  typeof c.value === 'string' && c.value.trim().length > 0 ? null : { required: true };

/**
 * The six-field reactive form, with validators matching the backend's Zod schema field by field.
 * Numeric fields start empty (null), except previous claims, which defaults to 0.
 */
export const buildQuoteForm = (fb: FormBuilder) =>
  fb.group({
    customerName: fb.nonNullable.control('', [notBlank, Validators.maxLength(100)]),
    age: fb.control<number | null>(null, [Validators.required, integer, Validators.min(18), Validators.max(120)]),
    propertyType: fb.control<PropertyType | null>(null, Validators.required),
    propertyValue: fb.control<number | null>(null, [Validators.required, positive]),
    postcode: fb.nonNullable.control('', [Validators.required, ukPostcodeOrEircode]),
    previousClaims: fb.control<number | null>(0, [Validators.required, integer, Validators.min(0), Validators.max(20)]),
  });

/** The form's type, inferred from buildQuoteForm so the controls stay strongly typed. */
export type QuoteForm = ReturnType<typeof buildQuoteForm>;

/** Form labels, also used to name fields in backend 400 messages. */
export const fieldLabels: Readonly<Record<keyof QuoteRequest, string>> = {
  customerName: 'Full name',
  age: 'Age',
  propertyType: 'Property type',
  propertyValue: 'Property value',
  postcode: 'Postcode or Eircode',
  previousClaims: 'Previous claims in the last 5 years',
};

/** Narrows the select's value (null until a type is chosen) to a PropertyType, without a cast. */
const isPropertyType = (v: unknown): v is PropertyType => propertyTypes.some((p) => p === v);

/** Builds the request by narrowing the raw form value: no `!` and no `as`. Returns null if anything is missing. */
export const toQuoteRequest = (v: ReturnType<QuoteForm['getRawValue']>): QuoteRequest | null =>
  v.age === null || v.propertyValue === null || v.previousClaims === null || !isPropertyType(v.propertyType)
    ? null
    : {
        customerName: v.customerName.trim(),
        age: v.age,
        propertyType: v.propertyType,
        propertyValue: v.propertyValue,
        postcode: v.postcode.trim().toUpperCase(),
        previousClaims: v.previousClaims,
      };
