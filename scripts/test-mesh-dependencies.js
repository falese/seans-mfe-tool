#!/usr/bin/env node
/**
 * test-mesh-dependencies.js
 *
 * Automated dependency compatibility validation for GraphQL Mesh BFF templates.
 * Requirement: REQ-MESH-DEPS-005
 * ADR Reference: ADR-062 (GraphQL Mesh v0.100.x)
 *
 * Usage:
 *   node scripts/test-mesh-dependencies.js
 *   node scripts/test-mesh-dependencies.js --verbose
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more checks failed
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const verbose = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

// ============================================================================
// Helpers
// ============================================================================

function log(msg) {
  console.log(msg);
}

function pass(name) {
  passed++;
  log(`  ✅ ${name}`);
}

function fail(name, reason) {
  failed++;
  log(`  ❌ ${name}`);
  log(`     Reason: ${reason}`);
}

function section(title) {
  log(`\n${title}`);
  log('─'.repeat(title.length));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ============================================================================
// Load DEPENDENCY_VERSIONS from unified-generator.ts via safe regex parsing
// (avoids requiring TypeScript compilation at test time, no code execution)
// ============================================================================

/**
 * Safely extract the DEPENDENCY_VERSIONS object from a TypeScript source file
 * using only regular expressions — no eval() or Function() execution.
 *
 * Extracts key/value pairs of the form:
 *   groupName: {
 *     key: 'value',
 *   }
 *
 * Returns a plain object with the same structure, or null on parse failure.
 */
function loadDependencyVersions() {
  const genFile = path.join(ROOT, 'src/codegen/UnifiedGenerator/unified-generator.ts');
  if (!fileExists(genFile)) {
    return null;
  }
  const src = readText(genFile);

  // Find the DEPENDENCY_VERSIONS block: capture everything between the first { and the matching }
  const startIdx = src.indexOf('export const DEPENDENCY_VERSIONS');
  if (startIdx === -1) return null;

  const braceStart = src.indexOf('{', startIdx);
  if (braceStart === -1) return null;

  // Walk forward to find the matching closing brace
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceEnd === -1) return null;

  const block = src.slice(braceStart + 1, braceEnd);

  // Parse top-level groups: <identifier>: {
  const result = {};
  const groupRegex = /(\w+)\s*:\s*\{([^}]+)\}/g;
  let groupMatch;

  while ((groupMatch = groupRegex.exec(block)) !== null) {
    const groupName = groupMatch[1];
    const groupBody = groupMatch[2];
    result[groupName] = {};

    // Parse key: 'value' or key: "value" pairs within the group
    const kvRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
    let kv;
    while ((kv = kvRegex.exec(groupBody)) !== null) {
      result[groupName][kv[1]] = kv[2];
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ============================================================================
// Check 1: unified-generator.ts has DEPENDENCY_VERSIONS
// ============================================================================

section('Check 1: Centralized Version Constants');

const genPath = path.join(ROOT, 'src/codegen/UnifiedGenerator/unified-generator.ts');
if (!fileExists(genPath)) {
  fail('unified-generator.ts exists', `File not found: ${genPath}`);
} else {
  const genSrc = readText(genPath);
  if (!genSrc.includes('export const DEPENDENCY_VERSIONS')) {
    fail('DEPENDENCY_VERSIONS exported', 'export const DEPENDENCY_VERSIONS not found in unified-generator.ts');
  } else {
    pass('DEPENDENCY_VERSIONS exported from unified-generator.ts');
  }

  const versions = loadDependencyVersions();
  if (!versions) {
    fail('DEPENDENCY_VERSIONS parseable', 'Could not parse DEPENDENCY_VERSIONS object');
  } else {
    if (verbose) log(`     Parsed ${Object.keys(versions).length} version groups`);

    // Validate required groups exist
    const requiredGroups = ['graphqlMesh', 'graphqlTools', 'meshPlugins', 'core', 'react', 'buildTools'];
    for (const group of requiredGroups) {
      if (versions[group]) {
        pass(`DEPENDENCY_VERSIONS has group: ${group}`);
      } else {
        fail(`DEPENDENCY_VERSIONS has group: ${group}`, `Group "${group}" missing`);
      }
    }

    // Validate no "latest" version strings
    const str = JSON.stringify(versions);
    if (str.includes('"latest"')) {
      fail('No "latest" version strings', 'Found "latest" in DEPENDENCY_VERSIONS — use explicit ranges');
    } else {
      pass('No "latest" version strings in DEPENDENCY_VERSIONS');
    }

    // Validate graphql version is ^16.x
    if (versions.core && versions.core.graphql) {
      if (versions.core.graphql.startsWith('^16') || versions.core.graphql.startsWith('~16')) {
        pass(`graphql version is ^16.x (${versions.core.graphql})`);
      } else {
        fail('graphql version is ^16.x', `Got ${versions.core.graphql} — must be ^16.x for Mesh compatibility`);
      }
    }

    // Validate Mesh CLI is v0.100.x
    if (versions.graphqlMesh && versions.graphqlMesh.cli) {
      if (versions.graphqlMesh.cli.includes('0.100')) {
        pass(`@graphql-mesh/cli is v0.100.x (${versions.graphqlMesh.cli})`);
      } else {
        fail('@graphql-mesh/cli is v0.100.x', `Got ${versions.graphqlMesh.cli} — incompatible with compose-cli mix`);
      }
    }

    // Validate React uses tilde (not caret) — singleton safety
    if (versions.react && versions.react.react) {
      if (versions.react.react.startsWith('~')) {
        pass(`React uses tilde range (${versions.react.react}) — MFE singleton safe`);
      } else if (versions.react.react.startsWith('^')) {
        fail('React uses tilde range', `Got ${versions.react.react} — use tilde (~) for MFE singleton safety`);
      } else {
        pass(`React has exact version (${versions.react.react})`);
      }
    }
  }
}

// ============================================================================
// Check 2: BFF template package.json.ejs uses versioned deps
// ============================================================================

section('Check 2: BFF Template Dependencies');

const bffTemplatePaths = [
  path.join(ROOT, 'packages/bff-plugin/templates/package.json.ejs'),
  path.join(ROOT, 'src/codegen/templates/bff/package.json.ejs'),
];

const bffTemplate = bffTemplatePaths.find(fileExists);

if (!bffTemplate) {
  fail('BFF template exists', `Not found at: ${bffTemplatePaths.join(' or ')}`);
} else {
  pass(`BFF template found at ${path.relative(ROOT, bffTemplate)}`);
  const tmplSrc = readText(bffTemplate);

  // Must NOT contain "latest"
  if (tmplSrc.includes('"latest"')) {
    fail('No "latest" in BFF template', 'Found raw "latest" version string — use dependencyVersions.*');
  } else {
    pass('No "latest" version strings in BFF template');
  }

  // Must reference dependencyVersions
  if (tmplSrc.includes('dependencyVersions.')) {
    pass('BFF template references dependencyVersions.*');
  } else {
    fail('BFF template references dependencyVersions.*', 'Template should use <%= dependencyVersions.* %> for all versions');
  }

  // Must include graphql-mesh/cli
  if (tmplSrc.includes('@graphql-mesh/cli')) {
    pass('BFF template includes @graphql-mesh/cli');
  } else {
    fail('BFF template includes @graphql-mesh/cli', 'Missing required Mesh CLI dependency');
  }

  // Must include graphql-mesh/serve-runtime
  if (tmplSrc.includes('@graphql-mesh/serve-runtime')) {
    pass('BFF template includes @graphql-mesh/serve-runtime');
  } else {
    fail('BFF template includes @graphql-mesh/serve-runtime', 'Missing serve-runtime for HTTP handler');
  }

  // Must NOT reference @omnigraph/openapi (incompatible)
  if (tmplSrc.includes('@omnigraph/openapi')) {
    fail('BFF template does not use @omnigraph/openapi', '@omnigraph/openapi incompatible with @graphql-mesh/cli@0.100.x');
  } else {
    pass('BFF template does not reference @omnigraph/openapi (incompatible combination avoided)');
  }

  // Must NOT reference @graphql-mesh/compose-cli (incompatible with v0.100.x)
  if (tmplSrc.includes('@graphql-mesh/compose-cli')) {
    fail('BFF template does not use @graphql-mesh/compose-cli', 'compose-cli is incompatible with @graphql-mesh/cli@0.100.x');
  } else {
    pass('BFF template does not reference @graphql-mesh/compose-cli (incompatible combination avoided)');
  }

  // Must include graphql-tools peer deps
  if (tmplSrc.includes('@graphql-tools/utils') && tmplSrc.includes('@graphql-tools/delegate')) {
    pass('BFF template includes @graphql-tools/* peer dependencies');
  } else {
    fail('BFF template includes @graphql-tools/* peer dependencies', 'Missing @graphql-tools/utils or @graphql-tools/delegate');
  }
}

// ============================================================================
// Check 3: BFF server template uses new Mesh API
// ============================================================================

section('Check 3: BFF Server Template API Pattern');

const bffServerPaths = [
  path.join(ROOT, 'packages/bff-plugin/templates/server.ts.ejs'),
  path.join(ROOT, 'src/codegen/templates/bff/server.ts.ejs'),
];

const bffServer = bffServerPaths.find(fileExists);

if (!bffServer) {
  fail('BFF server template exists', `Not found at: ${bffServerPaths.join(' or ')}`);
} else {
  pass(`BFF server template found at ${path.relative(ROOT, bffServer)}`);
  const serverSrc = readText(bffServer);

  // Must use new API
  if (serverSrc.includes('createBuiltMeshHTTPHandler')) {
    pass('Server template uses createBuiltMeshHTTPHandler (ADR-062)');
  } else {
    fail('Server template uses createBuiltMeshHTTPHandler', 'Old getMesh()/findAndParseConfig() API detected or handler missing');
  }

  // Must NOT use old getMesh API
  if (serverSrc.includes('getMesh(') || serverSrc.includes('findAndParseConfig(')) {
    fail('Server template does not use deprecated getMesh() / findAndParseConfig()', 'Deprecated Mesh API found in template');
  } else {
    pass('Server template does not use deprecated getMesh() / findAndParseConfig()');
  }
}

// ============================================================================
// Check 4: Mesh tsconfig uses commonjs module resolution
// ============================================================================

section('Check 4: TypeScript Configuration');

const tsconfigPaths = [
  path.join(ROOT, 'packages/bff-plugin/templates/tsconfig.json'),
  path.join(ROOT, 'src/codegen/templates/bff/tsconfig.json'),
];

const bffTsconfig = tsconfigPaths.find(fileExists);

if (!bffTsconfig) {
  fail('BFF tsconfig template exists', `Not found at: ${tsconfigPaths.join(' or ')}`);
} else {
  pass(`BFF tsconfig found at ${path.relative(ROOT, bffTsconfig)}`);
  let tsconfig;
  try {
    tsconfig = readJson(bffTsconfig);
  } catch {
    fail('BFF tsconfig is valid JSON', 'Could not parse tsconfig.json');
    tsconfig = null;
  }

  if (tsconfig && tsconfig.compilerOptions) {
    const co = tsconfig.compilerOptions;

    // Must use commonjs (not NodeNext)
    if (co.module && co.module.toLowerCase() === 'commonjs') {
      pass('tsconfig uses module: "commonjs" (required for Mesh compatibility)');
    } else if (co.module && co.module.toLowerCase().includes('nodenext')) {
      fail('tsconfig module resolution', `"module": "${co.module}" is incompatible with @graphql-mesh/cli@0.100.x — use "commonjs"`);
    } else {
      pass(`tsconfig module: "${co.module || 'unset'}" — no NodeNext conflict detected`);
    }

    // Must have skipLibCheck
    if (co.skipLibCheck === true) {
      pass('tsconfig has skipLibCheck: true');
    } else {
      fail('tsconfig has skipLibCheck: true', 'skipLibCheck is required due to Mesh type declaration gaps');
    }
  }
}

// ============================================================================
// Check 5: Required documentation exists
// ============================================================================

section('Check 5: Documentation Deliverables');

const requiredDocs = [
  { file: 'docs/mesh-dependency-matrix.md', label: 'Dependency Matrix' },
  { file: 'docs/bff-refactor-analysis.md', label: 'BFF Refactor Analysis' },
  { file: 'docs/architecture-decisions/ADR-062-mesh-v0100-plugins.md', label: 'ADR-062' },
];

for (const doc of requiredDocs) {
  const fullPath = path.join(ROOT, doc.file);
  if (fileExists(fullPath)) {
    pass(`${doc.label} exists (${doc.file})`);
  } else {
    fail(`${doc.label} exists`, `Missing: ${doc.file}`);
  }
}

// ============================================================================
// Check 6: addMeshDependencies() uses consistent versions
// ============================================================================

section('Check 6: addMeshDependencies() Consistency');

const sharedPaths = [
  path.join(ROOT, 'packages/bff-plugin/src/shared.ts'),
  path.join(ROOT, 'src/commands/bff/_shared.ts'),
];

for (const sharedPath of sharedPaths) {
  if (!fileExists(sharedPath)) continue;
  const sharedSrc = readText(sharedPath);

  // Check for "latest" in hardcoded versions
  if (sharedSrc.includes("= 'latest'") || sharedSrc.includes('= "latest"')) {
    fail(`${path.relative(ROOT, sharedPath)} no "latest"`, 'Found "latest" in addMeshDependencies() — use explicit versions');
  } else {
    pass(`${path.relative(ROOT, sharedPath)} does not hardcode "latest"`);
  }
}

// ============================================================================
// Summary
// ============================================================================

log('\n' + '='.repeat(60));
log(`Results: ${passed} passed, ${failed} failed`);
log('='.repeat(60));

if (failed > 0) {
  log('\n⚠️  Some checks failed. See above for details.');
  log('   Refer to docs/mesh-dependency-matrix.md for the stable version matrix.');
  process.exit(1);
} else {
  log('\n✅ All dependency compatibility checks passed.');
  process.exit(0);
}
