// src/utils/MFEGenerator/update-functions.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');
const diff = require('diff');
const babel = require('@babel/core');
const babelParser = require('@babel/parser');
const babelTraverse = require('@babel/traverse').default;
const babelGenerate = require('@babel/generator').default;

// Import implementation functions
const implementation = require('./implementation');

// Constants (should be the same as in index.js)
const ANNOTATION_START = '/* MFE-GENERATOR:START */';
const ANNOTATION_END = '/* MFE-GENERATOR:END */';
const ANNOTATION_ID_PREFIX = '/* MFE-GENERATOR:ID:';
const ANNOTATION_ID_SUFFIX = ' */';

// Update shell application
async function updateShell(projectDir, spec, changes, dryRun) {
  console.log(chalk.blue(`\nUpdating shell application: ${spec.shell.name}`));
  
  const shellDir = path.join(projectDir, spec.shell.name);
  
  // Check if shell directory exists
  if (!await fs.pathExists(shellDir)) {
    console.log(chalk.yellow(`Shell directory ${shellDir} does not exist, creating it...`));
    
    if (!dryRun) {
      // Build the remotes configuration
      const remotesConfig = {};
      if (spec.remotes) {
        spec.remotes.forEach(remote => {
          remotesConfig[remote.name] = `http://localhost:${remote.port}/remoteEntry.js`;
        });
      }
      
      // Create a new shell
      try {
        execSync(`npx seans-mfe-tool shell ${spec.shell.name} --port ${spec.shell.port} --remotes '${JSON.stringify(remotesConfig)}'`, { 
          cwd: projectDir,
          stdio: 'inherit'
        });
        
        // Add annotations for future updates
        await implementation.annotateShellConfig(shellDir, remotesConfig);
        
        // Customize theme if specified
        if (spec.shell.theme) {
          await implementation.customizeTheme(shellDir, spec.shell.theme);
        }
      } catch (error) {
        console.error(chalk.red(`Error creating shell: ${error.message}`));
        return false;
      }
    }
    
    return true;
  }
  
  // Update port if needed
  if (changes.shell && changes.shell.portChanged) {
    const configPath = path.join(shellDir, 'rspack.config.js');
    if (await fs.pathExists(configPath)) {
      let configContent = await fs.readFile(configPath, 'utf8');
      
      // Update port using regex
      const portUpdated = configContent.replace(
        /port:\s*\d+/,
        `port: ${spec.shell.port}`
      );
      
      if (portUpdated !== configContent && !dryRun) {
        await fs.writeFile(configPath, portUpdated);
        console.log(chalk.green(`✓ Updated port to ${spec.shell.port} in shell application`));
      }
    }
  }
  
  // Update remotes configuration if remotes were added, removed, or modified
  if ((changes.remotes.added && changes.remotes.added.length > 0) || 
      (changes.remotes.removed && changes.remotes.removed.length > 0) || 
      (changes.remotes.modified && changes.remotes.modified.length > 0)) {
    // Build the remotes configuration
    const remotesConfig = {};
    if (spec.remotes) {
      spec.remotes.forEach(remote => {
        remotesConfig[remote.name] = `http://localhost:${remote.port}/remoteEntry.js`;
      });
    }
    
    const configPath = path.join(shellDir, 'rspack.config.js');
    if (await fs.pathExists(configPath)) {
      let configContent = await fs.readFile(configPath, 'utf8');
      
      // Check if file is already annotated
      if (configContent.includes(ANNOTATION_START) && configContent.includes(ANNOTATION_ID_PREFIX + 'remotes')) {
        // Update existing annotation
        await updateAnnotatedFile(configPath, {
          'remotes': JSON.stringify(remotesConfig, null, 6)
            .replace(/"/g, "'")
            .replace(/},/g, '},')
            .replace(/'/g, '"')
        }, dryRun);
      } else {
        // Try to annotate the file now
        await implementation.annotateShellConfig(shellDir, remotesConfig);
      }
    }
  }
  
  // Update theme if needed
  if (changes.shell && changes.shell.themeChanged && spec.shell.theme) {
    await implementation.customizeTheme(shellDir, spec.shell.theme);
  }
  
  console.log(chalk.green(`✓ Shell application updated successfully`));
  return true;
}

// Update remote MFE
async function updateRemoteMFE(projectDir, remote, dryRun) {
  console.log(chalk.blue(`\nUpdating remote MFE: ${remote.name}`));
  
  const remoteDir = path.join(projectDir, remote.name);
  
  // Check if this remote exists
  if (!await fs.pathExists(remoteDir)) {
    console.log(chalk.yellow(`Remote directory ${remoteDir} does not exist, creating it...`));
    
    if (!dryRun) {
      try {
        // Create a new remote
        await implementation.createRemoteMFE(projectDir, remote);
      } catch (error) {
        console.error(chalk.red(`Error creating remote MFE ${remote.name}: ${error.message}`));
        throw error;
      }
    } else {
      console.log(chalk.yellow(`[DRY RUN] Would create remote MFE: ${remote.name}`));
    }
    
    return true;
  }
  
  // Update the port if needed
  const configPath = path.join(remoteDir, 'rspack.config.js');
  if (await fs.pathExists(configPath)) {
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Update port using regex
    const updatedPort = configContent.replace(
      /port:\s*\d+/,
      `port: ${remote.port}`
    );
    
    if (updatedPort !== configContent && !dryRun) {
      await fs.writeFile(configPath, updatedPort);
      console.log(chalk.green(`✓ Updated port to ${remote.port} in ${remote.name}`));
    }
  }
  
  // Fix package.json if needed
  await implementation.fixRemotePackageJson(remoteDir, remote.dependencies?.['@mui/material'] || '5.15.0');
  
  // Update components
  if (remote.exposedComponents) {
    await updateRemoteComponents(remoteDir, remote, dryRun);
  }
  
  console.log(chalk.green(`✓ Remote MFE ${remote.name} updated successfully`));
  return true;
}

// Update remote components
async function updateRemoteComponents(remoteDir, remote, dryRun) {
  const componentsDir = path.join(remoteDir, 'src', 'components');
  await fs.ensureDir(componentsDir);
  
  // Track existing components and new components
  const existingComponents = new Set(
    (await fs.pathExists(componentsDir)) 
      ? (await fs.readdir(componentsDir))
          .filter(file => file.endsWith('.jsx'))
          .map(file => file.replace(/\.jsx$/, ''))
      : []
  );
  
  const componentNames = remote.exposedComponents.map(c => c.name);
  const addedComponents = [];
  const updatedComponents = [];
  
  // Create/update components
  for (const component of remote.exposedComponents) {
    const componentName = component.name;
    const componentPath = path.join(componentsDir, `${componentName}.jsx`);
    
    if (existingComponents.has(componentName)) {
      // Update existing component if it has annotations
      if (await fs.pathExists(componentPath)) {
        const existingContent = await fs.readFile(componentPath, 'utf8');
        
        if (existingContent.includes(ANNOTATION_START)) {
          await updateAnnotatedFile(componentPath, {
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
          }, dryRun);
          
          updatedComponents.push(componentName);
        }
      }
    } else {
      // Create new component
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

      if (!dryRun) {
        await fs.writeFile(componentPath, componentContent);
      }
      addedComponents.push(componentName);
    }
  }
  
  // Update App.jsx with the components
  await updateAppJsx(remoteDir, remote, dryRun);
  
  // Update bootstrap.jsx to export components
  await updateBootstrapJsx(remoteDir, remote, dryRun);
  
  // Update rspack.config.js with Module Federation configuration
  await updateRspackConfig(remoteDir, remote, dryRun);
  
  if (addedComponents.length > 0) {
    console.log(chalk.green(`✓ Added components: ${addedComponents.join(', ')}`));
  }
  
  if (updatedComponents.length > 0) {
    console.log(chalk.green(`✓ Updated components: ${updatedComponents.join(', ')}`));
  }
  
  return { addedComponents, updatedComponents };
}

// Update App.jsx to import and use components
async function updateAppJsx(remoteDir, remote, dryRun) {
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
    }, dryRun);
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
async function updateBootstrapJsx(remoteDir, remote, dryRun) {
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
  
  // Find annotated sections
  const sections = findAnnotatedSections(bootstrapContent);
  const exportsSection = sections.find(s => s.id === 'exports');
  
  if (exportsSection) {
    // Update existing annotated section
    return await updateAnnotatedFile(bootstrapPath, {
      'exports': '// Export components for Module Federation\n' + componentExports
    }, dryRun);
  } else if (bootstrapContent.includes(ANNOTATION_START)) {
    // Has annotations but no exports section
    const lines = bootstrapContent.split('\n');
    const newContent = [...lines];
    
    // Add exports section at the end
    newContent.push(`
${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exports${ANNOTATION_ID_SUFFIX}
// Export components for Module Federation
${componentExports}
${ANNOTATION_END}
`);
    
    if (!dryRun) {
      await fs.writeFile(bootstrapPath, newContent.join('\n'));
    }
    console.log(chalk.green(`✓ Added exports to bootstrap.jsx in ${remote.name}`));
    return true;
  } else {
    // No annotations, add at the end
    const newContent = `${bootstrapContent.trim()}

${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exports${ANNOTATION_ID_SUFFIX}
// Export components for Module Federation
${componentExports}
${ANNOTATION_END}
`;
    
    if (!dryRun) {
      await fs.writeFile(bootstrapPath, newContent);
    }
    console.log(chalk.green(`✓ Added exports to bootstrap.jsx in ${remote.name}`));
    return true;
  }
}

// Update rspack.config.js with Module Federation configuration
async function updateRspackConfig(remoteDir, remote, dryRun) {
  const configPath = path.join(remoteDir, 'rspack.config.js');
  
  if (!await fs.pathExists(configPath)) {
    console.log(chalk.yellow(`rspack.config.js not found in ${remoteDir}, skipping update`));
    return false;
  }
  
  // Generate the exposes config
  const exposesConfig = remote.exposedComponents.reduce((acc, component) => {
    acc[`./${component.path || component.name}`] = `./src/components/${component.name}.jsx`;
    return acc;
  }, { './App': './src/App.jsx' });
  
  // Format the exposes config for readability
  const exposesStr = JSON.stringify(exposesConfig, null, 6)
    .replace(/"/g, "'")
    .replace(/'},/g, "'},")
    .replace(/'/g, '"');
  
  // Read the config file
  let configContent = await fs.readFile(configPath, 'utf8');
  
  // Check if file has annotations for the exposes section
  if (configContent.includes(ANNOTATION_START) && configContent.includes(ANNOTATION_ID_PREFIX + 'exposes')) {
    // Update existing annotation
    return await updateAnnotatedFile(configPath, {
      'exposes': exposesStr
    }, dryRun);
  } else {
    // No annotations, try to use AST for more precision
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
    
    // Fallback: try simple regex replacement
    const exposesRegex = /exposes:\s*{[^}]*}/s;
    if (exposesRegex.test(configContent)) {
      const replaced = configContent.replace(
        exposesRegex,
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
}

// Update API
async function updateAPI(projectDir, api, dryRun) {
  console.log(chalk.blue(`\nUpdating API: ${api.name}`));
  
  const apiDir = path.join(projectDir, api.name);
  
  // Check if API directory exists
  if (!await fs.pathExists(apiDir)) {
    console.log(chalk.yellow(`API directory ${apiDir} does not exist, creating it...`));
    
    if (!dryRun) {
      // Create a new API
      try {
        const apiSpecPath = path.resolve(process.cwd(), api.spec);
        
        if (!await fs.pathExists(apiSpecPath)) {
          console.log(chalk.yellow(`API spec file not found: ${apiSpecPath}`));
          return false;
        }
        
        execSync(
          `npx seans-mfe-tool api ${api.name} --port ${api.port} --database ${api.database} --spec ${apiSpecPath}`, 
          { 
            cwd: projectDir,
            stdio: 'inherit'
          }
        );
      } catch (error) {
        console.error(chalk.red(`Error creating API ${api.name}: ${error.message}`));
        return false;
      }
    }
    
    return true;
  }
  
  // Update port if needed
  const configPath = path.join(apiDir, 'src', 'config.js');
  if (await fs.pathExists(configPath)) {
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Update port using regex
    const portUpdated = configContent.replace(
      /port:\s*\d+/,
      `port: ${api.port}`
    );
    
    if (portUpdated !== configContent && !dryRun) {
      await fs.writeFile(configPath, portUpdated);
      console.log(chalk.green(`✓ Updated port to ${api.port} in ${api.name}`));
    }
  }
  
  // Update .env file if it exists
  const envPath = path.join(apiDir, '.env');
  if (await fs.pathExists(envPath)) {
    let envContent = await fs.readFile(envPath, 'utf8');
    
    // Update port in .env
    const envUpdated = envContent.replace(
      /PORT=\d+/,
      `PORT=${api.port}`
    );
    
    if (envUpdated !== envContent && !dryRun) {
      await fs.writeFile(envPath, envUpdated);
      console.log(chalk.green(`✓ Updated port in .env file for ${api.name}`));
    }
  }
  
  // If the database or spec has changed, we need to regenerate models and controllers
  // This is a more complex operation that may require preserving custom changes
  // For now, just warn the user
  if (api.spec || api.database) {
    console.log(chalk.yellow(`Note: Changes to API database or spec may require manual updates or regeneration`));
    console.log(chalk.yellow(`Consider running: npx seans-mfe-tool api ${api.name} --port ${api.port} --database ${api.database} --spec ${api.spec}`));
  }
  
  console.log(chalk.green(`✓ API ${api.name} updated successfully`));
  return true;
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

module.exports = {
  updateShell,
  updateRemoteMFE,
  updateRemoteComponents,
  updateAppJsx,
  updateBootstrapJsx,
  updateRspackConfig,
  updateAPI,
  findAnnotatedSections,
  updateAnnotatedFile
};
