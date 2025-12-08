#!/usr/bin/env ts-node
/**
 * RemoteMFE Runtime Demo
 * 
 * This demonstrates how to use RemoteMFE in a real application.
 * 
 * Run with: npx ts-node examples/runtime-demo.ts
 */

import { RemoteMFE } from '../src/runtime/remote-mfe';
import type { Context, TelemetryService, TelemetryEvent } from '../src/runtime/base-mfe';
import type { DSLManifest } from '../src/dsl/schema';

// Simple telemetry service that logs to console
class ConsoleLogger implements TelemetryService {
  emit(event: TelemetryEvent): void {
    const timestamp = event.timestamp.toISOString();
    const phase = event.eventData.phase || 'unknown';
    const capability = event.eventData.capability || 'unknown';
    console.log(`[${timestamp}] ${event.severity.toUpperCase()}: ${capability}/${phase}`);
  }
}

// Create a realistic manifest (would normally come from .well-known/mfe-manifest.yaml)
const manifest: DSLManifest = {
  name: 'user-dashboard',
  version: '1.2.0',
  type: 'tool',
  language: 'typescript',
  remoteEntry: 'http://localhost:3001/remoteEntry.js',
  capabilities: [
    {
      load: {
        type: 'platform',
        description: 'Load user dashboard MFE',
      },
    },
    {
      render: {
        type: 'platform',
        description: 'Render dashboard components',
      },
    },
  ],
};

async function main() {
  console.log('='.repeat(60));
  console.log('RemoteMFE Runtime Demo');
  console.log('='.repeat(60));
  console.log();

  // 1. Create MFE instance
  console.log('Step 1: Creating RemoteMFE instance...');
  const telemetry = new ConsoleLogger();
  const mfe = new RemoteMFE(manifest, { telemetry });
  console.log(`✓ Created MFE: ${manifest.name} v${manifest.version}`);
  console.log(`  State: ${mfe.getState()}`);
  console.log();

  // 2. Load the MFE
  console.log('Step 2: Loading MFE...');
  const loadContext: Context = {
    requestId: 'demo-load-001',
    timestamp: new Date(),
    user: {
      id: 'user-123',
      username: 'demo-user',
      roles: ['admin'],
    },
    inputs: {
      remoteEntry: manifest.remoteEntry,
    },
  };

  try {
    const loadResult = await mfe.load(loadContext);
    console.log(`✓ Load completed in ${loadResult.duration}ms`);
    console.log(`  Status: ${loadResult.status}`);
    console.log(`  Available components: ${(loadResult.availableComponents as string[])?.join(', ') || 'none'}`);
    console.log(`  State: ${mfe.getState()}`);
    console.log();

    // 3. Render a component
    console.log('Step 3: Rendering component...');
    const renderContext: Context = {
      requestId: 'demo-render-001',
      timestamp: new Date(),
      user: loadContext.user,
      inputs: {
        component: 'Dashboard',
        props: {
          userId: 'user-123',
          theme: 'dark',
        },
        containerId: 'app-root',
      },
    };

    const renderResult = await mfe.render(renderContext);
    console.log(`✓ Render completed in ${renderResult.duration}ms`);
    console.log(`  Status: ${renderResult.status}`);
    console.log(`  Component: ${renderResult.component}`);
    console.log(`  State: ${mfe.getState()}`);
    console.log();

    // 4. Get MFE metadata
    console.log('Step 4: Describing MFE...');
    const describeResult = await mfe.describe({ requestId: 'demo-describe', timestamp: new Date() });
    console.log(`✓ Description retrieved`);
    console.log(`  Name: ${describeResult.manifest.name}`);
    console.log(`  Type: ${describeResult.manifest.type}`);
    console.log(`  Capabilities: ${describeResult.manifest.capabilities?.length || 0}`);
    console.log();

    console.log('='.repeat(60));
    console.log('Demo completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
}

// Run demo
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
