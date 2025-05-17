// src/utils/MFEGenerator/index.js
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

const specValidator = require('./spec-validator');
const utils = require('./utils');

// Import functions from implementation and update files
const implementation = require('./implementation');
const updateFunctions = require('./update-functions');

// Annotation constants
const ANNOTATION_START = '/* MFE-GENERATOR:START */';
const ANNOTATION_END = '/* MFE-GENERATOR:END */';
const ANNOTATION_ID_PREFIX = '/* MFE-GENERATOR:ID:';
const ANNOTATION_ID_SUFFIX = ' */';

// Parse command-line arguments
function parseArgs(args) {
  const cmd = args[0]; // 'generate' or 'update'
  const specPath = args.find(arg => arg.includes('.yaml') || arg.includes('.yml'));
  const outputDir = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || process.cwd();
  const dryRun = args.includes('--dry-run');

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

  return { cmd, specPath, outputDir, dryRun };
}

// Load and parse the MFE specification
async function loadSpec(specPath) {
  try {
    const yamlContent = await fs.readFile(specPath, 'utf8');
    const spec = yaml.load(yamlContent);
    
    // Validate the spec
    specValidator.validateSpec(spec);
    
    return spec;
  } catch (error) {
    console.error(chalk.red(`Error loading specification: ${error.message}`));
    process.exit(1);
  }
}

// Run the generator
async function run(args) {
  try {
    const { cmd, specPath, outputDir, dryRun } = parseArgs(args);
    
    if (cmd === 'generate') {
      // Load spec
      const spec = await loadSpec(specPath);
      
      // Generate new MFE project
      await generateMFE(spec, outputDir, dryRun);
    }
    else if (cmd === 'update') {
      // Load spec
      const newSpec = await loadSpec(specPath);
      
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
      await updateMFE(projectDir, newSpec, changes, dryRun);
      
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
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
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
async function updateAnnotatedFile(filePath, sectionUpdates, dryRun) {
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

// Generate a new MFE project
async function generateMFE(spec, outputDir, dryRun) {
  console.log(chalk.blue(`\nGenerating MFE project: ${spec.name}`));
  console.log(chalk.gray('Description: ' + (spec.description || 'No description provided')));
  
  // Create project root directory
  const projectDir = path.join(outputDir, spec.name);
  await fs.ensureDir(projectDir);
  
  // Create README file
  await implementation.createReadme(projectDir, spec, dryRun);
  
  // Generate shell application
  await implementation.generateShell(projectDir, spec, dryRun);
  
  // Generate remote MFEs
  await implementation.generateRemotes(projectDir, spec, dryRun);
  
  // Generate APIs
  await implementation.generateAPIs(projectDir, spec, dryRun);
  
  // Create package.json for workspace
  await implementation.createWorkspacePackage(projectDir, spec, dryRun);
  
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

// Update an existing MFE project
async function updateMFE(projectDir, spec, changes, dryRun) {
  console.log(chalk.blue(`\nUpdating MFE project: ${spec.name}`));
  
  // Create project directory if it doesn't exist
  await fs.ensureDir(projectDir);
  
  // Update shell if needed
  if (changes.shell.nameChanged || changes.shell.portChanged || changes.shell.themeChanged || 
      changes.remotes.added.length > 0 || changes.remotes.removed.length > 0 || changes.remotes.modified.length > 0) {
    await updateFunctions.updateShell(projectDir, spec, changes, dryRun);
  }
  
  // Update remotes
  for (const remote of changes.remotes.added) {
    await updateFunctions.updateRemoteMFE(projectDir, remote, dryRun);
  }
  
  for (const remote of changes.remotes.modified) {
    await updateFunctions.updateRemoteMFE(projectDir, remote, dryRun);
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
    await updateFunctions.updateAPI(projectDir, api, dryRun);
  }
  
  for (const api of changes.apis.modified) {
    await updateFunctions.updateAPI(projectDir, api, dryRun);
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
  await implementation.createWorkspacePackage(projectDir, spec, dryRun);
  
  console.log(chalk.green(`\n✓ MFE project ${spec.name} updated successfully!`));
}

// Export public API
module.exports = {
  run,
  parseArgs,
  loadSpec,
  detectChanges,
  findAnnotatedSections,
  updateAnnotatedFile,
  generateMFE,
  updateMFE,
  ANNOTATION_START,
  ANNOTATION_END,
  ANNOTATION_ID_PREFIX,
  ANNOTATION_ID_SUFFIX
};
