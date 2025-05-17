#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { execSync } = require('child_process');
const chalk = require('chalk');
const babel = require('@babel/core');
const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;
const babelGenerate = require('@babel/generator').default;
const diff = require('diff');

// Parse command-line arguments
const args = process.argv.slice(2);
const cmd = args[0]; // 'generate' or 'update'
const specPath = args.find(arg => arg.includes('.yaml') || arg.includes('.yml'));
const outputDir = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || process.cwd();
const dryRun = args.includes('--dry-run');

// Command-line help
if (!cmd || !specPath || args.includes('--help')) {
  console.log(chalk.yellow(`
Usage: mfe-generator <command> <spec.yaml> [options]

Commands:
  generate    Generate a new MFE project from specification
  update      Update an existing MFE project from specification

Options:
  --output=DIR    Output directory (default: current directory)
  --dry-run       Show changes without applying them
  --help          Show this help message

Examples:
  mfe-generator generate myapp.yaml
  mfe-generator update myapp.yaml --output=./projects/myapp
  `));
  process.exit(1);
}

// Annotation constants
const ANNOTATION_START = '/* MFE-GENERATOR:START */';
const ANNOTATION_END = '/* MFE-GENERATOR:END */';
const ANNOTATION_ID_PREFIX = '/* MFE-GENERATOR:ID:';
const ANNOTATION_ID_SUFFIX = ' */';

// Load and parse the MFE specification
async function loadSpec() {
  try {
    const yamlContent = await fs.readFile(specPath, 'utf8');
    return yaml.load(yamlContent);
  } catch (error) {
    console.error(chalk.red(`Error loading specification: ${error.message}`));
    process.exit(1);
  }
}

// Detect changes between old and new specs
function detectChanges(oldSpec, newSpec) {
  const changes = {
    shell: {},
    remotes: {
      added: [],
      removed: [],
      modified: []
    },
    apis: {
      added: [],
      removed: [],
      modified: []
    }
  };
  
  // Check shell changes
  if (oldSpec.shell?.name !== newSpec.shell?.name) {
    changes.shell.nameChanged = true;
  }
  if (oldSpec.shell?.port !== newSpec.shell?.port) {
    changes.shell.portChanged = true;
  }
  if (JSON.stringify(oldSpec.shell?.theme) !== JSON.stringify(newSpec.shell?.theme)) {
    changes.shell.themeChanged = true;
  }
  
  // Check remote MFEs changes
  const oldRemotes = oldSpec.remotes || [];
  const newRemotes = newSpec.remotes || [];
  
  // Find added and removed remotes
  const oldRemoteNames = oldRemotes.map(r => r.name);
  const newRemoteNames = newRemotes.map(r => r.name);
  
  changes.remotes.added = newRemotes.filter(r => !oldRemoteNames.includes(r.name));
  changes.remotes.removed = oldRemotes.filter(r => !newRemoteNames.includes(r.name));
  
  // Find modified remotes
  changes.remotes.modified = newRemotes.filter(newRemote => {
    const oldRemote = oldRemotes.find(r => r.name === newRemote.name);
    if (!oldRemote) return false;
    
    // Check for changes
    return (
      newRemote.port !== oldRemote.port ||
      JSON.stringify(newRemote.exposedComponents) !== JSON.stringify(oldRemote.exposedComponents) ||
      JSON.stringify(newRemote.dependencies) !== JSON.stringify(oldRemote.dependencies) ||
      JSON.stringify(newRemote.routes) !== JSON.stringify(oldRemote.routes)
    );
  });
  
  // Check API changes
  const oldApis = oldSpec.apis || [];
  const newApis = newSpec.apis || [];
  
  // Find added and removed APIs
  const oldApiNames = oldApis.map(a => a.name);
  const newApiNames = newApis.map(a => a.name);
  
  changes.apis.added = newApis.filter(a => !oldApiNames.includes(a.name));
  changes.apis.removed = oldApis.filter(a => !newApiNames.includes(a.name));
  
  // Find modified APIs
  changes.apis.modified = newApis.filter(newApi => {
    const oldApi = oldApis.find(a => a.name === newApi.name);
    if (!oldApi) return false;
    
    // Check for changes
    return (
      newApi.port !== oldApi.port ||
      newApi.database !== oldApi.database ||
      newApi.spec !== oldApi.spec ||
      JSON.stringify(newApi.routes) !== JSON.stringify(oldApi.routes)
    );
  });
  
  return changes;
}

// Find all annotated sections in a file
function findAnnotatedSections(fileContent) {
  const sections = [];
  let startIndex = -1;
  let currentID = null;
  
  // Read the file line by line to find annotations
  const lines = fileContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for start annotation
    if (line.includes(ANNOTATION_START)) {
      startIndex = i;
      
      // Check for ID annotation
      const idMatch = line.match(new RegExp(`${ANNOTATION_ID_PREFIX}([^\\s]+)${ANNOTATION_ID_SUFFIX}`));
      if (idMatch) {
        currentID = idMatch[1];
      }
    }
    
    // Look for end annotation
    else if (line.includes(ANNOTATION_END) && startIndex !== -1) {
      sections.push({
        id: currentID,
        startLine: startIndex,
        endLine: i,
        content: lines.slice(startIndex + 1, i).join('\n')
      });
      
      startIndex = -1;
      currentID = null;
    }
  }
  
  return sections;
}

// Update annotated sections in a file
async function updateAnnotatedFile(filePath, sectionUpdates) {
  if (!await fs.pathExists(filePath)) {
    console.log(chalk.yellow(`File not found: ${filePath}`));
    return false;
  }
  
  // Read the file content
  const fileContent = await fs.readFile(filePath, 'utf8');
  const lines = fileContent.split('\n');
  
  // Find all sections
  const sections = findAnnotatedSections(fileContent);
  
  // Create a map for quick lookup
  const sectionMap = {};
  sections.forEach(section => {
    if (section.id) {
      sectionMap[section.id] = section;
    }
  });
  
  // Apply updates (in reverse order to avoid line number changes)
  const updates = Object.entries(sectionUpdates)
    .filter(([id]) => sectionMap[id])
    .sort((a, b) => sectionMap[b[0]].startLine - sectionMap[a[0]].startLine);
  
  let updatedLines = [...lines];
  for (const [id, newContent] of updates) {
    const section = sectionMap[id];
    
    // Replace content between start and end annotations
    updatedLines = [
      ...updatedLines.slice(0, section.startLine + 1),
      newContent,
      ...updatedLines.slice(section.endLine)
    ];
    
    console.log(chalk.blue(`Updating section '${id}' in ${path.basename(filePath)}`));
  }
  
  // Only write if changes were made
  if (updates.length > 0) {
    const newContent = updatedLines.join('\n');
    
    // Show diff if dry run
    if (dryRun) {
      console.log(chalk.yellow('\nChanges for', filePath, '(dry run):'));
      const changes = diff.diffLines(fileContent, newContent);
      changes.forEach(change => {
        const color = change.added ? 'green' : change.removed ? 'red' : 'grey';
        const prefix = change.added ? '+' : change.removed ? '-' : ' ';
        const lines = change.value.split('\n').filter(Boolean);
        lines.forEach(line => {
          console.log(chalk[color](`${prefix} ${line}`));
        });
      });
    } else {
      await fs.writeFile(filePath, newContent);
      console.log(chalk.green(`✓ Updated ${path.basename(filePath)}`));
    }
    
    return true;
  }
  
  return false;
}

// Update components in a remote MFE
async function updateRemoteComponents(remoteDir, remote) {
  const componentsDir = path.join(remoteDir, 'src', 'components');
  await fs.ensureDir(componentsDir);
  
  // Track existing components and new components
  const existingComponents = new Set(
    (await fs.pathExists(componentsDir)) 
      ? (await fs.readdir(componentsDir)).map(file => file.replace(/\.jsx$/, ''))
      : []
  );
  
  const addedComponents = [];
  const updatedComponents = [];
  
  // Update or create each component
  for (const component of remote.exposedComponents) {
    const componentName = component.name;
    const componentPath = path.join(componentsDir, `${componentName}.jsx`);
    
    // Create template content
    const componentContent = `import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}component-${componentName}${ANNOTATION_ID_SUFFIX}
const ${componentName} = ({ title = "${componentName}" }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is the ${componentName} component from the ${remote.name} MFE.
        </Typography>
      </Box>
    </Paper>
  );
};
${ANNOTATION_END}

export default ${componentName};
`;

    if (existingComponents.has(componentName)) {
      // Update existing component
      const existingContent = await fs.readFile(componentPath, 'utf8');
      
      // If file already has annotations, update just the annotated section
      if (existingContent.includes(ANNOTATION_START) && existingContent.includes(ANNOTATION_END)) {
        const updated = await updateAnnotatedFile(componentPath, {
          [`component-${componentName}`]: `const ${componentName} = ({ title = "${componentName}" }) => {
  return (
    <Paper elevation={2} sx={{ p: 3, m: 2 }}>
      <Typography variant="h4" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ mt: 2 }}>
        <Typography>
          This is the ${componentName} component from the ${remote.name} MFE.
        </Typography>
      </Box>
    </Paper>
  );
};`
        });
        
        if (updated) {
          updatedComponents.push(componentName);
        }
      } else if (!dryRun) {
        // If file doesn't have annotations yet, write new file
        await fs.writeFile(componentPath, componentContent);
        updatedComponents.push(componentName);
      }
    } else {
      // Create new component
      if (!dryRun) {
        await fs.writeFile(componentPath, componentContent);
      }
      addedComponents.push(componentName);
    }
  }
  
  console.log(`${addedComponents.length > 0 ? chalk.green(`✓ Added components: ${addedComponents.join(', ')}`) : ''}`);
  console.log(`${updatedComponents.length > 0 ? chalk.green(`✓ Updated components: ${updatedComponents.join(', ')}`) : ''}`);
  
  return { addedComponents, updatedComponents };
}

// Update App.jsx to import and use all components
async function updateAppJsx(remoteDir, remote, componentChanges) {
  const appJsxPath = path.join(remoteDir, 'src', 'App.jsx');
  
  if (!await fs.pathExists(appJsxPath)) {
    console.log(chalk.yellow(`App.jsx not found in ${remoteDir}, skipping update`));
    return false;
  }
  
  // Generate imports
  const imports = remote.exposedComponents.map(c => 
    `import ${c.name} from './components/${c.name}';`
  ).join('\n');
  
  // Generate component usage
  const componentUsage = remote.exposedComponents.map(c => 
    `<${c.name} />`
  ).join('\n        ');
  
  // Update App.jsx
  const appContent = await fs.readFile(appJsxPath, 'utf8');
  
  // If file already has annotations, update just the annotated sections
  if (appContent.includes(ANNOTATION_START) && appContent.includes(ANNOTATION_END)) {
    return await updateAnnotatedFile(appJsxPath, {
      'imports': imports,
      'component-usage': componentUsage
    });
  } else {
    // Otherwise, create a new App.jsx with annotations
    const newAppContent = `import React from 'react';
import { Box, Typography, Container } from '@mui/material';
${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}imports${ANNOTATION_ID_SUFFIX}
${imports}
${ANNOTATION_END}

const App = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ${remote.name} MFE
        </Typography>
        ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}component-usage${ANNOTATION_ID_SUFFIX}
        ${componentUsage}
        ${ANNOTATION_END}
      </Box>
    </Container>
  );
};

export default App;
`;
    
    if (!dryRun) {
      await fs.writeFile(appJsxPath, newAppContent);
    }
    console.log(chalk.green(`✓ Updated App.jsx in ${remote.name}`));
    return true;
  }
}

// Update bootstrap.jsx to export components for Module Federation
async function updateBootstrapJsx(remoteDir, remote) {
  const bootstrapPath = path.join(remoteDir, 'src', 'bootstrap.jsx');
  
  if (!await fs.pathExists(bootstrapPath)) {
    console.log(chalk.yellow(`bootstrap.jsx not found in ${remoteDir}, skipping update`));
    return false;
  }
  
  // Generate component exports
  const componentExports = remote.exposedComponents.map(c => 
    `export { default as ${c.name} } from './components/${c.name}';`
  ).join('\n');
  
  // Update bootstrap.jsx
  const bootstrapContent = await fs.readFile(bootstrapPath, 'utf8');
  
  // If file already has annotations, update just the annotated sections
  if (bootstrapContent.includes(ANNOTATION_START) && bootstrapContent.includes(ANNOTATION_END)) {
    return await updateAnnotatedFile(bootstrapPath, {
      'exports': componentExports
    });
  } else {
    // Otherwise, add exports at the end of the file
    const newContent = `${bootstrapContent}

${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exports${ANNOTATION_ID_SUFFIX}
// Export components for Module Federation
${componentExports}
${ANNOTATION_END}
`;
    
    if (!dryRun) {
      await fs.writeFile(bootstrapPath, newContent);
    }
    console.log(chalk.green(`✓ Updated bootstrap.jsx in ${remote.name}`));
    return true;
  }
}

// Update rspack.config.js for Module Federation
async function updateRspackConfig(remoteDir, remote) {
  const configPath = path.join(remoteDir, 'rspack.config.js');
  
  if (!await fs.pathExists(configPath)) {
    console.log(chalk.yellow(`rspack.config.js not found in ${remoteDir}, skipping update`));
    return false;
  }
  
  // Generate the exposes config
  const exposesConfig = remote.exposedComponents.reduce((acc, component) => {
    acc[component.path] = `./src/components/${component.name}.jsx`;
    return acc;
  }, { './App': './src/App.jsx' });
  
  // Convert to JSON string with appropriate formatting
  const exposesStr = JSON.stringify(exposesConfig, null, 6)
    .replace(/"/g, "'")
    .replace(/},/g, '},')
    .replace(/'/g, '"');
  
  // Read the config file
  let configContent = await fs.readFile(configPath, 'utf8');
  
  // Try to update using AST for more precision
  try {
    const ast = babelParser.parse(configContent, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    
    let updated = false;
    
    babelTraverse(ast, {
      ObjectProperty(path) {
        if (path.node.key.name === 'exposes' && 
            path.parent.type === 'ObjectExpression' &&
            path.parentPath.parent.type === 'NewExpression' &&
            path.parentPath.parent.callee.property?.name === 'ModuleFederationPlugin') {
          
          // Create new exposes node from our config
          const newExposesNode = babelParser.parse(`const temp = ${exposesStr}`).program.body[0].declarations[0].init;
          
          // Replace the old node
          path.node.value = newExposesNode;
          updated = true;
        }
      }
    });
    
    if (updated) {
      // Generate the updated code
      const output = babelGenerate(ast);
      
      if (!dryRun) {
        await fs.writeFile(configPath, output.code);
      }
      console.log(chalk.green(`✓ Updated Module Federation config in ${remote.name}`));
      return true;
    }
  } catch (error) {
    console.log(chalk.yellow(`AST parsing failed for ${configPath}, falling back to string replacement`));
  }
  
  // Fallback: update via string replacement with annotations
  if (configContent.includes(ANNOTATION_START) && configContent.includes(ANNOTATION_END)) {
    return await updateAnnotatedFile(configPath, {
      'exposes': `exposes: ${exposesStr}`
    });
  } else {
    // Try basic string replacement as a last resort
    const replaced = configContent.replace(
      /exposes: {[^}]*}/s,
      `exposes: ${exposesStr}`
    );
    
    if (replaced !== configContent) {
      if (!dryRun) {
        await fs.writeFile(configPath, replaced);
      }
      console.log(chalk.green(`✓ Updated Module Federation config in ${remote.name}`));
      return true;
    }
  }
  
  console.log(chalk.yellow(`Could not update Module Federation config in ${remote.name}`));
  return false;
}

// Main entry point
async function main() {
  try {
    if (cmd === 'generate') {
      // Load spec
      const spec = await loadSpec();
      
      // Generate new MFE project
      await generateMFE(spec);
    }
    else if (cmd === 'update') {
      // Load spec
      const newSpec = await loadSpec();
      
      // Load existing spec if available
      let oldSpec = {};
      const projectDir = path.join(outputDir, newSpec.name);
      const oldSpecPath = path.join(projectDir, 'mfe-spec.yaml');
      
      if (await fs.pathExists(oldSpecPath)) {
        try {
          const oldSpecContent = await fs.readFile(oldSpecPath, 'utf8');
          oldSpec = yaml.load(oldSpecContent);
        } catch (error) {
          console.log(chalk.yellow(`Could not load existing spec, treating as a new project: ${error.message}`));
          oldSpec = {};
        }
      } else {
        console.log(chalk.yellow('No existing spec found, treating as a new project'));
      }
      
      // Detect changes
      const changes = detectChanges(oldSpec, newSpec);
      
      // Update MFE project
      await updateMFE(projectDir, newSpec, changes);
      
      // Save new spec
      if (!dryRun) {
        await fs.writeFile(oldSpecPath, yaml.dump(newSpec));
        console.log(chalk.green(`✓ Saved updated spec to ${oldSpecPath}`));
      }
    }
    else {
      console.error(chalk.red(`Unknown command: ${cmd}`));
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Update an existing MFE project
async function updateMFE(projectDir, spec, changes) {
  console.log(chalk.blue(`\nUpdating MFE project: ${spec.name}`));
  
  // Create project directory if it doesn't exist
  await fs.ensureDir(projectDir);
  
  // Update shell if needed
  if (changes.shell.nameChanged || changes.shell.portChanged || changes.shell.themeChanged || 
      changes.remotes.added.length > 0 || changes.remotes.removed.length > 0 || changes.remotes.modified.length > 0) {
    await updateShell(projectDir, spec, changes);
  }
  
  // Update remotes
  for (const remote of changes.remotes.added) {
    await updateRemoteMFE(projectDir, remote);
  }
  
  for (const remote of changes.remotes.modified) {
    await updateRemoteMFE(projectDir, remote);
  }
  
  // Remove remotes that were removed
  for (const remote of changes.remotes.removed) {
    const remoteDir = path.join(projectDir, remote.name);
    
    if (await fs.pathExists(remoteDir)) {
      console.log(chalk.yellow(`Removing remote MFE: ${remote.name}`));
      
      if (!dryRun) {
        await fs.remove(remoteDir);
      }
    }
  }
  
  // Update APIs
  for (const api of changes.apis.added) {
    await updateAPI(projectDir, api);
  }
  
  for (const api of changes.apis.modified) {
    await updateAPI(projectDir, api);
  }
  
  // Remove APIs that were removed
  for (const api of changes.apis.removed) {
    const apiDir = path.join(projectDir, api.name);
    
    if (await fs.pathExists(apiDir)) {
      console.log(chalk.yellow(`Removing API: ${api.name}`));
      
      if (!dryRun) {
        await fs.remove(apiDir);
      }
    }
  }
  
  // Update workspace package.json
  await updateWorkspacePackage(projectDir, spec);
  
  console.log(chalk.green(`\n✓ MFE project ${spec.name} updated successfully!`));
}

// Generate a new MFE project
async function generateMFE(spec) {
  console.log(chalk.blue(`\nGenerating MFE project: ${spec.name}`));
  console.log(chalk.gray('Description: ' + spec.description));
  
  // Create project root directory
  const projectDir = path.join(outputDir, spec.name);
  await fs.ensureDir(projectDir);
  
  // Create README file
  await createReadme(projectDir, spec);
  
  // Generate shell application
  await generateShell(projectDir, spec);
  
  // Generate remote MFEs
  await generateRemotes(projectDir, spec);
  
  // Generate APIs
  await generateAPIs(projectDir, spec);
  
  // Create package.json for workspace
  await createWorkspacePackage(projectDir, spec);
  
  // Save spec
  if (!dryRun) {
    await fs.writeFile(path.join(projectDir, 'mfe-spec.yaml'), yaml.dump(spec));
    console.log(chalk.green(`✓ Saved spec to ${path.join(projectDir, 'mfe-spec.yaml')}`));
  }
  
  console.log(chalk.green('\n✓ MFE project generated successfully!'));
  console.log(chalk.blue(`\nNext steps:`));
  console.log(`1. cd ${spec.name}`);
  console.log(`2. npm install`);
  console.log(`3. npm run dev\n`);
}

// Create README file
async function createReadme(projectDir, spec) {
  const content = `# ${spec.name}

${spec.description}

## Project Structure

This project was generated with Sean's MFE Tool based on the provided specification.

### Shell Application
- Name: ${spec.shell.name}
- Port: ${spec.shell.port}

### Remote MFEs
${spec.remotes.map(remote => `- ${remote.name} (Port: ${remote.port})`).join('\n')}

### APIs
${spec.apis.map(api => `- ${api.name} (Port: ${api.port}, Database: ${api.database})`).join('\n')}

## Getting Started

1. Install dependencies:
   \`\`\`
   npm install
   \`\`\`

2. Start development server:
   \`\`\`
   npm run dev
   \`\`\`

3. Build for production:
   \`\`\`
   npm run build
   \`\`\`

## Deployment

See the deployment configuration in the specification file.

## Metadata

- Author: ${spec.metadata.author}
- Created: ${spec.metadata.createdAt}
- Organization: ${spec.metadata.organization}
- Tags: ${spec.metadata.tags.join(', ')}
`;

  if (!dryRun) {
    await fs.writeFile(path.join(projectDir, 'README.md'), content);
  }
  console.log(chalk.green('✓ Created README.md'));
}

// Implement the rest of the functions from the previous implementation here...
// generateShell, generateRemotes, generateAPIs, etc.

// Call the main function
main();
