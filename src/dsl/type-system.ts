/**
 * DSL Type System
 * Following REQ-047: Unified Type System
 * 
 * Parses DSL type strings and generates validation code.
 * Supports GraphQL nullability conventions: nullable by default, ! for required.
 */

import { z } from 'zod';

// =============================================================================
// Type Definitions
// =============================================================================

/** Primitive types */
export type PrimitiveType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/** Specialized types (platform-provided) */
export type SpecializedType = 'jwt' | 'datetime' | 'email' | 'url' | 'id' | 'file' | 'element';

/** Type nullability */
export interface TypeNullability {
  nullable: boolean;  // Type itself is nullable
  itemsNullable?: boolean;  // For arrays: whether items can be null
}

/** Parsed type information */
export interface ParsedType {
  /** Base type name */
  baseType: PrimitiveType | SpecializedType | string;
  
  /** Is this an array type? */
  isArray: boolean;
  
  /** Array item type (if isArray) */
  itemType?: ParsedType;
  
  /** Nullability information */
  nullability: TypeNullability;
  
  /** Original type string */
  original: string;
}

/** Type constraints for validation */
export interface TypeConstraints {
  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;  // Regex pattern
  
  // Number constraints
  min?: number;
  max?: number;
  integer?: boolean;
  
  // Array constraints
  minItems?: number;
  maxItems?: number;
  
  // Enum constraints
  values?: string[];
  
  // File constraints
  formats?: string[];
  maxSize?: number;
}

/** Validation result */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  value?: T;
  errors: Array<{
    field: string;
    message: string;
    constraint?: string;
  }>;
}

// =============================================================================
// Type Parsing (REQ-047)
// =============================================================================

/**
 * Parse a DSL type string into structured type information
 * 
 * Examples:
 * - `string` → nullable string
 * - `string!` → required string
 * - `array<User>` → nullable array of nullable User
 * - `array<User!>` → nullable array of required User
 * - `array<User!>!` → required array of required User
 * 
 * @param typeString - DSL type string
 * @returns Parsed type information
 */
export function parseType(typeString: string): ParsedType {
  const original = typeString;
  
  // Check for nullability marker at the end
  const required = typeString.endsWith('!');
  if (required) {
    typeString = typeString.slice(0, -1);
  }
  
  // Check for array type
  const arrayMatch = typeString.match(/^array<(.+)>$/);
  
  if (arrayMatch) {
    // Array type
    const itemTypeString = arrayMatch[1];
    const itemType = parseType(itemTypeString);
    
    return {
      baseType: 'array',
      isArray: true,
      itemType,
      nullability: {
        nullable: !required,
        itemsNullable: itemType.nullability.nullable
      },
      original
    };
  }
  
  // Simple type (primitive, specialized, or custom)
  return {
    baseType: typeString as PrimitiveType | SpecializedType,
    isArray: false,
    nullability: {
      nullable: !required
    },
    original
  };
}

/**
 * Check if a type is a primitive
 */
export function isPrimitive(type: string): type is PrimitiveType {
  return ['string', 'number', 'boolean', 'object', 'array'].includes(type);
}

/**
 * Check if a type is a specialized type
 */
export function isSpecialized(type: string): type is SpecializedType {
  return ['jwt', 'datetime', 'email', 'url', 'id', 'file', 'element'].includes(type);
}

// =============================================================================
// GraphQL Schema Generation (REQ-047)
// =============================================================================

/**
 * Convert DSL type to GraphQL type string
 * 
 * @param parsedType - Parsed DSL type
 * @returns GraphQL type string
 */
export function toGraphQLType(parsedType: ParsedType): string {
  if (parsedType.isArray && parsedType.itemType) {
    const itemTypeStr = toGraphQLType(parsedType.itemType);
    const arrayType = `[${itemTypeStr}]`;
    return parsedType.nullability.nullable ? arrayType : `${arrayType}!`;
  }
  
  let graphQLType = mapToGraphQLScalar(parsedType.baseType);
  
  // Add non-null marker if required
  if (!parsedType.nullability.nullable) {
    graphQLType += '!';
  }
  
  return graphQLType;
}

/**
 * Map DSL type to GraphQL scalar type
 */
function mapToGraphQLScalar(type: string): string {
  const mapping: Record<string, string> = {
    // Primitives
    string: 'String',
    number: 'Float',
    boolean: 'Boolean',
    object: 'JSON',
    
    // Specialized types → GraphQL scalars
    jwt: 'String',
    datetime: 'String',  // ISO 8601 string
    email: 'String',
    url: 'String',
    id: 'ID',
    file: 'Upload',
    element: 'String'  // Serialized HTML/JSX
  };
  
  return mapping[type] || type;  // Custom types pass through
}

// =============================================================================
// TypeScript Type Generation (REQ-047)
// =============================================================================

/**
 * Convert DSL type to TypeScript type string
 * 
 * @param parsedType - Parsed DSL type
 * @returns TypeScript type string
 */
export function toTypeScriptType(parsedType: ParsedType): string {
  if (parsedType.isArray && parsedType.itemType) {
    const itemTypeStr = toTypeScriptType(parsedType.itemType);
    const arrayType = `Array<${itemTypeStr}>`;
    return parsedType.nullability.nullable ? `${arrayType} | null` : arrayType;
  }
  
  let tsType = mapToTypeScriptType(parsedType.baseType);
  
  // Add null union if nullable
  if (parsedType.nullability.nullable) {
    tsType += ' | null';
  }
  
  return tsType;
}

/**
 * Map DSL type to TypeScript type
 */
function mapToTypeScriptType(type: string): string {
  const mapping: Record<string, string> = {
    // Primitives
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'Record<string, unknown>',
    
    // Specialized types
    jwt: 'string',
    datetime: 'string',  // ISO 8601 string
    email: 'string',
    url: 'string',
    id: 'string',
    file: 'File',
    element: 'HTMLElement | React.ReactElement'
  };
  
  return mapping[type] || type;  // Custom types pass through
}

// =============================================================================
// Python Type Generation (REQ-047)
// =============================================================================

/**
 * Convert DSL type to Python type hint string
 * 
 * @param parsedType - Parsed DSL type
 * @returns Python type hint string
 */
export function toPythonType(parsedType: ParsedType): string {
  if (parsedType.isArray && parsedType.itemType) {
    const itemTypeStr = toPythonType(parsedType.itemType);
    const arrayType = `List[${itemTypeStr}]`;
    return parsedType.nullability.nullable ? `Optional[${arrayType}]` : arrayType;
  }
  
  let pythonType = mapToPythonType(parsedType.baseType);
  
  // Add Optional if nullable
  if (parsedType.nullability.nullable) {
    pythonType = `Optional[${pythonType}]`;
  }
  
  return pythonType;
}

/**
 * Map DSL type to Python type
 */
function mapToPythonType(type: string): string {
  const mapping: Record<string, string> = {
    // Primitives
    string: 'str',
    number: 'float',
    boolean: 'bool',
    object: 'Dict[str, Any]',
    
    // Specialized types
    jwt: 'str',
    datetime: 'str',  // ISO 8601 string
    email: 'str',
    url: 'str',
    id: 'str',
    file: 'BinaryIO',
    element: 'str'
  };
  
  return mapping[type] || type;  // Custom types pass through
}

// =============================================================================
// Zod Schema Generation (REQ-047)
// =============================================================================

/**
 * Generate Zod schema code for a DSL type with constraints
 * 
 * @param fieldName - Field name for error messages
 * @param parsedType - Parsed DSL type
 * @param constraints - Validation constraints
 * @returns Zod schema code string
 */
export function generateZodSchema(
  fieldName: string,
  parsedType: ParsedType,
  constraints?: TypeConstraints
): string {
  let schema: string;
  
  if (parsedType.isArray && parsedType.itemType) {
    // Array type
    const itemSchema = generateZodSchema(`${fieldName}Item`, parsedType.itemType, constraints);
    schema = `z.array(${itemSchema})`;
    
    // Array constraints
    if (constraints?.minItems !== undefined) {
      schema += `.min(${constraints.minItems}, '${fieldName} must have at least ${constraints.minItems} items')`;
    }
    if (constraints?.maxItems !== undefined) {
      schema += `.max(${constraints.maxItems}, '${fieldName} must have at most ${constraints.maxItems} items')`;
    }
  } else {
    // Simple type
    schema = getBaseZodSchema(parsedType.baseType, fieldName, constraints);
  }
  
  // Nullability
  if (parsedType.nullability.nullable) {
    schema += '.nullable()';
  }
  
  return schema;
}

/**
 * Get base Zod schema for a type
 */
function getBaseZodSchema(type: string, fieldName: string, constraints?: TypeConstraints): string {
  switch (type) {
    case 'string':
    case 'jwt':
    case 'email':
    case 'url':
    case 'id':
    case 'datetime':
      let stringSchema = 'z.string()';
      
      if (constraints?.minLength !== undefined) {
        stringSchema += `.min(${constraints.minLength}, '${fieldName} must be at least ${constraints.minLength} characters')`;
      }
      if (constraints?.maxLength !== undefined) {
        stringSchema += `.max(${constraints.maxLength}, '${fieldName} must be at most ${constraints.maxLength} characters')`;
      }
      if (constraints?.pattern) {
        const escapedPattern = constraints.pattern.replace(/'/g, "\\'");
        stringSchema += `.regex(/${constraints.pattern}/, '${fieldName} must match pattern ${escapedPattern}')`;
      }
      
      // Specialized type refinements
      if (type === 'email') {
        stringSchema += `.email('${fieldName} must be a valid email')`;
      }
      if (type === 'url') {
        stringSchema += `.url('${fieldName} must be a valid URL')`;
      }
      if (type === 'jwt') {
        // JWT format validation (simplified)
        stringSchema += `.regex(/^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+$/, '${fieldName} must be a valid JWT')`;
      }
      if (type === 'datetime') {
        // ISO 8601 datetime
        stringSchema += `.datetime('${fieldName} must be a valid ISO 8601 datetime')`;
      }
      
      return stringSchema;
    
    case 'number':
      let numberSchema = 'z.number()';
      
      if (constraints?.integer) {
        numberSchema += `.int('${fieldName} must be an integer')`;
      }
      if (constraints?.min !== undefined) {
        numberSchema += `.min(${constraints.min}, '${fieldName} must be at least ${constraints.min}')`;
      }
      if (constraints?.max !== undefined) {
        numberSchema += `.max(${constraints.max}, '${fieldName} must be at most ${constraints.max}')`;
      }
      
      return numberSchema;
    
    case 'boolean':
      return 'z.boolean()';
    
    case 'object':
      return 'z.record(z.unknown())';
    
    case 'file':
      // File validation
      let fileSchema = 'z.instanceof(File)';
      if (constraints?.maxSize) {
        fileSchema += `.refine(f => f.size <= ${constraints.maxSize}, '${fieldName} must be at most ${constraints.maxSize} bytes')`;
      }
      if (constraints?.formats && constraints.formats.length > 0) {
        const formatsStr = constraints.formats.map(f => `'${f}'`).join(', ');
        fileSchema += `.refine(f => [${formatsStr}].some(fmt => f.type.includes(fmt)), '${fieldName} must be one of: ${constraints.formats.join(', ')}')`;
      }
      return fileSchema;
    
    case 'element':
      return 'z.unknown()';  // Runtime element validation is complex
    
    default:
      // Custom type or unknown - use unknown
      return 'z.unknown()';
  }
}

// =============================================================================
// Runtime Validation (REQ-047)
// =============================================================================

/**
 * Validate a value against a DSL type and constraints
 * 
 * @param value - Value to validate
 * @param typeString - DSL type string
 * @param constraints - Validation constraints
 * @param fieldName - Field name for error messages
 * @returns Validation result
 */
export function validateValue(
  value: unknown,
  typeString: string,
  constraints?: TypeConstraints,
  fieldName: string = 'value'
): ValidationResult {
  const parsedType = parseType(typeString);
  const errors: ValidationResult['errors'] = [];
  
  // Null check
  if (value === null || value === undefined) {
    if (!parsedType.nullability.nullable) {
      errors.push({
        field: fieldName,
        message: `${fieldName} is required`,
        constraint: 'required'
      });
    }
    return { valid: errors.length === 0, value, errors };
  }
  
  // Array type
  if (parsedType.isArray) {
    if (!Array.isArray(value)) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must be an array`,
        constraint: 'type'
      });
      return { valid: false, errors };
    }
    
    // Array length constraints
    if (constraints?.minItems !== undefined && value.length < constraints.minItems) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have at least ${constraints.minItems} items`,
        constraint: 'minItems'
      });
    }
    if (constraints?.maxItems !== undefined && value.length > constraints.maxItems) {
      errors.push({
        field: fieldName,
        message: `${fieldName} must have at most ${constraints.maxItems} items`,
        constraint: 'maxItems'
      });
    }
    
    // Validate each item
    if (parsedType.itemType) {
      value.forEach((item, index) => {
        const itemResult = validateValue(item, parsedType.itemType!.original, constraints, `${fieldName}[${index}]`);
        errors.push(...itemResult.errors);
      });
    }
    
    return { valid: errors.length === 0, value, errors };
  }
  
  // Simple type validation
  const typeErrors = validateSimpleType(value, parsedType.baseType, constraints, fieldName);
  errors.push(...typeErrors);
  
  return { valid: errors.length === 0, value, errors };
}

/**
 * Validate a simple (non-array) type
 */
function validateSimpleType(
  value: unknown,
  type: string,
  constraints?: TypeConstraints,
  fieldName: string = 'value'
): ValidationResult['errors'] {
  const errors: ValidationResult['errors'] = [];
  
  switch (type) {
    case 'string':
    case 'jwt':
    case 'email':
    case 'url':
    case 'id':
    case 'datetime':
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: `${fieldName} must be a string`, constraint: 'type' });
        return errors;
      }
      
      if (constraints?.minLength !== undefined && value.length < constraints.minLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at least ${constraints.minLength} characters`,
          constraint: 'minLength'
        });
      }
      if (constraints?.maxLength !== undefined && value.length > constraints.maxLength) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at most ${constraints.maxLength} characters`,
          constraint: 'maxLength'
        });
      }
      if (constraints?.pattern && !new RegExp(constraints.pattern).test(value)) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must match pattern ${constraints.pattern}`,
          constraint: 'pattern'
        });
      }
      
      // Specialized type validation
      if (type === 'email' && !isValidEmail(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a valid email`, constraint: 'format' });
      }
      if (type === 'url' && !isValidUrl(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a valid URL`, constraint: 'format' });
      }
      if (type === 'jwt' && !isValidJWT(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a valid JWT`, constraint: 'format' });
      }
      if (type === 'datetime' && !isValidDatetime(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be a valid ISO 8601 datetime`, constraint: 'format' });
      }
      
      break;
    
    case 'number':
      if (typeof value !== 'number') {
        errors.push({ field: fieldName, message: `${fieldName} must be a number`, constraint: 'type' });
        return errors;
      }
      
      if (constraints?.integer && !Number.isInteger(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be an integer`, constraint: 'integer' });
      }
      if (constraints?.min !== undefined && value < constraints.min) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at least ${constraints.min}`,
          constraint: 'min'
        });
      }
      if (constraints?.max !== undefined && value > constraints.max) {
        errors.push({
          field: fieldName,
          message: `${fieldName} must be at most ${constraints.max}`,
          constraint: 'max'
        });
      }
      
      break;
    
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ field: fieldName, message: `${fieldName} must be a boolean`, constraint: 'type' });
      }
      break;
    
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ field: fieldName, message: `${fieldName} must be an object`, constraint: 'type' });
      }
      break;
  }
  
  return errors;
}

// =============================================================================
// Format Validators
// =============================================================================

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidJWT(value: string): boolean {
  return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value);
}

function isValidDatetime(value: string): boolean {
  return !isNaN(Date.parse(value));
}
