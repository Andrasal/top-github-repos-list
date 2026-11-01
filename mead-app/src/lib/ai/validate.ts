/**
 * Minimal JSON-Schema check for the chat tools' input schemas (SPEC §25.3).
 * Covers the subset those schemas use: type, properties, required, items, enum.
 * Extra properties are allowed. Returns a list of problems; empty means valid.
 */
export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  [k: string]: unknown;
}

const typeOf = (v: unknown): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isFinite(v) ? 'number' : 'nan') : typeof v;

export function validate(value: unknown, schema: Schema | undefined, path = 'input'): string[] {
  if (!schema) return [];
  const out: string[] = [];
  const t = typeOf(value);
  if (schema.type) {
    const ok = schema.type === t || (schema.type === 'integer' && t === 'number' && Number.isInteger(value));
    if (!ok) return [`${path} should be ${schema.type}, got ${t}`];
  }
  if (schema.enum && !schema.enum.includes(value)) out.push(`${path} should be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  if (t === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of schema.required ?? []) if (!(k in o) || o[k] === undefined) out.push(`${path}.${k} is required`);
    for (const [k, sub] of Object.entries(schema.properties ?? {})) if (k in o && o[k] !== undefined) out.push(...validate(o[k], sub, `${path}.${k}`));
  }
  if (t === 'array' && schema.items) (value as unknown[]).forEach((v, i) => out.push(...validate(v, schema.items, `${path}[${i}]`)));
  return out;
}
