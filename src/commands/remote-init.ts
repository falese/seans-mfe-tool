/**
 * remote:init Command
 * Following ADR-048: Incremental TypeScript migration
 * Implements REQ-REMOTE-002: Scaffold new DSL-based remote
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk = require('chalk');
import { execSync } from 'child_process';
import { 
  createMinimalManifest, 
  writeManifest, 
  generateEndpoints 
} from '../dsl/parser';
import { generateRspackConfig } from '../dsl/generator';
import type { RemoteInitOptions, DSLManifest } from '../dsl/schema';

// =============================================================================
// Template Files
// =============================================================================

function generatePackageJson(name: string, port: number): string {
  return JSON.stringify({
    name,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'rspack serve',
      build: 'rspack build',
      test: 'jest',
      'test:watch': 'jest --watch',
      'test:coverage': 'jest --coverage',
      lint: 'eslint src --ext .ts,.tsx',
      typecheck: 'tsc --noEmit'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      '@mui/material': '^5.14.0',
      '@emotion/react': '^11.11.0',
      '@emotion/styled': '^11.11.0'
    },
    devDependencies: {
      '@rspack/cli': '^1.0.0',
      '@rspack/core': '^1.0.0',
      '@rspack/plugin-react-refresh': '^1.0.0',
      '@module-federation/enhanced': '^0.6.0',
      typescript: '^5.3.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      jest: '^29.7.0',
      '@testing-library/react': '^14.0.0',
      '@testing-library/jest-dom': '^6.0.0',
      'ts-jest': '^29.1.0',
      eslint: '^8.50.0',
      '@typescript-eslint/eslint-plugin': '^6.0.0',
      '@typescript-eslint/parser': '^6.0.0'
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      lib: ['DOM', 'DOM.Iterable', 'ES2020'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true
    },
    include: ['src'],
    exclude: ['node_modules', 'dist']
  }, null, 2);
}

function generateIndexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`;
}

function generateIndexTsx(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
`;
}

function generateAppTsx(name: string): string {
  const displayName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `import React from 'react';
import { Box, Typography, Paper, Container } from '@mui/material';

/**
 * ${displayName} - Main Application Component
 * 
 * This is the root component of your MFE.
 * Add your domain capabilities to mfe-manifest.yaml and run 'mfe remote:generate'
 * to scaffold feature components.
 */
const App: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ${displayName}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          This MFE was scaffolded with <code>mfe remote:init</code>.
        </Typography>
        <Box component="section" sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Next Steps
          </Typography>
          <Typography component="ol" sx={{ pl: 2 }}>
            <li>Edit <code>mfe-manifest.yaml</code> to add capabilities</li>
            <li>Run <code>mfe remote:generate</code> to scaffold features</li>
            <li>Implement your feature components</li>
            <li>Run <code>npm run dev</code> to start development</li>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default App;
`;
}

function generateRemoteTsx(): string {
  return `/**
 * Remote Entry Point
 * Exports capabilities for Module Federation consumption
 * 
 * Add capabilities to mfe-manifest.yaml and run 'mfe remote:generate'
 * to populate this file with exports.
 */

// Default export for standalone rendering
export { default } from './App';
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/
.mesh/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
.env.*.local

# Testing
coverage/

# TypeScript
*.tsbuildinfo
`;
}

function generateJestConfig(): string {
  return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
`;
}

function generateSetupTests(): string {
  return `import '@testing-library/jest-dom';

// Mock Module Federation runtime
jest.mock('@module-federation/runtime', () => ({
  loadRemote: jest.fn(),
  init: jest.fn()
}));
`;
}

// =============================================================================
// Main Command
// =============================================================================

/**
 * Initialize a new DSL-based remote MFE project
 * 
 * @param name - Project name (kebab-case)
 * @param options - Command options
 */
export async function remoteInitCommand(
  name: string,
  options: RemoteInitOptions = {}
): Promise<void> {
  const port = options.port || 3001;
  const targetDir = path.resolve(process.cwd(), name);

  try {
    console.log(chalk.blue(`\nCreating DSL-based remote MFE: ${name}`));
    console.log(chalk.gray(`Target directory: ${targetDir}`));

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
      if (!options.force) {
        throw new Error(
          `Directory "${name}" already exists. Use --force to overwrite.`
        );
      }
      console.log(chalk.yellow(`⚠ Overwriting existing directory`));
    }

    // Create directory structure
    console.log(chalk.blue('\nCreating project structure...'));
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'features'));
    await fs.ensureDir(path.join(targetDir, 'public'));

    // Create manifest
    console.log(chalk.blue('Generating mfe-manifest.yaml...'));
    const manifest = createMinimalManifest(name, {
      type: 'remote',
      language: 'typescript'
    });
    
    // Add endpoints
    const endpoints = generateEndpoints(name, port);
    const fullManifest: DSLManifest = {
      ...manifest,
      ...endpoints
    };

    await writeManifest(fullManifest, path.join(targetDir, 'mfe-manifest.yaml'));
    console.log(chalk.green('✓ mfe-manifest.yaml'));

    // Create config files
    console.log(chalk.blue('Generating configuration files...'));
    
    await fs.writeFile(
      path.join(targetDir, 'package.json'),
      generatePackageJson(name, port)
    );
    console.log(chalk.green('✓ package.json'));

    await fs.writeFile(
      path.join(targetDir, 'tsconfig.json'),
      generateTsConfig()
    );
    console.log(chalk.green('✓ tsconfig.json'));

    await fs.writeFile(
      path.join(targetDir, 'rspack.config.js'),
      generateRspackConfig(fullManifest, port)
    );
    console.log(chalk.green('✓ rspack.config.js'));

    await fs.writeFile(
      path.join(targetDir, 'jest.config.js'),
      generateJestConfig()
    );
    console.log(chalk.green('✓ jest.config.js'));

    await fs.writeFile(
      path.join(targetDir, '.gitignore'),
      generateGitignore()
    );
    console.log(chalk.green('✓ .gitignore'));

    // Create source files
    console.log(chalk.blue('Generating source files...'));

    await fs.writeFile(
      path.join(targetDir, 'public', 'index.html'),
      generateIndexHtml(name)
    );
    console.log(chalk.green('✓ public/index.html'));

    await fs.writeFile(
      path.join(targetDir, 'src', 'index.tsx'),
      generateIndexTsx()
    );
    console.log(chalk.green('✓ src/index.tsx'));

    await fs.writeFile(
      path.join(targetDir, 'src', 'App.tsx'),
      generateAppTsx(name)
    );
    console.log(chalk.green('✓ src/App.tsx'));

    await fs.writeFile(
      path.join(targetDir, 'src', 'remote.tsx'),
      generateRemoteTsx()
    );
    console.log(chalk.green('✓ src/remote.tsx'));

    await fs.writeFile(
      path.join(targetDir, 'src', 'setupTests.ts'),
      generateSetupTests()
    );
    console.log(chalk.green('✓ src/setupTests.ts'));

    // Install dependencies
    if (!options.skipInstall) {
      console.log(chalk.blue('\nInstalling dependencies...'));
      execSync('npm install', {
        cwd: targetDir,
        stdio: 'inherit',
        env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
      });
    } else {
      console.log(chalk.yellow('\nSkipping npm install (use --skip-install to skip)'));
    }

    // Success message
    console.log(chalk.green('\n✓ Remote MFE created successfully!'));
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. ${chalk.cyan(`cd ${name}`)}`);
    console.log(`  2. Edit ${chalk.cyan('mfe-manifest.yaml')} to add capabilities`);
    console.log(`  3. Run ${chalk.cyan('mfe remote:generate')} to scaffold features`);
    console.log(`  4. Run ${chalk.cyan('npm run dev')} to start development`);
    console.log(`\nRemote will be available at: ${chalk.cyan(`http://localhost:${port}`)}`);
    console.log(`remoteEntry.js: ${chalk.cyan(`http://localhost:${port}/remoteEntry.js`)}`);

  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create remote MFE:'));
    console.error(chalk.red((error as Error).message));
    throw error;
  }
}

export { remoteInitCommand as default };
