/**
 * Type System Unit Tests for coverage
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseType, isPrimitive, isSpecialized, toGraphQLType, toTypeScriptType, toPythonType, generateZodSchema, validateValue } = require('../type-system');

describe('type-system primitives and specialized', () => {
  it('isPrimitive checks', () => {
    expect(isPrimitive('string')).toBe(true);
    expect(isPrimitive('number')).toBe(true);
    expect(isPrimitive('boolean')).toBe(true);
    expect(isPrimitive('object')).toBe(true);
    expect(isPrimitive('array')).toBe(true);
    expect(isPrimitive('custom')).toBe(false);
  });

  it('isSpecialized checks', () => {
    expect(isSpecialized('email')).toBe(true);
    expect(isSpecialized('jwt')).toBe(true);
    expect(isSpecialized('url')).toBe(true);
    expect(isSpecialized('datetime')).toBe(true);
    expect(isSpecialized('id')).toBe(true);
    expect(isSpecialized('file')).toBe(true);
    expect(isSpecialized('element')).toBe(true);
    expect(isSpecialized('string')).toBe(false);
  });
});

describe('GraphQL/TS/Python mappings', () => {
  it('custom type passthrough in GraphQL', () => {
    const t = parseType('Custom!');
    expect(toGraphQLType(t)).toBe('Custom!');
  });
  it('TypeScript nullable array', () => {
    const t = parseType('array<string>');
    expect(toTypeScriptType(t)).toBe('Array<string | null> | null');
  });
  it('Python required array of required items', () => {
    const t = parseType('array<string!>!');
    expect(toPythonType(t)).toBe('List[str]');
  });
});

describe('Zod generation branches', () => {
  it('number constraints (int/min/max)', () => {
    const schema = generateZodSchema('age', parseType('number!'), { integer: true, min: 1, max: 100 });
    expect(schema).toContain('z.number');
    expect(schema).toContain('.int(');
    expect(schema).toContain('.min(1');
    expect(schema).toContain('.max(100');
  });
  it('email/url/jwt/datetime refinements', () => {
    expect(generateZodSchema('e', parseType('email!'))).toContain('.email(');
    expect(generateZodSchema('u', parseType('url!'))).toContain('.url(');
    expect(generateZodSchema('t', parseType('jwt!'))).toContain('regex(/^[A-Za-z0-9-_]+');
    expect(generateZodSchema('d', parseType('datetime!'))).toContain('.datetime(');
  });
  it('array min/max items', () => {
    const s = generateZodSchema('tags', parseType('array<string!>!'), { minItems: 1, maxItems: 3 });
    expect(s).toContain('.min(1');
    expect(s).toContain('.max(3');
  });
  it('object and unknown custom type', () => {
    expect(generateZodSchema('obj', parseType('object'))).toContain('z.record');
    expect(generateZodSchema('x', parseType('Foo'))).toContain('z.unknown');
  });
});

describe('Runtime validation branches', () => {
  it('required string null fails', () => {
    const res = validateValue(null, 'string!', {});
    expect(res.valid).toBe(false);
    expect(res.errors[0].constraint).toBe('required');
  });
  it('array length constraints fail', () => {
    const res = validateValue(['a'], 'array<string!>!', { minItems: 2 });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: { constraint?: string }) => e.constraint === 'minItems')).toBe(true);
  });
  it('simple type type mismatch', () => {
    const res = validateValue(42, 'string!', {});
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: { constraint?: string }) => e.constraint === 'type')).toBe(true);
  });
  it('format validations fail', () => {
    expect(validateValue('bad', 'email!', {}).valid).toBe(false);
    expect(validateValue('notaurl', 'url!', {}).valid).toBe(false);
    expect(validateValue('bad.jwt', 'jwt!', {}).valid).toBe(false);
    expect(validateValue('not-a-date', 'datetime!', {}).valid).toBe(false);
  });
});
