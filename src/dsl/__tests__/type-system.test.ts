/**
 * Type System Tests
 * Testing REQ-047 (Unified Type System)
 */

import {
  parseType,
  isPrimitive,
  isSpecialized,
  toGraphQLType,
  toTypeScriptType,
  toPythonType,
  generateZodSchema,
  validateValue,
  type ParsedType,
  type TypeConstraints
} from '../type-system';

describe('Type Parsing (REQ-047)', () => {
  describe('Simple types', () => {
    it('should parse nullable string', () => {
      const parsed = parseType('string');
      
      expect(parsed.baseType).toBe('string');
      expect(parsed.isArray).toBe(false);
      expect(parsed.nullability.nullable).toBe(true);
      expect(parsed.original).toBe('string');
    });
    
    it('should parse required string', () => {
      const parsed = parseType('string!');
      
      expect(parsed.baseType).toBe('string');
      expect(parsed.isArray).toBe(false);
      expect(parsed.nullability.nullable).toBe(false);
    });
    
    it('should parse all primitive types', () => {
      const primitives = ['string', 'number', 'boolean', 'object', 'array'];
      
      primitives.forEach(type => {
        const parsed = parseType(type);
        expect(parsed.baseType).toBe(type);
        expect(isPrimitive(type)).toBe(true);
      });
    });
    
    it('should parse all specialized types', () => {
      const specialized = ['jwt', 'datetime', 'email', 'url', 'id', 'file', 'element'];
      
      specialized.forEach(type => {
        const parsed = parseType(type);
        expect(parsed.baseType).toBe(type);
        expect(isSpecialized(type)).toBe(true);
      });
    });
    
    it('should parse custom types', () => {
      const parsed = parseType('CustomUser!');
      
      expect(parsed.baseType).toBe('CustomUser');
      expect(parsed.nullability.nullable).toBe(false);
      expect(isPrimitive(parsed.baseType)).toBe(false);
      expect(isSpecialized(parsed.baseType)).toBe(false);
    });
  });
  
  describe('Array types', () => {
    it('should parse nullable array of nullable items', () => {
      const parsed = parseType('array<User>');
      
      expect(parsed.baseType).toBe('array');
      expect(parsed.isArray).toBe(true);
      expect(parsed.nullability.nullable).toBe(true);
      expect(parsed.itemType).toBeDefined();
      expect(parsed.itemType?.baseType).toBe('User');
      expect(parsed.itemType?.nullability.nullable).toBe(true);
    });
    
    it('should parse nullable array of required items', () => {
      const parsed = parseType('array<User!>');
      
      expect(parsed.baseType).toBe('array');
      expect(parsed.isArray).toBe(true);
      expect(parsed.nullability.nullable).toBe(true);
      expect(parsed.itemType?.baseType).toBe('User');
      expect(parsed.itemType?.nullability.nullable).toBe(false);
    });
    
    it('should parse required array of required items', () => {
      const parsed = parseType('array<User!>!');
      
      expect(parsed.baseType).toBe('array');
      expect(parsed.isArray).toBe(true);
      expect(parsed.nullability.nullable).toBe(false);
      expect(parsed.itemType?.baseType).toBe('User');
      expect(parsed.itemType?.nullability.nullable).toBe(false);
    });
    
    it('should parse array of primitives', () => {
      const parsed = parseType('array<string!>!');
      
      expect(parsed.itemType?.baseType).toBe('string');
      expect(parsed.itemType?.nullability.nullable).toBe(false);
    });
  });
});

// =============================================================================
// GraphQL Type Generation (REQ-047)
// =============================================================================

describe('GraphQL Type Generation (REQ-047)', () => {
  it('should map nullable string to String', () => {
    const parsed = parseType('string');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('String');
  });
  
  it('should map required string to String!', () => {
    const parsed = parseType('string!');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('String!');
  });
  
  it('should map number to Float', () => {
    const parsed = parseType('number!');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('Float!');
  });
  
  it('should map boolean to Boolean', () => {
    const parsed = parseType('boolean!');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('Boolean!');
  });
  
  it('should map id to ID', () => {
    const parsed = parseType('id!');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('ID!');
  });
  
  it('should map array types correctly', () => {
    const testCases = [
      { input: 'array<User>', expected: '[User]' },
      { input: 'array<User!>', expected: '[User!]' },
      { input: 'array<User>!', expected: '[User]!' },
      { input: 'array<User!>!', expected: '[User!]!' },
    ];
    
    testCases.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const graphql = toGraphQLType(parsed);
      expect(graphql).toBe(expected);
    });
  });
  
  it('should map specialized types to GraphQL scalars', () => {
    const mappings = [
      { input: 'email!', expected: 'String!' },
      { input: 'url!', expected: 'String!' },
      { input: 'jwt!', expected: 'String!' },
      { input: 'datetime!', expected: 'String!' },
      { input: 'file!', expected: 'Upload!' },
    ];
    
    mappings.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const graphql = toGraphQLType(parsed);
      expect(graphql).toBe(expected);
    });
  });
  
  it('should preserve custom type names', () => {
    const parsed = parseType('CustomUser!');
    const graphql = toGraphQLType(parsed);
    
    expect(graphql).toBe('CustomUser!');
  });
});

// =============================================================================
// TypeScript Type Generation (REQ-047)
// =============================================================================

describe('TypeScript Type Generation (REQ-047)', () => {
  it('should map nullable string to string | null', () => {
    const parsed = parseType('string');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('string | null');
  });
  
  it('should map required string to string', () => {
    const parsed = parseType('string!');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('string');
  });
  
  it('should map number to number', () => {
    const parsed = parseType('number!');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('number');
  });
  
  it('should map boolean to boolean', () => {
    const parsed = parseType('boolean!');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('boolean');
  });
  
  it('should map object to Record<string, unknown>', () => {
    const parsed = parseType('object!');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('Record<string, unknown>');
  });
  
  it('should map array types correctly', () => {
    const testCases = [
      { input: 'array<User>', expected: 'Array<User | null> | null' },
      { input: 'array<User!>', expected: 'Array<User> | null' },
      { input: 'array<User>!', expected: 'Array<User | null>' },
      { input: 'array<User!>!', expected: 'Array<User>' },
    ];
    
    testCases.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const ts = toTypeScriptType(parsed);
      expect(ts).toBe(expected);
    });
  });
  
  it('should map specialized types', () => {
    const mappings = [
      { input: 'email!', expected: 'string' },
      { input: 'url!', expected: 'string' },
      { input: 'jwt!', expected: 'string' },
      { input: 'datetime!', expected: 'string' },
      { input: 'id!', expected: 'string' },
      { input: 'file!', expected: 'File' },
    ];
    
    mappings.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const ts = toTypeScriptType(parsed);
      expect(ts).toBe(expected);
    });
  });
  
  it('should preserve custom type names', () => {
    const parsed = parseType('CustomUser!');
    const ts = toTypeScriptType(parsed);
    
    expect(ts).toBe('CustomUser');
  });
});

// =============================================================================
// Python Type Generation (REQ-047)
// =============================================================================

describe('Python Type Generation (REQ-047)', () => {
  it('should map nullable string to Optional[str]', () => {
    const parsed = parseType('string');
    const python = toPythonType(parsed);
    
    expect(python).toBe('Optional[str]');
  });
  
  it('should map required string to str', () => {
    const parsed = parseType('string!');
    const python = toPythonType(parsed);
    
    expect(python).toBe('str');
  });
  
  it('should map number to float', () => {
    const parsed = parseType('number!');
    const python = toPythonType(parsed);
    
    expect(python).toBe('float');
  });
  
  it('should map boolean to bool', () => {
    const parsed = parseType('boolean!');
    const python = toPythonType(parsed);
    
    expect(python).toBe('bool');
  });
  
  it('should map object to Dict[str, Any]', () => {
    const parsed = parseType('object!');
    const python = toPythonType(parsed);
    
    expect(python).toBe('Dict[str, Any]');
  });
  
  it('should map array types correctly', () => {
    const testCases = [
      { input: 'array<User>', expected: 'Optional[List[Optional[User]]]' },
      { input: 'array<User!>', expected: 'Optional[List[User]]' },
      { input: 'array<User>!', expected: 'List[Optional[User]]' },
      { input: 'array<User!>!', expected: 'List[User]' },
    ];
    
    testCases.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const python = toPythonType(parsed);
      expect(python).toBe(expected);
    });
  });
  
  it('should map specialized types', () => {
    const mappings = [
      { input: 'email!', expected: 'str' },
      { input: 'url!', expected: 'str' },
      { input: 'jwt!', expected: 'str' },
      { input: 'datetime!', expected: 'str' },
      { input: 'id!', expected: 'str' },
      { input: 'file!', expected: 'BinaryIO' },
    ];
    
    mappings.forEach(({ input, expected }) => {
      const parsed = parseType(input);
      const python = toPythonType(parsed);
      expect(python).toBe(expected);
    });
  });
});

// =============================================================================
// Zod Schema Generation (REQ-047)
// =============================================================================

describe('Zod Schema Generation (REQ-047)', () => {
  it('should generate basic string schema', () => {
    const parsed = parseType('string!');
    const zod = generateZodSchema('username', parsed);
    
    expect(zod).toBe('z.string()');
  });
  
  it('should generate nullable string schema', () => {
    const parsed = parseType('string');
    const zod = generateZodSchema('username', parsed);
    
    expect(zod).toBe('z.string().nullable()');
  });
  
  it('should apply string constraints', () => {
    const parsed = parseType('string!');
    const constraints: TypeConstraints = {
      minLength: 3,
      maxLength: 50,
      pattern: '^[a-zA-Z0-9_]+$'
    };
    const zod = generateZodSchema('username', parsed, constraints);
    
    expect(zod).toContain('.min(3');
    expect(zod).toContain('.max(50');
    expect(zod).toContain('.regex(');
  });
  
  it('should apply number constraints', () => {
    const parsed = parseType('number!');
    const constraints: TypeConstraints = {
      min: 0,
      max: 100,
      integer: true
    };
    const zod = generateZodSchema('age', parsed, constraints);
    
    expect(zod).toContain('.int(');
    expect(zod).toContain('.min(0');
    expect(zod).toContain('.max(100');
  });
  
  it('should apply array constraints', () => {
    const parsed = parseType('array<string!>!');
    const constraints: TypeConstraints = {
      minItems: 1,
      maxItems: 10
    };
    const zod = generateZodSchema('tags', parsed, constraints);
    
    expect(zod).toContain('z.array(');
    expect(zod).toContain('.min(1');
    expect(zod).toContain('.max(10');
  });
  
  it('should generate email validation', () => {
    const parsed = parseType('email!');
    const zod = generateZodSchema('email', parsed);
    
    expect(zod).toContain('.email(');
  });
  
  it('should generate url validation', () => {
    const parsed = parseType('url!');
    const zod = generateZodSchema('website', parsed);
    
    expect(zod).toContain('.url(');
  });
  
  it('should generate jwt validation', () => {
    const parsed = parseType('jwt!');
    const zod = generateZodSchema('token', parsed);
    
    expect(zod).toContain('.regex(');
    expect(zod).toContain('JWT');
  });
  
  it('should generate datetime validation', () => {
    const parsed = parseType('datetime!');
    const zod = generateZodSchema('createdAt', parsed);
    
    expect(zod).toContain('.datetime(');
  });
});

// =============================================================================
// Runtime Validation (REQ-047)
// =============================================================================

describe('Runtime Validation (REQ-047)', () => {
  describe('String validation', () => {
    it('should validate required string', () => {
      const result = validateValue('hello', 'string!');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject null for required string', () => {
      const result = validateValue(null, 'string!');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].constraint).toBe('required');
    });
    
    it('should accept null for nullable string', () => {
      const result = validateValue(null, 'string');
      
      expect(result.valid).toBe(true);
    });
    
    it('should validate string length constraints', () => {
      const constraints: TypeConstraints = {
        minLength: 3,
        maxLength: 10
      };
      
      expect(validateValue('ab', 'string!', constraints).valid).toBe(false);
      expect(validateValue('abc', 'string!', constraints).valid).toBe(true);
      expect(validateValue('abcdefghij', 'string!', constraints).valid).toBe(true);
      expect(validateValue('abcdefghijk', 'string!', constraints).valid).toBe(false);
    });
    
    it('should validate string pattern', () => {
      const constraints: TypeConstraints = {
        pattern: '^[a-zA-Z0-9]+$'
      };
      
      expect(validateValue('abc123', 'string!', constraints).valid).toBe(true);
      expect(validateValue('abc-123', 'string!', constraints).valid).toBe(false);
    });
  });
  
  describe('Number validation', () => {
    it('should validate required number', () => {
      const result = validateValue(42, 'number!');
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject non-number', () => {
      const result = validateValue('42', 'number!');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe('type');
    });
    
    it('should validate number range', () => {
      const constraints: TypeConstraints = {
        min: 0,
        max: 100
      };
      
      expect(validateValue(-1, 'number!', constraints).valid).toBe(false);
      expect(validateValue(0, 'number!', constraints).valid).toBe(true);
      expect(validateValue(50, 'number!', constraints).valid).toBe(true);
      expect(validateValue(100, 'number!', constraints).valid).toBe(true);
      expect(validateValue(101, 'number!', constraints).valid).toBe(false);
    });
    
    it('should validate integer constraint', () => {
      const constraints: TypeConstraints = {
        integer: true
      };
      
      expect(validateValue(42, 'number!', constraints).valid).toBe(true);
      expect(validateValue(42.5, 'number!', constraints).valid).toBe(false);
    });
  });
  
  describe('Boolean validation', () => {
    it('should validate boolean values', () => {
      expect(validateValue(true, 'boolean!').valid).toBe(true);
      expect(validateValue(false, 'boolean!').valid).toBe(true);
      expect(validateValue('true', 'boolean!').valid).toBe(false);
    });
  });
  
  describe('Array validation', () => {
    it('should validate array type', () => {
      const result = validateValue(['a', 'b', 'c'], 'array<string!>!');
      
      expect(result.valid).toBe(true);
    });
    
    it('should reject non-array', () => {
      const result = validateValue('not-array', 'array<string!>!');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].constraint).toBe('type');
    });
    
    it('should validate array length', () => {
      const constraints: TypeConstraints = {
        minItems: 2,
        maxItems: 5
      };
      
      expect(validateValue(['a'], 'array<string!>!', constraints).valid).toBe(false);
      expect(validateValue(['a', 'b'], 'array<string!>!', constraints).valid).toBe(true);
      expect(validateValue(['a', 'b', 'c', 'd', 'e'], 'array<string!>!', constraints).valid).toBe(true);
      expect(validateValue(['a', 'b', 'c', 'd', 'e', 'f'], 'array<string!>!', constraints).valid).toBe(false);
    });
    
    it('should validate array items', () => {
      // Array of required strings
      const result = validateValue(['a', null, 'b'], 'array<string!>!');
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('[1]'))).toBe(true);
    });
    
    it('should allow null items in nullable array', () => {
      const result = validateValue(['a', null, 'b'], 'array<string>!');
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Specialized type validation', () => {
    it('should validate email format', () => {
      expect(validateValue('test@example.com', 'email!').valid).toBe(true);
      expect(validateValue('invalid-email', 'email!').valid).toBe(false);
      expect(validateValue('test@', 'email!').valid).toBe(false);
      expect(validateValue('@example.com', 'email!').valid).toBe(false);
    });
    
    it('should validate URL format', () => {
      expect(validateValue('https://example.com', 'url!').valid).toBe(true);
      expect(validateValue('http://localhost:3000', 'url!').valid).toBe(true);
      expect(validateValue('not-a-url', 'url!').valid).toBe(false);
    });
    
    it('should validate JWT format', () => {
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(validateValue(validJWT, 'jwt!').valid).toBe(true);
      expect(validateValue('invalid-jwt', 'jwt!').valid).toBe(false);
    });
    
    it('should validate datetime format', () => {
      expect(validateValue('2025-11-28T10:30:00Z', 'datetime!').valid).toBe(true);
      expect(validateValue('2025-11-28', 'datetime!').valid).toBe(true);
      expect(validateValue('invalid-date', 'datetime!').valid).toBe(false);
    });
  });
  
  describe('Error messages', () => {
    it('should include field name in error messages', () => {
      const result = validateValue(null, 'string!', undefined, 'username');
      
      expect(result.errors[0].field).toBe('username');
      expect(result.errors[0].message).toContain('username');
    });
    
    it('should include constraint type in errors', () => {
      const result = validateValue('ab', 'string!', { minLength: 3 });
      
      expect(result.errors[0].constraint).toBe('minLength');
    });
    
    it('should provide descriptive error messages', () => {
      const constraints: TypeConstraints = {
        minLength: 3,
        maxLength: 10
      };
      
      const resultMin = validateValue('ab', 'string!', constraints);
      expect(resultMin.errors[0].message).toContain('at least 3');
      
      const resultMax = validateValue('abcdefghijk', 'string!', constraints);
      expect(resultMax.errors[0].message).toContain('at most 10');
    });
  });
});
