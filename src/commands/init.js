const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

/**
 * Initialize a new Module Federation workspace
 * Creates a monorepo structure with shell, remotes, and shared packages
 * @param {string} name - Workspace name
 * @param {object} options - Command options
 * @param {string} options.packageManager - Package manager (npm, yarn, pnpm)
 */
async function initCommand(name, options) {
  const workspaceDir = path.join(process.cwd(), name);
  const packageManager = options.packageManager || 'pnpm';

  console.log(chalk.blue(`Creating Module Federation workspace: ${name}`));
  console.log(chalk.gray(`Package manager: ${packageManager}`));

  try {
    // Validate package manager
    const validManagers = ['npm', 'yarn', 'pnpm'];
    if (!validManagers.includes(packageManager)) {
      throw new Error(`Invalid package manager: ${packageManager}. Valid options: ${validManagers.join(', ')}`);
    }

    // Check if directory already exists
    if (await fs.pathExists(workspaceDir)) {
      throw new Error(`Directory ${name} already exists`);
    }

    // Create workspace structure
    console.log(chalk.blue('\n📁 Creating workspace structure...'));
    await createWorkspaceStructure(workspaceDir);

    // Initialize package manager workspace
    console.log(chalk.blue('\n📦 Initializing package manager...'));
    await initializePackageManager(workspaceDir, name, packageManager);

    // Create root configuration files
    console.log(chalk.blue('\n⚙️  Creating configuration files...'));
    await createConfigurationFiles(workspaceDir, packageManager);

    // Create README
    await createWorkspaceReadme(workspaceDir, name, packageManager);

    // Create example mfe-spec.yaml
    await createExampleSpec(workspaceDir, name);

    console.log(chalk.green('\n✅ Workspace created successfully!\n'));
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray(`  cd ${name}`));
    console.log(chalk.gray(`  ${getInstallCommand(packageManager)}`));
    console.log(chalk.gray(`  # Edit mfe-spec.yaml to define your MFE structure`));
    console.log(chalk.gray(`  npx seans-mfe-tool generate mfe-spec.yaml\n`));

  } catch (error) {
    console.error(chalk.red('Error creating workspace:'), error.message);
    
    // Cleanup on failure
    if (await fs.pathExists(workspaceDir)) {
      console.log(chalk.yellow('Cleaning up...'));
      await fs.remove(workspaceDir);
    }
    
    throw error;
  }
}

/**
 * Create the workspace directory structure
 */
async function createWorkspaceStructure(workspaceDir) {
  const directories = [
    'apps/shell',
    'apps/remotes',
    'packages/shared',
    'packages/ui-components',
    'docs',
    '.github/workflows',
  ];

  for (const dir of directories) {
    const fullPath = path.join(workspaceDir, dir);
    await fs.ensureDir(fullPath);
    console.log(chalk.gray(`  ✓ Created ${dir}`));
  }
}

/**
 * Initialize package manager configuration
 */
async function initializePackageManager(workspaceDir, name, packageManager) {
  const packageJson = {
    name: `@${name}/root`,
    version: '0.1.0',
    private: true,
    workspaces: getWorkspaceConfig(packageManager),
    scripts: {
      dev: 'echo "Use package manager to run individual apps"',
      build: 'echo "Use package manager to build all apps"',
      test: 'jest',
      lint: 'eslint .',
      format: 'prettier --write "**/*.{js,jsx,json,md}"',
      clean: 'rm -rf node_modules apps/*/node_modules packages/*/node_modules',
    },
    devDependencies: {
      '@babel/core': '^7.23.0',
      '@babel/preset-env': '^7.23.0',
      '@babel/preset-react': '^7.22.0',
      'eslint': '^9.14.0',
      'prettier': '^3.3.3',
      'jest': '^29.7.0',
    },
  };

  await fs.writeJson(
    path.join(workspaceDir, 'package.json'),
    packageJson,
    { spaces: 2 }
  );
  console.log(chalk.gray('  ✓ Created package.json'));

  // Create workspace-specific config
  if (packageManager === 'pnpm') {
    const pnpmWorkspace = `packages:
  - 'apps/*'
  - 'packages/*'
`;
    await fs.writeFile(
      path.join(workspaceDir, 'pnpm-workspace.yaml'),
      pnpmWorkspace
    );
    console.log(chalk.gray('  ✓ Created pnpm-workspace.yaml'));
  }
}

/**
 * Get workspace configuration based on package manager
 */
function getWorkspaceConfig(packageManager) {
  if (packageManager === 'pnpm') {
    return undefined; // PNPM uses pnpm-workspace.yaml
  }
  return ['apps/*', 'packages/*'];
}

/**
 * Get install command for package manager
 */
function getInstallCommand(packageManager) {
  const commands = {
    npm: 'npm install',
    yarn: 'yarn install',
    pnpm: 'pnpm install',
  };
  return commands[packageManager] || 'npm install';
}

/**
 * Create configuration files
 */
async function createConfigurationFiles(workspaceDir, packageManager) {
  // .gitignore
  const gitignore = `# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
.nyc_output

# Production
dist
build
*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode
.idea
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Package manager
${packageManager === 'pnpm' ? 'pnpm-lock.yaml' : packageManager === 'yarn' ? 'yarn.lock' : 'package-lock.json'}
`;
  await fs.writeFile(path.join(workspaceDir, '.gitignore'), gitignore);
  console.log(chalk.gray('  ✓ Created .gitignore'));

  // .eslintrc.json
  const eslintConfig = {
    env: {
      browser: true,
      node: true,
      es2021: true,
      jest: true,
    },
    extends: ['eslint:recommended'],
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: {
        jsx: true,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  };
  await fs.writeJson(path.join(workspaceDir, '.eslintrc.json'), eslintConfig, { spaces: 2 });
  console.log(chalk.gray('  ✓ Created .eslintrc.json'));

  // .prettierrc
  const prettierConfig = {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
  };
  await fs.writeJson(path.join(workspaceDir, '.prettierrc'), prettierConfig, { spaces: 2 });
  console.log(chalk.gray('  ✓ Created .prettierrc'));

  // .editorconfig
  const editorconfig = `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
`;
  await fs.writeFile(path.join(workspaceDir, '.editorconfig'), editorconfig);
  console.log(chalk.gray('  ✓ Created .editorconfig'));
}

/**
 * Create workspace README
 */
async function createWorkspaceReadme(workspaceDir, name, packageManager) {
  const readme = `# ${name}

Module Federation Workspace created with seans-mfe-tool

## Structure

\`\`\`
${name}/
├── apps/
│   ├── shell/          # Container application
│   └── remotes/        # Remote MFE applications
├── packages/
│   ├── shared/         # Shared utilities
│   └── ui-components/  # Shared UI components
└── docs/               # Documentation
\`\`\`

## Getting Started

1. Install dependencies:
   \`\`\`bash
   ${getInstallCommand(packageManager)}
   \`\`\`

2. Edit \`mfe-spec.yaml\` to define your MFE structure

3. Generate projects from spec:
   \`\`\`bash
   npx seans-mfe-tool generate mfe-spec.yaml
   \`\`\`

## Available Commands

### Create Shell Application
\`\`\`bash
npx seans-mfe-tool shell <name> --port 3000
\`\`\`

### Create Remote MFE
\`\`\`bash
npx seans-mfe-tool remote <name> --port 3001
\`\`\`

### Create API from OpenAPI Spec
\`\`\`bash
npx seans-mfe-tool api <name> --spec openapi.yaml --database sqlite
\`\`\`

### Analyze Existing Project
\`\`\`bash
npx seans-mfe-tool analyze --dir ./my-project
\`\`\`

### Build Application
\`\`\`bash
npx seans-mfe-tool build <name> --type shell --serve
\`\`\`

### Deploy Application
\`\`\`bash
npx seans-mfe-tool deploy <name> --type shell --env development
\`\`\`

## Development

- Development server: \`${packageManager} run dev\`
- Build all: \`${packageManager} run build\`
- Run tests: \`${packageManager} test\`
- Lint: \`${packageManager} run lint\`

## Documentation

See the [docs](./docs) directory for more information.

## License

MIT
`;
  await fs.writeFile(path.join(workspaceDir, 'README.md'), readme);
  console.log(chalk.gray('  ✓ Created README.md'));
}

/**
 * Create example mfe-spec.yaml
 */
async function createExampleSpec(workspaceDir, name) {
  const spec = `# Module Federation Specification
# Edit this file to define your MFE structure, then run:
# npx seans-mfe-tool generate mfe-spec.yaml

workspace:
  name: ${name}
  packageManager: pnpm

shell:
  name: main-shell
  port: 3000
  description: Main container application

remotes:
  - name: dashboard
    port: 3001
    description: Dashboard MFE
    exposedComponents:
      - name: Dashboard
        path: ./src/Dashboard

  - name: user-profile
    port: 3002
    description: User profile MFE
    exposedComponents:
      - name: Profile
        path: ./src/Profile

apis:
  - name: user-api
    port: 4001
    spec: ./specs/user-api.yaml
    database: sqlite
    description: User management API

shared:
  packages:
    - react
    - react-dom
    - @mui/material
`;
  await fs.writeFile(path.join(workspaceDir, 'mfe-spec.yaml'), spec);
  console.log(chalk.gray('  ✓ Created mfe-spec.yaml'));
}

module.exports = { initCommand };
