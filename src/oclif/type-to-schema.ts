/**
 * Converts a TypeScript type to JSON Schema, for the output half of each
 * command's published contract.
 *
 * The chain a schema has to be true about is:
 *
 *     command implementation  ->  declared result type T  ->  published schema
 *
 * TypeScript already enforces the first link: every command is
 * `BaseCommand<T>` and implements `runCommand(): Promise<T>`. The second link
 * was hand-typed, and it drifted — `RemoteGenerateResult.preserved` was absent
 * from a schema declared `additionalProperties: false`, so a validating agent
 * rejected every `remote:generate` response. Generating the second link closes
 * the chain without any runtime validation.
 *
 * Deliberately narrow. This handles the shapes command results actually use:
 * primitives, arrays, string-literal unions, nullable primitives, nested
 * interfaces, and inline object literals. Anything it cannot represent
 * faithfully becomes an open schema rather than a confident wrong one — and a
 * type too complex to express is a signal about the result type, not a reason
 * to widen this.
 *
 * Refs #139 · ADR-065 · ADR-077
 */

import * as ts from 'typescript';

/** Guards against self-referential types recursing forever. */
const MAX_DEPTH = 12;

export type JsonSchema = Record<string, unknown>;

export function typeToJsonSchema(type: ts.Type, checker: ts.TypeChecker): JsonSchema {
  return convert(type, checker, 0, new Set());
}

function convert(
  type: ts.Type,
  checker: ts.TypeChecker,
  depth: number,
  seen: Set<ts.Type>,
): JsonSchema {
  if (depth > MAX_DEPTH || seen.has(type)) return {};

  // ---- primitives -------------------------------------------------------
  if (type.flags & ts.TypeFlags.String) return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.Null) return { type: 'null' };
  if (type.flags & ts.TypeFlags.Unknown || type.flags & ts.TypeFlags.Any) return {};
  // The bare `object` keyword — TS flags it NonPrimitive, not Object.
  if (type.flags & ts.TypeFlags.NonPrimitive) return { type: 'object' };

  if (type.isStringLiteral()) return { type: 'string', enum: [type.value] };
  if (type.isNumberLiteral()) return { type: 'number', enum: [type.value] };

  if (type.isUnion()) return convertUnion(type, checker, depth, seen);

  // ---- arrays -----------------------------------------------------------
  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type as ts.TypeReference);
    return {
      type: 'array',
      items: element ? convert(element, checker, depth + 1, seen) : {},
    };
  }

  // ---- objects ----------------------------------------------------------
  if (type.flags & ts.TypeFlags.Object) {
    const props = checker.getPropertiesOfType(type);

    // `object`, `Record<string, unknown>`, and friends carry no members we can
    // faithfully enumerate. Say "an object" and stop, rather than inventing a
    // closed shape that would reject valid data.
    if (props.length === 0) return { type: 'object' };

    return convertObject(type, props, checker, depth, seen);
  }

  return {};
}

function convertUnion(
  type: ts.UnionType,
  checker: ts.TypeChecker,
  depth: number,
  seen: Set<ts.Type>,
): JsonSchema {
  // `a?: string` surfaces as `string | undefined`; optionality is carried by
  // `required`, not by the member schema.
  const members = type.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined));
  if (members.length === 1) return convert(members[0], checker, depth, seen);

  // TS models `boolean` as `true | false`.
  if (members.length === 2 && members.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) {
    return { type: 'boolean' };
  }

  // A union of string literals is an enum.
  if (members.every((t) => t.isStringLiteral())) {
    return { type: 'string', enum: members.map((t) => (t as ts.StringLiteralType).value) };
  }

  // `string | null` and similar: a nullable primitive, expressible as a type
  // array. Sorted, because TS does not guarantee union member order and the
  // schemas are under a byte-for-byte drift gate.
  const primitives = members.map(primitiveName);
  if (primitives.every((p): p is string => p !== undefined)) {
    return { type: [...new Set(primitives)].sort() };
  }

  // Anything richer (a union of object shapes) would need oneOf; command
  // results do not use one today, and guessing would be worse than saying
  // nothing.
  return {};
}

function primitiveName(type: ts.Type): string | undefined {
  if (type.flags & ts.TypeFlags.String) return 'string';
  if (type.flags & ts.TypeFlags.Number) return 'number';
  if (type.flags & ts.TypeFlags.Null) return 'null';
  if (type.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) return 'boolean';
  return undefined;
}

function convertObject(
  type: ts.Type,
  props: ts.Symbol[],
  checker: ts.TypeChecker,
  depth: number,
  seen: Set<ts.Type>,
): JsonSchema {
  const nested = new Set(seen);
  nested.add(type);

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const prop of props) {
    const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
    const propType = declaration
      ? checker.getTypeOfSymbolAtLocation(prop, declaration)
      : checker.getDeclaredTypeOfSymbol(prop);

    const schema = convert(propType, checker, depth + 1, nested);

    const description = ts
      .displayPartsToString(prop.getDocumentationComment(checker))
      .trim();
    if (description) schema.description = description;

    properties[prop.name] = schema;
    // getPropertiesOfType flattens inheritance, so a member inherited from
    // MutatingResult lands here alongside the command's own.
    if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(prop.name);
  }

  return {
    type: 'object',
    ...(required.length ? { required } : {}),
    properties,
    // Derived schemas are complete by construction, so closing the object is
    // safe — and it is what makes a future undeclared field fail loudly rather
    // than silently break validating clients.
    additionalProperties: false,
  };
}

// ---------------------------------------------------------------------------
// Resolving a command's declared result type
// ---------------------------------------------------------------------------

/**
 * The `T` in `class X extends BaseCommand<T>`, for the default-exported command
 * class in `file`. Returns undefined for a file that declares no command, or a
 * command with no type argument (`mcp:serve` is `BaseCommand<void>`).
 */
export function resolveCommandResultType(
  file: string,
  program: ts.Program,
): ts.Type | undefined {
  const sourceFile = program.getSourceFile(file);
  if (!sourceFile) return undefined;
  const checker = program.getTypeChecker();

  let result: ts.Type | undefined;

  sourceFile.forEachChild((node) => {
    if (result || !ts.isClassDeclaration(node)) return;
    const isDefaultExport = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
    );
    if (!isDefaultExport) return;

    for (const clause of node.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
      for (const expr of clause.types) {
        const name = ts.isIdentifier(expr.expression) ? expr.expression.text : undefined;
        if (name !== 'BaseCommand') continue;
        const [arg] = expr.typeArguments ?? [];
        if (!arg) return;
        const type = checker.getTypeFromTypeNode(arg);
        if (type.flags & ts.TypeFlags.Void) return;
        result = type;
      }
    }
  });

  return result;
}
