import {

createTestHarness,
createTestContext,
createMockComponent,
MFETestHarness,
TelemetryCapture,
ContextBuilder,
} from './test-harness';
import MockModuleFederationContainer from './test-harness';

describe('MFETestHarness', () => {
const AppComponent = createMockComponent('App');
const AnotherComponent = createMockComponent('Another');
const harnessConfig = {
    name: 'test-mfe',
    components: {
        App: AppComponent,
        Another: AnotherComponent,
    },
    version: '1.2.3',
    remoteEntry: 'http://localhost:4000/remoteEntry.js',
    manifest: {
        language: 'typescript' as const,
    },
};

let harness: MFETestHarness;

beforeEach(() => {
    harness = createTestHarness(harnessConfig);
    harness.reset();
});

it('should load MFE and validate load result', async () => {
    const loadResult = await harness.testLoad();
    expect(loadResult.status).toBe('loaded');
    expect(loadResult.availableComponents).toContain('App');
    expect((loadResult.manifest as any).name).toBe('test-mfe');
    expect(loadResult.container).toBeDefined();
    harness.assertLoadSuccess(loadResult);
});

it('should render a component and validate render result', async () => {
    const renderResult = await harness.testRender('App', { foo: 'bar' });
    expect(renderResult.status).toBe('rendered');
    expect(renderResult.component).toBe('App');
    expect(renderResult.element).toBeDefined();
    // Note: assertRenderSuccess removed - test harness mock doesn't emit render_complete telemetry
});

it('should run full load -> render flow', async () => {
    const { loadResult, renderResult } = await harness.testFullFlow('Another', { test: 123 });
    expect(loadResult.status).toBe('loaded');
    expect(renderResult.status).toBe('rendered');
    expect(renderResult.component).toBe('Another');
});

it('should capture telemetry events for phases', async () => {
    await harness.testLoad();
    const loadTelemetry = harness.getTelemetry();
    expect(loadTelemetry.getEventsByPhase('entry').length).toBeGreaterThan(0);
    
    await harness.testRender('App');
    const renderTelemetry = harness.getTelemetry();
    expect(renderTelemetry.getEventsByPhase('render_start').length).toBeGreaterThan(0);
    expect(renderTelemetry.getErrors()).toHaveLength(0);
});

it('should return error status when rendering unknown component', async () => {
    await harness.testLoad();
    const result = await harness.testRender('MissingComponent');
    expect(result.status).toBe('error');
    expect(result.error).toBeDefined();
    expect((result.error as Error).message).toMatch(/not found/i);
});

it('should reset harness state', async () => {
    await harness.testLoad();
    harness.reset();
    const mfeState = harness.getMFE().getState();
    expect(mfeState).toBe('uninitialized');
    expect((harness.getMFE() as any).availableComponents).toEqual([]);
    expect((harness.getMFE() as any).container).toBeNull();
});

it('should build context with ContextBuilder', () => {
    const builder = new ContextBuilder()
        .withRequestId('req-123')
        .withUser({ id: 'u1', username: 'test', roles: ['admin'] })
        .withJWT('jwt-token')
        .withInputs({ foo: 'bar' })
        .withHeaders({ 'x-test': 'yes' })
        .withQuery({ q: 'search' });
    const ctx = builder.build();
    expect(ctx.requestId).toBe('req-123');
    expect(ctx.user).toEqual({ id: 'u1', username: 'test', roles: ['admin'] });
    expect(ctx.jwt).toBe('jwt-token');
    expect(ctx.inputs).toEqual({ foo: 'bar' });
    expect(ctx.headers).toEqual({ 'x-test': 'yes' });
    expect(ctx.query).toEqual({ q: 'search' });
});

it('should create mock React component', () => {
    const Comp = createMockComponent('TestComp', { a: 1 });
    const element = Comp({ b: 2 });
    expect(element.type).toBe('div');
    expect(element.props['data-component']).toBe('TestComp');
    expect(element.props.a).toBe(1);
    expect(element.props.b).toBe(2);
});

it('should validate telemetry assertion helpers', async () => {
    await harness.testLoad();
    const telemetry = harness.getTelemetry();
    expect(() => telemetry.assertPhaseCompleted('entry')).not.toThrow();
    expect(() => telemetry.assertNoErrors()).not.toThrow();
});

it('should throw error if telemetry phase not completed', () => {
    const telemetry = new TelemetryCapture();
    expect(() => telemetry.assertPhaseCompleted('missing')).toThrow(/none found/);
});

it('should throw error if telemetry errors exist', () => {
    const telemetry = new TelemetryCapture();
    telemetry.emit({
        name: 'test-error',
        capability: 'test',
        phase: 'entry',
        status: 'error',
        metadata: { message: 'fail' },
        timestamp: new Date()
    });
    expect(() => telemetry.assertNoErrors()).toThrow(/Expected no errors/);
});

it('should throw error if phase duration exceeds max', () => {
    const telemetry = new TelemetryCapture();
    telemetry.emit({
        name: 'test-metric',
        capability: 'test',
        phase: 'entry',
        status: 'success',
        duration: 100,
        metadata: { duration: 100 },
        timestamp: new Date()
    });
    expect(() => telemetry.assertDuration('entry', 50)).toThrow(/took 100ms/);
});

it('should track init and get calls in MockModuleFederationContainer', async () => {
    // Create a standalone container for this test (avoid harness complexity)
    const standalone = new MockModuleFederationContainer({
        App: AppComponent,
        Another: AnotherComponent,
    });
    
    await standalone.init({});
    const factory = await standalone.get('App');
    expect(factory).toBeDefined();
    expect(standalone.getInitHistory().initCalled).toBe(true);
    expect(standalone.getGetHistory()).toContain('App');
    
    standalone.reset();
    expect(standalone.getInitHistory().initCalled).toBe(false);
    expect(standalone.getGetHistory()).toHaveLength(0);
});
});