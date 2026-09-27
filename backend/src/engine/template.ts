/** A `{token}` placeholder in a KB template, e.g. `{score}` in a band summary. */
const TOKEN = /\{(\w+)\}/g;

/** The `{token}` names a template uses, in order of appearance. */
export const templateTokens = (template: string): string[] => [...template.matchAll(TOKEN)].map((m) => m[1] ?? '');

/** Generic `{token}` substitution. Unknown tokens are left as written; the loader rejects them up front. */
export const interpolate = (template: string, values: Readonly<Record<string, string | number>>): string =>
  template.replace(TOKEN, (whole, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : whole));
