# ADR-066: Conditional Execution with Jexl Expression Engine

**Status**: Proposed  
**Date**: 2025-12-11  
**Related**: REQ-LIFECYCLE-003

## Context

Hooks always execute unless they fail and are marked `contained`. No mechanism exists to conditionally skip hooks based on runtime state, leading to:
- Unnecessary execution (auth check when no JWT present)
- Wasted resources (cache lookup when caching disabled)
- Complex handler logic (handlers check conditions internally)

**Example**: E-commerce recommender always loads user profile, even for anonymous users. This wastes 200ms and a database query on every anonymous page load.

## Decision

Implement **conditional execution** using **Jexl** (JavaScript Expression Language) for safe, sandboxed expression evaluation.

### Design

#### 1. Simple Expressions

```yaml
lifecycle:
  before:
    - checkAuth:
        handler: platform.auth
        when: "context.jwt != null"
        
    - validateAdmin:
        handler: checkAdminRole
        when: "context.user?.roles?.includes('admin')"
```

#### 2. Complex Boolean Logic

```yaml
lifecycle:
  before:
    - complexCondition:
        handler: advancedCheck
        when:
          or:
            - and:
                - "context.user.role == 'admin'"
                - "context.inputs.amount > 10000"
            - "context.emergencyOverride == true"
```

### Expression Language: Jexl

**Why Jexl?**
- ✅ Battle-tested (10M+ downloads/month)
- ✅ Sandboxed (no eval, no code injection)
- ✅ Familiar syntax (JavaScript-like)
- ✅ Compile-time validation
- ✅ Optional chaining support

**Supported Operators**:
- Comparison: `==`, `!=`, `>`, `<`, `>=`, `<=`
- Logical: `&&`, `||`, `!`
- Ternary: `condition ? true : false`

**Supported Functions**:
```javascript
// Built-in Jexl transforms
"array|length > 0"
"string|upper == 'ADMIN'"
"date|dateFormat('YYYY-MM-DD')"

// Custom transforms (added by us)
"context.user.roles|includes('admin')"
"context.inputs.email|matches('^[a-z]+@[a-z]+\\.[a-z]+$')"
"context.config.featureFlag|startsWith('enable_')"
```

**Available Context**:
- `context.*`: Full context object
- `env.*`: Process environment variables
- `manifest.*`: MFE manifest properties

### Implementation Pattern

```typescript
import jexl from 'jexl';

// src/runtime/condition-evaluator.ts
export class ConditionEvaluator {
  private jexl: Jexl;
  private compiledCache: Map<string, CompiledExpression>;
  
  constructor() {
    this.jexl = new Jexl();
    this.compiledCache = new Map();
    
    // Add custom transforms
    this.jexl.addTransform('includes', (array: any[], value: any) => {
      return Array.isArray(array) && array.includes(value);
    });
    
    this.jexl.addTransform('matches', (str: string, pattern: string) => {
      return new RegExp(pattern).test(str);
    });
    
    this.jexl.addTransform('startsWith', (str: string, prefix: string) => {
      return typeof str === 'string' && str.startsWith(prefix);
    });
    
    this.jexl.addTransform('endsWith', (str: string, suffix: string) => {
      return typeof str === 'string' && str.endsWith(suffix);
    });
  }
  
  async evaluateCondition(
    condition: string | ConditionObject,
    evaluationContext: { context: Context, env: any, manifest: any }
  ): Promise<boolean> {
    if (typeof condition === 'string') {
      return this.evaluateExpression(condition, evaluationContext);
    } else {
      return this.evaluateBooleanLogic(condition, evaluationContext);
    }
  }
  
  private async evaluateExpression(
    expression: string,
    evaluationContext: any
  ): Promise<boolean> {
    try {
      // Use compiled expression from cache
      let compiled = this.compiledCache.get(expression);
      if (!compiled) {
        compiled = this.jexl.compile(expression);
        this.compiledCache.set(expression, compiled);
      }
      
      const result = await compiled.eval(evaluationContext);
      return Boolean(result);
    } catch (error) {
      console.error(`Condition evaluation error: ${expression}`, error);
      return false;  // Treat errors as false
    }
  }
  
  private async evaluateBooleanLogic(
    condition: ConditionObject,
    evaluationContext: any
  ): Promise<boolean> {
    if ('and' in condition) {
      // All conditions must be true
      const results = await Promise.all(
        condition.and.map(c => this.evaluateCondition(c, evaluationContext))
      );
      return results.every(r => r === true);
    }
    
    if ('or' in condition) {
      // At least one condition must be true
      const results = await Promise.all(
        condition.or.map(c => this.evaluateCondition(c, evaluationContext))
      );
      return results.some(r => r === true);
    }
    
    if ('not' in condition) {
      // Invert condition
      return !(await this.evaluateCondition(condition.not, evaluationContext));
    }
    
    return false;
  }
  
  // Validate expression at manifest parse time
  validateExpression(expression: string): { valid: boolean, error?: string } {
    try {
      this.jexl.compile(expression);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

### Integration with Lifecycle Engine

```typescript
// In BaseMFE.executeLifecycle()
protected async executeHook(
  hookName: string,
  hookConfig: LifecycleHook,
  context: Context,
  phase: string
): Promise<void> {
  // Evaluate condition if present
  if (hookConfig.when) {
    const evaluationContext = {
      context,
      env: process.env,
      manifest: this.manifest
    };
    
    const shouldExecute = await this.conditionEvaluator.evaluateCondition(
      hookConfig.when,
      evaluationContext
    );
    
    if (!shouldExecute) {
      // Skip handler
      if (hookConfig.debugCondition) {
        console.debug(
          `[DEBUG] Condition '${JSON.stringify(hookConfig.when)}' evaluated to false. ` +
          `Handler '${hookName}' skipped.`
        );
      }
      
      // Emit telemetry
      await this.emitConditionSkipped(hookName, hookConfig, context);
      return;
    }
  }
  
  // Execute handler
  await this.invokeHandler(hookConfig.handler, context);
}
```

### Debugging Support

```yaml
lifecycle:
  before:
    - validateAdmin:
        handler: checkAdminRole
        when: "context.user?.roles?.includes('admin')"
        debugCondition: true  # Enable verbose logging
```

**Debug Output**:
```
[DEBUG] Condition 'context.user?.roles?.includes('admin')' evaluated to false
  Evaluation context:
    - context.user.roles = ['user', 'viewer']
    - includes('admin') = false
  Result: Skip handler 'checkAdminRole'
```

### Manifest Validation

```typescript
// During manifest parsing
const validator = new ManifestValidator();

for (const capability of manifest.capabilities) {
  for (const phase of ['before', 'main', 'after', 'error']) {
    for (const hook of capability.lifecycle[phase] || []) {
      if (hook.when) {
        const validation = conditionEvaluator.validateExpression(
          typeof hook.when === 'string' ? hook.when : JSON.stringify(hook.when)
        );
        
        if (!validation.valid) {
          throw new ManifestValidationError(
            `Invalid condition in hook '${hook.name}': ${validation.error}`
          );
        }
      }
    }
  }
}
```

## Consequences

### Positive

✅ **Performance**: Skip unnecessary operations (200ms saved per skipped handler)  
✅ **Clarity**: Business rules visible in manifest  
✅ **Flexibility**: Dynamic behavior without code changes  
✅ **Safety**: Sandboxed execution, no code injection  
✅ **Maintainability**: Expression errors caught at manifest parse time

### Negative

❌ **Learning Curve**: Developers must learn Jexl syntax  
❌ **Debugging**: Complex expressions can be hard to trace  
❌ **Performance**: Expression evaluation adds ~1ms overhead

### Trade-offs

- **Chosen**: Jexl (battle-tested, safe, familiar)
- **Rejected**: Custom DSL (reinventing wheel)
- **Rejected**: JavaScript eval (security risk)
- **Rejected**: JSONPath (less expressive)

## Alternatives Considered

### 1. Custom DSL

```yaml
when:
  field: context.user.role
  operator: equals
  value: admin
```

**Rejected**: Less expressive than Jexl, more verbose, need to build parser.

### 2. JavaScript eval()

```yaml
when: eval("context.user.role === 'admin'")
```

**Rejected**: Security risk (code injection), no compile-time validation.

### 3. JSONPath

```yaml
when: "$.context.user.roles[?(@=='admin')]"
```

**Rejected**: Less familiar syntax, harder to express complex logic.

### 4. JSONata

Similar to Jexl but more focused on JSON transformation.

**Rejected**: Jexl has larger community, simpler for boolean expressions.

## Implementation Notes

- Install: `npm install jexl`
- Store compiled expressions in cache (manifest-level cache)
- Validate all expressions during manifest parsing
- Add custom transforms for common patterns
- Document Jexl syntax in user guide

## Testing Strategy

- [ ] Unit test: Simple expression evaluation
- [ ] Unit test: Complex boolean logic (and/or/not)
- [ ] Unit test: Optional chaining (`?.`)
- [ ] Unit test: Custom transforms (includes, matches, etc.)
- [ ] Unit test: Environment variable access
- [ ] Unit test: Manifest property access
- [ ] Unit test: Expression validation at parse time
- [ ] Unit test: Invalid expression handling
- [ ] Unit test: Debug mode logging
- [ ] Performance test: Expression evaluation < 1ms
- [ ] Integration test: Conditional + timeout
- [ ] Integration test: Conditional + parallel execution

## Success Metrics

- [ ] Expression evaluation < 1ms
- [ ] 100% of expressions validated at manifest parse time
- [ ] Zero code injection vulnerabilities
- [ ] 30% reduction in unnecessary handler execution

## Related Documents

- [Lifecycle Engine Analysis](../lifecycle-engine-analysis.md)
- [REQ-LIFECYCLE-003](../requirements/lifecycle-enhancements.md#req-lifecycle-003)
- [Jexl Documentation](https://github.com/TomFrost/Jexl)

---

**Status**: Proposed  
**Decision Makers**: Platform Team  
**Next Steps**: Install Jexl, implement condition evaluator, add validation
