/**
 * Lifecycle Executor Tests
 * Testing REQ-042, REQ-043, REQ-044, REQ-045 (Lifecycle Hook Execution)
 * Testing REQ-054 (BaseMFE Abstract Class)
 * Testing REQ-055 (Context Object)
 * Testing REQ-056 (State Machine)
 */

import { BaseMFE, type Context, type LoadResult, type RenderResult, type HealthResult, type DescribeResult, type SchemaResult, type QueryResult, type EmitResult } from '../../runtime/base-mfe';
import type { DSLManifest } from '../schema';

// =============================================================================
// Test MFE Implementation
// =============================================================================

/**
 * Concrete MFE for testing
 * Implements all abstract methods with simple behavior
 */
class TestMFE extends BaseMFE {
  // Track method calls for assertions
  public callLog: Array<{ method: string; context: Context }> = [];
  
  // Custom handlers for testing
  private customHandlerCalled = false;
  private anotherHandlerCalled = false;
  
  protected async doLoad(context: Context): Promise<LoadResult> {
    this.callLog.push({ method: 'doLoad', context });
    return {
      status: 'loaded',
      timestamp: new Date()
    };
  }
  
  protected async doRender(context: Context): Promise<RenderResult> {
    this.callLog.push({ method: 'doRender', context });
    return {
      status: 'rendered',
      timestamp: new Date()
    };
  }
  
  protected async doRefresh(context: Context): Promise<void> {
    this.callLog.push({ method: 'doRefresh', context });
  }
  
  protected async doAuthorizeAccess(context: Context): Promise<boolean> {
    this.callLog.push({ method: 'doAuthorizeAccess', context });
    return true;
  }
  
  protected async doHealth(context: Context): Promise<HealthResult> {
    this.callLog.push({ method: 'doHealth', context });
    return {
      status: 'healthy',
      checks: [{ name: 'test', status: 'pass' }],
      timestamp: new Date()
    };
  }
  
  protected async doDescribe(context: Context): Promise<DescribeResult> {
    this.callLog.push({ method: 'doDescribe', context });
    return {
      name: this.manifest.name,
      version: this.manifest.version,
      type: this.manifest.type,
      capabilities: [],
      manifest: this.manifest
    };
  }
  
  protected async doSchema(context: Context): Promise<SchemaResult> {
    this.callLog.push({ method: 'doSchema', context });
    return {
      schema: 'type Query { test: String }',
      format: 'graphql'
    };
  }
  
  protected async doQuery(context: Context): Promise<QueryResult> {
    this.callLog.push({ method: 'doQuery', context });
    return {
      data: { test: 'result' }
    };
  }
  
  protected async doEmit(context: Context): Promise<EmitResult> {
    this.callLog.push({ method: 'doEmit', context });
    return {
      emitted: true,
      eventId: 'test-event-123'
    };
  }
  
  // Custom lifecycle handlers for testing
  private async customHandler(context: Context): Promise<void> {
    this.customHandlerCalled = true;
    this.callLog.push({ method: 'customHandler', context });
  }
  
  private async anotherHandler(context: Context): Promise<void> {
    this.anotherHandlerCalled = true;
    this.callLog.push({ method: 'anotherHandler', context });
  }
  
  private async failingHandler(context: Context): Promise<void> {
    this.callLog.push({ method: 'failingHandler', context });
    throw new Error('Handler failed');
  }
  
  // Expose protected methods for testing
  public testInvokeHandler(handlerName: string, context: Context) {
    return this.invokeHandler(handlerName, context);
  }
  
  public testGetState() {
    return this.getState();
  }
  
  public resetCallLog() {
    this.callLog = [];
    this.customHandlerCalled = false;
    this.anotherHandlerCalled = false;
  }
}

// =============================================================================
// Test Utilities
// =============================================================================

function createTestManifest(overrides?: Partial<DSLManifest>): DSLManifest {
  return {
    name: 'test-mfe',
    version: '1.0.0',
    type: 'remote',
    language: 'typescript',
    capabilities: [],
    ...overrides
  };
}

function createTestContext(overrides?: Partial<Context>): Context {
  return {
    timestamp: new Date(),
    requestId: 'test-request-123',
    ...overrides
  };
}

// Mock console.error for telemetry tests
const originalConsoleError = console.error;
let consoleErrorCalls: any[] = [];

beforeAll(() => {
  console.error = jest.fn((...args) => {
    consoleErrorCalls.push(args);
  });
});

afterAll(() => {
  console.error = originalConsoleError;
});

beforeEach(() => {
  consoleErrorCalls = [];
});

// =============================================================================
// REQ-056: State Machine Tests
// =============================================================================

describe('BaseMFE State Machine (REQ-056)', () => {
  it('should initialize in uninitialized state', () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    
    expect(mfe.testGetState()).toBe('uninitialized');
  });
  
  it('should transition uninitialized → loading → ready on successful load', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    expect(mfe.testGetState()).toBe('uninitialized');
    
    const loadPromise = mfe.load(context);
    // State should transition immediately
    expect(mfe.testGetState()).toBe('loading');
    
    await loadPromise;
    expect(mfe.testGetState()).toBe('ready');
  });
  
  it('should transition loading → error on failed load', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    
    // Override doLoad to throw error
    (mfe as any).doLoad = async () => {
      throw new Error('Load failed');
    };
    
    const context = createTestContext();
    
    await expect(mfe.load(context)).rejects.toThrow('Load failed');
    expect(mfe.testGetState()).toBe('error');
  });
  
  it('should allow ready → rendering → ready transition', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    expect(mfe.testGetState()).toBe('ready');
    
    const renderPromise = mfe.render(context);
    expect(mfe.testGetState()).toBe('rendering');
    
    await renderPromise;
    expect(mfe.testGetState()).toBe('ready');
  });
  
  it('should reject invalid state transitions', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    // Cannot render from uninitialized
    await expect(mfe.render(context)).rejects.toThrow('Invalid state');
  });
  
  it('should allow health check in any state except destroyed', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    // Uninitialized
    await expect(mfe.health(context)).resolves.toMatchObject({ status: 'healthy' });
    
    // Loading
    await mfe.load(context);
    
    // Ready
    await expect(mfe.health(context)).resolves.toMatchObject({ status: 'healthy' });
  });
});

// =============================================================================
// REQ-054: BaseMFE Platform Capabilities Tests
// =============================================================================

describe('BaseMFE Platform Capabilities (REQ-054)', () => {
  it('should execute all 9 platform capabilities', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    // Load first (required for most capabilities)
    await mfe.load(context);
    mfe.resetCallLog();
    
    // Test each capability
    await mfe.render(context);
    expect(mfe.callLog.some(c => c.method === 'doRender')).toBe(true);
    
    await mfe.refresh(context);
    expect(mfe.callLog.some(c => c.method === 'doRefresh')).toBe(true);
    
    await mfe.authorizeAccess(context);
    expect(mfe.callLog.some(c => c.method === 'doAuthorizeAccess')).toBe(true);
    
    await mfe.health(context);
    expect(mfe.callLog.some(c => c.method === 'doHealth')).toBe(true);
    
    await mfe.describe(context);
    expect(mfe.callLog.some(c => c.method === 'doDescribe')).toBe(true);
    
    await mfe.schema(context);
    expect(mfe.callLog.some(c => c.method === 'doSchema')).toBe(true);
    
    await mfe.query(context);
    expect(mfe.callLog.some(c => c.method === 'doQuery')).toBe(true);
    
    await mfe.emit(context);
    expect(mfe.callLog.some(c => c.method === 'doEmit')).toBe(true);
  });
  
  it('should pass context through to doCapability methods', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext({
      inputs: { test: 'data' },
      jwt: 'test-token',
      user: { id: '123', username: 'test', roles: ['user'] }
    });
    
    await mfe.load(context);
    
    const loadCall = mfe.callLog.find(c => c.method === 'doLoad');
    expect(loadCall).toBeDefined();
    expect(loadCall?.context.inputs).toEqual({ test: 'data' });
    expect(loadCall?.context.jwt).toBe('test-token');
    expect(loadCall?.context.user).toMatchObject({ id: '123', username: 'test' });
  });
});

// =============================================================================
// REQ-042: Lifecycle Hook Execution Semantics Tests
// =============================================================================

describe('Lifecycle Hook Execution (REQ-042)', () => {
  it('should execute before → main → after phases in order', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ beforeHook: { handler: 'custom.customHandler' } }],
              after: [{ afterHook: { handler: 'custom.anotherHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    // Check execution order
    expect(mfe.callLog[0].method).toBe('customHandler');  // before
    expect(mfe.callLog[1].method).toBe('doLoad');         // main
    expect(mfe.callLog[2].method).toBe('anotherHandler'); // after
  });
  
  it('should execute error hooks when main phase fails', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              error: [{ errorHook: { handler: 'custom.customHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    
    // Make doLoad fail
    (mfe as any).doLoad = async () => {
      throw new Error('Load failed');
    };
    
    const context = createTestContext();
    
    await expect(mfe.load(context)).rejects.toThrow('Load failed');
    
    // Error hook should have been called
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
    
    // Context should include error
    const errorHookCall = mfe.callLog.find(c => c.method === 'customHandler');
    expect(errorHookCall?.context.error).toBeDefined();
    expect(errorHookCall?.context.error?.message).toBe('Load failed');
  });
  
  it('should handle mandatory flag: hook executes even if previous failed', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [
                { failing: { handler: 'custom.failingHandler' } },
                { mandatory: { handler: 'custom.customHandler', mandatory: true } }
              ]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    // Both hooks should have been called despite first one failing
    expect(mfe.callLog.some(c => c.method === 'failingHandler')).toBe(true);
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
  });
  
  it('should handle contained flag: errors wrapped in try-catch', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [
                { contained: { handler: 'custom.failingHandler', contained: true } },
                { after: { handler: 'custom.customHandler' } }
              ]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    // Should not throw despite failingHandler error (contained: true)
    await expect(mfe.load(context)).resolves.toBeDefined();
    
    // Both hooks attempted
    expect(mfe.callLog.some(c => c.method === 'failingHandler')).toBe(true);
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
  });
  
  it('should propagate main phase failures', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    
    // Make doLoad fail
    (mfe as any).doLoad = async () => {
      throw new Error('Main failed');
    };
    
    const context = createTestContext();
    
    // Main phase errors should propagate
    await expect(mfe.load(context)).rejects.toThrow('Main failed');
  });
  
  it('should fail silently for before/after phase errors', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ failing: { handler: 'custom.failingHandler' } }],
              after: [{ alsoFailing: { handler: 'custom.failingHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    // Should not throw despite hook failures
    await expect(mfe.load(context)).resolves.toBeDefined();
    
    // Main method should still execute
    expect(mfe.callLog.some(c => c.method === 'doLoad')).toBe(true);
  });
});

// =============================================================================
// REQ-043: Automatic Telemetry on Hook Failure Tests
// =============================================================================

describe('Automatic Telemetry (REQ-043)', () => {
  beforeEach(() => {
    consoleErrorCalls = [];
  });
  
  it('should emit telemetry when hook fails', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ failing: { handler: 'custom.failingHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    // Should have emitted telemetry
    expect(consoleErrorCalls.length).toBeGreaterThan(0);
    
    const telemetryCall = consoleErrorCalls.find(call => 
      call[0] === '[Telemetry]'
    );
    
    expect(telemetryCall).toBeDefined();
    
    const telemetryEvent = JSON.parse(telemetryCall[1]);
    expect(telemetryEvent.eventType).toBe('error');
    expect(telemetryEvent.eventData.source).toBe('lifecycle-hook');
    expect(telemetryEvent.eventData.hook).toBe('failing');
    expect(telemetryEvent.eventData.mfe).toBe('test-mfe');
    expect(telemetryEvent.severity).toBe('warn'); // before phase = warn
  });
  
  it('should emit error severity for main phase failures', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              main: [{ failing: { handler: 'custom.failingHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await expect(mfe.load(context)).rejects.toThrow();
    
    const telemetryCall = consoleErrorCalls.find(call => 
      call[0] === '[Telemetry]'
    );
    
    const telemetryEvent = JSON.parse(telemetryCall[1]);
    expect(telemetryEvent.severity).toBe('error'); // main phase = error
  });
  
  it('should include error details in telemetry', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ failing: { handler: 'custom.failingHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    const telemetryCall = consoleErrorCalls.find(call => 
      call[0] === '[Telemetry]'
    );
    
    const telemetryEvent = JSON.parse(telemetryCall[1]);
    expect(telemetryEvent.eventData.error.message).toBe('Handler failed');
    expect(telemetryEvent.eventData.error.stack).toBeDefined();
    expect(telemetryEvent.eventData.capability).toBe('load');
    expect(telemetryEvent.eventData.phase).toBe('before');
  });
});

// =============================================================================
// REQ-045: Handler Array Support Tests
// =============================================================================

describe('Handler Array Support (REQ-045)', () => {
  it('should execute handler array sequentially', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ 
                multiHandler: { 
                  handler: ['custom.customHandler', 'custom.anotherHandler'] 
                } 
              }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    // Both handlers should be called
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
    expect(mfe.callLog.some(c => c.method === 'anotherHandler')).toBe(true);
    
    // In sequential order
    const customIndex = mfe.callLog.findIndex(c => c.method === 'customHandler');
    const anotherIndex = mfe.callLog.findIndex(c => c.method === 'anotherHandler');
    expect(customIndex).toBeLessThan(anotherIndex);
  });
  
  it('should continue executing array handlers even if one fails (non-main phase)', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ 
                multiHandler: { 
                  handler: ['custom.failingHandler', 'custom.customHandler'] 
                } 
              }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    // Both should be attempted
    expect(mfe.callLog.some(c => c.method === 'failingHandler')).toBe(true);
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
  });
});

// =============================================================================
// REQ-057: Handler Resolution Tests
// =============================================================================

describe('Handler Resolution (REQ-057, REQ-058)', () => {
  it('should resolve custom handlers from developer class', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.testInvokeHandler('custom.customHandler', context);
    
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
  });
  
  it('should resolve custom handlers without prefix', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.testInvokeHandler('customHandler', context);
    
    expect(mfe.callLog.some(c => c.method === 'customHandler')).toBe(true);
  });
  
  it('should throw error for platform handlers (REQ-058 pending)', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await expect(
      mfe.testInvokeHandler('platform.verifyJWT', context)
    ).rejects.toThrow('Platform handler not implemented');
  });
  
  it('should throw error for missing custom handler', async () => {
    const manifest = createTestManifest();
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await expect(
      mfe.testInvokeHandler('custom.nonExistentHandler', context)
    ).rejects.toThrow('Custom handler not found: nonExistentHandler');
  });
});

// =============================================================================
// REQ-055: Context Object Tests
// =============================================================================

describe('Context Object (REQ-055)', () => {
  it('should include required context fields', () => {
    const context = createTestContext();
    
    expect(context.timestamp).toBeInstanceOf(Date);
    expect(context.requestId).toBeDefined();
  });
  
  it('should pass context through lifecycle phases', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ hook: { handler: 'custom.customHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext({
      inputs: { test: 'value' },
      jwt: 'token-123'
    });
    
    await mfe.load(context);
    
    const hookCall = mfe.callLog.find(c => c.method === 'customHandler');
    expect(hookCall?.context.inputs).toEqual({ test: 'value' });
    expect(hookCall?.context.jwt).toBe('token-123');
  });
  
  it('should populate context with phase and capability during execution', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              before: [{ hook: { handler: 'custom.customHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    const context = createTestContext();
    
    await mfe.load(context);
    
    const hookCall = mfe.callLog.find(c => c.method === 'customHandler');
    expect(hookCall?.context.phase).toBe('before');
    expect(hookCall?.context.capability).toBe('load');
  });
  
  it('should include error in context during error phase', async () => {
    const manifest = createTestManifest({
      capabilities: [
        {
          load: {
            type: 'platform',
            lifecycle: {
              error: [{ errorHook: { handler: 'custom.customHandler' } }]
            }
          }
        }
      ]
    });
    
    const mfe = new TestMFE(manifest);
    
    // Make doLoad fail
    (mfe as any).doLoad = async () => {
      throw new Error('Test error');
    };
    
    const context = createTestContext();
    
    await expect(mfe.load(context)).rejects.toThrow('Test error');
    
    const errorHookCall = mfe.callLog.find(c => c.method === 'customHandler');
    expect(errorHookCall?.context.error).toBeDefined();
    expect(errorHookCall?.context.error?.message).toBe('Test error');
    expect(errorHookCall?.context.phase).toBe('error');
  });
});
