# ADR-067: Inter-Hook Communication with TypeScript Code Generation

**Status**: Proposed  
**Date**: 2025-12-11  
**Related**: REQ-LIFECYCLE-004

## Context

Hooks communicate via implicit context mutation. No contract exists for what data hooks produce/consume, leading to:

- Runtime errors (missing expected context fields)
- Type safety issues (data type mismatches)
- Coupling (hooks assume context shape)
- Debugging difficulty (unclear data flow)

**Example**: Validation hook sets `context.validationResult`, logging hook reads it. No compile-time check ensures field exists or has correct type.

## Decision

Implement **typed inputs/outputs** with **namespaced storage** and **TypeScript code generation**.

### Design

#### 1. DSL: Typed Outputs

```yaml
lifecycle:
  before:
    - validateInput:
        handler: checkSchema
        outputs:
          - name: validationResult
            type: boolean
            required: true
          - name: errors
            type: array
            required: false
```

#### 2. DSL: Typed Inputs with References

```yaml
lifecycle:
  before:
    - validateInput:
        handler: checkSchema
        outputs:
          - name: validationResult
            type: boolean
            required: true
          - name: errors
            type: array<string>
            required: false

    - logValidation:
        handler: logResult
        inputs:
          - name: result
            from: validationResult # Links to previous output
            required: true
          - name: validationErrors
            from: errors
            required: false
```

**Resolution Rules**:

- `from: outputName` → Immediately previous hook's output
- `from: hookName.outputName` → Explicit hook reference (namespaced)

#### 3. Namespace by Hook Name

```yaml
lifecycle:
  before:
    - hookA:
        handler: validateSchema
        outputs:
          - name: result
            type: boolean

    - hookB:
        handler: validateBusiness
        outputs:
          - name: result
            type: boolean

    - hookC:
        handler: logResults
        inputs:
          - name: schemaResult
            from: hookA.result # Explicit namespace
          - name: businessResult
            from: hookB.result
```

**Conflict Resolution**:

- **Warn** if two hooks produce same output name without explicit qualification
- Store outputs namespaced: `context.hookOutputs[hookName][outputName]`

#### 4. Type System

**Supported Types**:

- Primitives: `string`, `number`, `boolean`, `null`
- Structures: `array`, `object`
- Generic arrays: `array<string>`, `array<number>`, `array<object>`
- Union types: `string | null`, `boolean | undefined`

**Type Mapping to TypeScript**:

```yaml
# DSL type → TypeScript type
string        → string
number        → number
boolean       → boolean
null          → null
array         → any[]
array<string> → string[]
object        → Record<string, unknown>
string | null → string | null
```

#### 5. TypeScript Code Generation

**Generated Interfaces** (`src/generated/interfaces.ts`):

```typescript
// From DSL: validateInput hook
export interface ValidateInputOutputs {
  validationResult: boolean; // required: true
  errors?: string[]; // required: false, array<string>
}

// From DSL: logValidation hook
export interface LogValidationInputs {
  result: boolean; // from: validationResult
  validationErrors?: string[]; // from: errors
}

// Handler signature
export type ValidateInputHandler = (context: Context) => Promise<ValidateInputOutputs>;

export type LogValidationHandler = (context: Context, inputs: LogValidationInputs) => Promise<void>;
```

**MFE Class Integration**:

```typescript
// Generated base class (extends BaseMFE)
import { ValidateInputOutputs, LogValidationInputs } from './generated/interfaces';

export abstract class GeneratedMFEBase extends BaseMFE {
  // Abstract methods for handlers with typed signatures
  abstract checkSchema(context: Context): Promise<ValidateInputOutputs>;
  abstract logResult(context: Context, inputs: LogValidationInputs): Promise<void>;
}

// User implementation
export class MyMFE extends GeneratedMFEBase {
  async checkSchema(context: Context): Promise<ValidateInputOutputs> {
    const errors: string[] = [];

    if (!context.inputs.email) {
      errors.push('Email required');
    }

    return {
      validationResult: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined, // Optional, can omit
    };
  }

  async logResult(context: Context, inputs: LogValidationInputs): Promise<void> {
    // TypeScript ensures 'result' exists and is boolean
    console.log('Valid:', inputs.result);

    // TypeScript allows optional access
    if (inputs.validationErrors) {
      console.log('Errors:', inputs.validationErrors);
    }
  }
}
```

#### 6. Runtime Storage and Validation

```typescript
// In BaseMFE.executeHook()
protected async executeHook(
  hookName: string,
  hookConfig: LifecycleHook,
  context: Context,
  phase: string
): Promise<void> {
  // Resolve inputs from previous hook outputs
  const inputs = hookConfig.inputs
    ? this.resolveInputs(hookConfig.inputs, context)
    : undefined;

  // Validate inputs match schema
  if (inputs && hookConfig.inputs) {
    this.validateInputSchema(inputs, hookConfig.inputs);
  }

  // Invoke handler
  const outputs = await this.invokeHandler(
    hookConfig.handler,
    context,
    inputs
  );

  // Validate outputs match schema
  if (outputs && hookConfig.outputs) {
    this.validateOutputSchema(outputs, hookConfig.outputs);
  }

  // Store outputs namespaced by hook name
  context.hookOutputs = context.hookOutputs || {};
  context.hookOutputs[hookName] = outputs;
}

private resolveInputs(
  inputConfigs: InputConfig[],
  context: Context
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  for (const inputConfig of inputConfigs) {
    // Parse 'from' reference
    const [hookName, outputName] = this.parseReference(inputConfig.from);

    // Resolve from context.hookOutputs
    const value = context.hookOutputs?.[hookName]?.[outputName];

    // Validate required inputs
    if (value === undefined && inputConfig.required) {
      throw new Error(
        `Required input '${inputConfig.name}' not found ` +
        `(from: ${inputConfig.from})`
      );
    }

    inputs[inputConfig.name] = value;
  }

  return inputs;
}

private parseReference(from: string): [string, string] {
  // Parse 'hookName.outputName' or 'outputName'
  const parts = from.split('.');
  if (parts.length === 2) {
    return [parts[0], parts[1]];  // Explicit: hookA.result
  } else {
    // Implicit: previous hook
    return [this._previousHookName, parts[0]];
  }
}

private validateOutputSchema(
  outputs: Record<string, unknown>,
  schema: OutputConfig[]
): void {
  for (const outputConfig of schema) {
    const value = outputs[outputConfig.name];

    // Check required
    if (value === undefined && outputConfig.required) {
      throw new Error(`Required output '${outputConfig.name}' missing`);
    }

    // Check type
    if (value !== undefined) {
      const actualType = this.getType(value);
      if (!this.isTypeCompatible(actualType, outputConfig.type)) {
        throw new Error(
          `Output '${outputConfig.name}' type mismatch: ` +
          `expected ${outputConfig.type}, got ${actualType}`
        );
      }
    }
  }
}
```

#### 7. Code Generation Tool

**CLI Command**: `mfe generate-types <manifest>`

```typescript
// src/codegen/type-generator.ts
export class TypeGenerator {
  generateInterfaces(manifest: Manifest): string {
    let code = '// Auto-generated TypeScript interfaces\n\n';

    for (const capability of manifest.capabilities) {
      for (const hook of this.getAllHooks(capability)) {
        // Generate output interface
        if (hook.outputs) {
          code += this.generateOutputInterface(hook);
        }

        // Generate input interface
        if (hook.inputs) {
          code += this.generateInputInterface(hook);
        }

        // Generate handler type
        code += this.generateHandlerType(hook);
      }
    }

    return code;
  }

  private generateOutputInterface(hook: Hook): string {
    const interfaceName = this.toInterfaceName(hook.name) + 'Outputs';

    let code = `export interface ${interfaceName} {\n`;
    for (const output of hook.outputs) {
      const optional = output.required ? '' : '?';
      const tsType = this.mapType(output.type);
      code += `  ${output.name}${optional}: ${tsType};\n`;
    }
    code += '}\n\n';

    return code;
  }

  private mapType(dslType: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
      null: 'null',
      array: 'any[]',
      object: 'Record<string, unknown>',
    };

    // Handle generic arrays: array<string> → string[]
    const genericMatch = dslType.match(/array<(.+)>/);
    if (genericMatch) {
      return `${this.mapType(genericMatch[1])}[]`;
    }

    // Handle union types: string | null
    if (dslType.includes('|')) {
      return dslType
        .split('|')
        .map((t) => this.mapType(t.trim()))
        .join(' | ');
    }

    return typeMap[dslType] || 'unknown';
  }
}
```

#### 8. Circular Dependency Detection

**Manifest Validation** (build-time check):

```typescript
// src/dsl/validator.ts
export class DependencyGraphValidator {
  validateDependencies(manifest: Manifest): void {
    for (const capability of manifest.capabilities) {
      const graph = this.buildDependencyGraph(capability);
      const cycles = this.detectCycles(graph);

      if (cycles.length > 0) {
        throw new ManifestValidationError(
          `Circular dependencies detected:\n` +
            cycles.map((cycle) => `  ${cycle.join(' → ')}`).join('\n')
        );
      }
    }
  }

  private buildDependencyGraph(capability: Capability): Graph {
    const graph = new Map<string, Set<string>>();

    for (const hook of this.getAllHooks(capability)) {
      graph.set(hook.name, new Set());

      if (hook.inputs) {
        for (const input of hook.inputs) {
          const [dependencyHook] = this.parseReference(input.from);
          graph.get(hook.name)!.add(dependencyHook);
        }
      }
    }

    return graph;
  }

  private detectCycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      for (const neighbor of graph.get(node) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, path);
        } else if (recursionStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }
}
```

#### 9. Scope Limitation: Within Capability Only

Inter-hook communication works **within capability only**:

```yaml
capabilities:
  - load:
      lifecycle:
        before:
          - validate:
              outputs: [result]
        after:
          - logLoad:
              inputs:
                - from: result # ❌ ERROR: before output not visible in after
```

**Cross-phase communication** uses `context.outputs` (implicit, untyped):

```typescript
// Before phase
context.outputs = { processedData: {...} };

// After phase
const data = context.outputs.processedData;
```

## Consequences

### Positive

✅ **Type Safety**: Compile-time checks for data flow  
✅ **Clarity**: Explicit dependencies visible in manifest  
✅ **Maintainability**: Refactoring detects broken contracts  
✅ **Documentation**: Auto-generated interfaces serve as API docs  
✅ **IDE Support**: Autocomplete for inputs/outputs

### Negative

❌ **Complexity**: Code generation adds build step  
❌ **Migration**: Existing MFEs need to add type annotations  
❌ **Scope Limitation**: Inter-phase communication remains untyped  
❌ **Build Dependency**: Requires TypeScript toolchain

### Trade-offs

- **Chosen**: TypeScript code generation (strong typing)
- **Rejected**: Duck typing (no compile-time checks)
- **Rejected**: JSON Schema only (no IDE support)

## Alternatives Considered

### 1. Duck Typing (No Code Generation)

```yaml
outputs:
  - validationResult # Type inferred at runtime
```

**Rejected**: No compile-time safety, harder to maintain.

### 2. JSON Schema Validation Only

Use JSON Schema for runtime validation, no TypeScript generation.

**Rejected**: No IDE autocomplete, no compile-time checks.

### 3. Cross-Phase Typed Communication

Allow typed inputs/outputs across phases.

**Rejected**: Too complex for v1, violates phase isolation principle.

## Implementation Notes

- Install: `ts-morph` for TypeScript AST manipulation
- Generate interfaces during `mfe remote <name>` command
- Store generated code in `src/generated/interfaces.ts`
- Add `npm run generate-types` script for re-generation
- Integrate with `mfe validate-manifest` for dependency checks

## Testing Strategy

- [ ] Unit test: Output interface generation
- [ ] Unit test: Input interface generation
- [ ] Unit test: Handler type generation
- [ ] Unit test: Type mapping (primitives, arrays, unions)
- [ ] Unit test: Namespace resolution
- [ ] Unit test: Required vs. optional fields
- [ ] Unit test: Runtime validation
- [ ] Unit test: Circular dependency detection
- [ ] Integration test: Full lifecycle with typed communication
- [ ] Integration test: TypeScript compilation of generated code

## Success Metrics

- [ ] 100% of hook inputs/outputs typed
- [ ] Zero runtime type errors in production
- [ ] 50% reduction in "undefined is not an object" errors
- [ ] 100% IDE autocomplete coverage for inputs/outputs

## Related Documents

- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- [REQ-LIFECYCLE-004](../requirements/lifecycle-enhancements.md#req-lifecycle-004)

---

**Status**: Proposed  
**Decision Makers**: Platform Team  
**Next Steps**: Implement type generator, integrate with CLI, update templates
