// Update shell application
async function updateShell(projectDir, spec, changes) {
  console.log(chalk.blue(`\nUpdating shell application: ${spec.shell.name}`));
  
  const shellDir = path.join(projectDir, spec.shell.name);
  
  // Check if shell directory exists
  if (!await fs.pathExists(shellDir)) {
    console.log(chalk.yellow(`Shell directory ${shellDir} does not exist, creating it...`));
    
    if (!dryRun) {
      // Build the remotes configuration
      const remotesConfig = {};
      spec.remotes.forEach(remote => {
        remotesConfig[remote.name] = `http://localhost:${remote.port}/remoteEntry.js`;
      });
      
      // Create a new shell
      try {
        execSync(`npx seans-mfe-tool shell ${spec.shell.name} --port ${spec.shell.port} --remotes '${JSON.stringify(remotesConfig)}'`, { 
          cwd: projectDir,
          stdio: 'inherit'
        });
        
        // Add annotations for future updates
        await annotateShellConfig(shellDir, remotesConfig);
        
        // Customize theme if specified
        if (spec.shell.theme) {
          await customizeTheme(shellDir, spec.shell.theme);
        }
      } catch (error) {
        console.error(chalk.red(`Error creating shell: ${error.message}`));
        return false;
      }
    }
    
    return true;
  }
  
  // Update port if needed
  if (changes.shell.portChanged) {
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
  if (changes.remotes.added.length > 0 || changes.remotes.removed.length > 0 || changes.remotes.modified.length > 0) {
    // Build the remotes configuration
    const remotesConfig = {};
    spec.remotes.forEach(remote => {
      remotesConfig[remote.name] = `http://localhost:${remote.port}/remoteEntry.js`;
    });
    
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
        });
      } else {
        // Try to annotate the file now
        await annotateShellConfig(shellDir, remotesConfig);
      }
    }
  }
  
  // Update theme if needed
  if (changes.shell.themeChanged && spec.shell.theme) {
    await customizeTheme(shellDir, spec.shell.theme);
  }
  
  console.log(chalk.green(`✓ Shell application updated successfully`));
  return true;
}

// Update an existing remote MFE
async function updateRemoteMFE(projectDir, remote) {
  console.log(chalk.blue(`\nUpdating remote MFE: ${remote.name}`));
  
  const remoteDir = path.join(projectDir, remote.name);
  
  // Check if this remote exists
  if (!await fs.pathExists(remoteDir)) {
    console.log(chalk.yellow(`Remote directory ${remoteDir} does not exist, creating it...`));
    
    if (!dryRun) {
      // Create a new remote instead
      try {
        execSync(
          `npx seans-mfe-tool remote ${remote.name} --port ${remote.port} --mui-version ${remote.dependencies['@mui/material'] || '5.15.0'}`, 
          { 
            cwd: projectDir,
            stdio: 'inherit'
          }
        );
        
        // Generate component files
        await generateComponents(remoteDir, remote);
      } catch (error) {
        console.error(chalk.red(`Error creating remote MFE ${remote.name}: ${error.message}`));
        return false;
      }
    }
    
    return true;
  }
  
  // Update the port if needed
  const configPath = path.join(remoteDir, 'rspack.config.js');
  if (await fs.pathExists(configPath)) {
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Update port using regex
    const portUpdated = configContent.replace(
      /port:\s*\d+/,
      `port: ${remote.port}`
    );
    
    if (portUpdated !== configContent && !dryRun) {
      await fs.writeFile(configPath, portUpdated);
      console.log(chalk.green(`✓ Updated port to ${remote.port} in ${remote.name}`));
    }
  }
  
  // Update components
  const componentChanges = await updateRemoteComponents(remoteDir, remote);
  
  // Update App.jsx with the components
  await updateAppJsx(remoteDir, remote, componentChanges);
  
  // Update bootstrap.jsx to export components
  await updateBootstrapJsx(remoteDir, remote);
  
  // Update rspack.config.js with Module Federation configuration
  await updateRspackConfig(remoteDir, remote);
  
  console.log(chalk.green(`✓ Remote MFE ${remote.name} updated successfully`));
  return true;
}

// Update API
async function updateAPI(projectDir, api) {
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
  
  // If the database or spec has changed, we need to regenerate models and controllers
  // This requires a more complex approach to preserve custom changes
  // For now, we'll just warn the user
  if (api.spec || api.database) {
    console.log(chalk.yellow(`Note: Changes to API database or spec require manual updates or regeneration`));
    console.log(chalk.yellow(`Consider running: npx seans-mfe-tool api ${api.name} --port ${api.port} --database ${api.database} --spec ${api.spec}`));
  }
  
  console.log(chalk.green(`✓ API ${api.name} updated successfully`));
  return true;
}

// Update workspace package.json
async function updateWorkspacePackage(projectDir, spec) {
  const packagePath = path.join(projectDir, 'package.json');
  
  if (!await fs.pathExists(packagePath)) {
    console.log(chalk.yellow(`Workspace package.json not found, creating it...`));
    
    const packageJson = {
      name: spec.name,
      version: '1.0.0',
      private: true,
      workspaces: [
        spec.shell.name,
        ...spec.remotes.map(remote => remote.name),
        ...spec.apis.map(api => api.name)
      ],
      scripts: {
        dev: 'concurrently ' + [
          `"npm run dev --workspace=${spec.shell.name}"`,
          ...spec.remotes.map(remote => `"npm run dev --workspace=${remote.name}"`),
          ...spec.apis.map(api => `"npm run dev --workspace=${api.name}"`)
        ].join(' '),
        build: 'npm run build --workspaces',
        start: 'concurrently ' + [
          `"npm run start --workspace=${spec.shell.name}"`,
          ...spec.remotes.map(remote => `"npm run start --workspace=${remote.name}"`),
          ...spec.apis.map(api => `"npm run start --workspace=${api.name}"`)
        ].join(' ')
      },
      devDependencies: {
        concurrently: "^8.2.0"
      }
    };
    
    if (!dryRun) {
      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
    }
    
    console.log(chalk.green('✓ Created workspace package.json'));
    return true;
  }
  
  // Update existing package.json
  try {
    const packageJson = await fs.readJson(packagePath);
    
    // Update workspaces
    packageJson.workspaces = [
      spec.shell.name,
      ...spec.remotes.map(remote => remote.name),
      ...spec.apis.map(api => api.name)
    ];
    
    // Update scripts
    packageJson.scripts = packageJson.scripts || {};
    
    packageJson.scripts.dev = 'concurrently ' + [
      `"npm run dev --workspace=${spec.shell.name}"`,
      ...spec.remotes.map(remote => `"npm run dev --workspace=${remote.name}"`),
      ...spec.apis.map(api => `"npm run dev --workspace=${api.name}"`)
    ].join(' ');
    
    packageJson.scripts.start = 'concurrently ' + [
      `"npm run start --workspace=${spec.shell.name}"`,
      ...spec.remotes.map(remote => `"npm run start --workspace=${remote.name}"`),
      ...spec.apis.map(api => `"npm run start --workspace=${api.name}"`)
    ].join(' ');
    
    if (!dryRun) {
      await fs.writeJson(packagePath, packageJson, { spaces: 2 });
    }
    
    console.log(chalk.green('✓ Updated workspace package.json'));
    return true;
  } catch (error) {
    console.error(chalk.red(`Error updating package.json: ${error.message}`));
    return false;
  }
}

// Extract AST from a file and find specific nodes
async function extractAST(filePath, nodeSelector) {
  if (!await fs.pathExists(filePath)) {
    return null;
  }
  
  const content = await fs.readFile(filePath, 'utf8');
  
  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    
    let result = null;
    
    babelTraverse(ast, {
      enter(path) {
        if (nodeSelector(path)) {
          result = path;
        }
      }
    });
    
    return result;
  } catch (error) {
    console.log(chalk.yellow(`AST parsing failed for ${filePath}: ${error.message}`));
    return null;
  }
}

// Helper function to modify AST and save back to file
async function modifyAST(filePath, nodeSelector, modifier) {
  if (!await fs.pathExists(filePath)) {
    return false;
  }
  
  const content = await fs.readFile(filePath, 'utf8');
  
  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    
    let modified = false;
    
    babelTraverse(ast, {
      enter(path) {
        if (nodeSelector(path)) {
          modifier(path);
          modified = true;
        }
      }
    });
    
    if (modified) {
      const output = babelGenerate(ast);
      
      if (!dryRun) {
        await fs.writeFile(filePath, output.code);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.log(chalk.yellow(`AST modification failed for ${filePath}: ${error.message}`));
    return false;
  }
}

// Helper function to get nice diffs for debugging
function getDiff(oldContent, newContent) {
  const changes = diff.diffLines(oldContent, newContent);
  let diffOutput = '';
  
  changes.forEach(change => {
    const prefix = change.added ? '+' : (change.removed ? '-' : ' ');
    const color = change.added ? 'green' : (change.removed ? 'red' : 'gray');
    
    change.value.split('\n').forEach(line => {
      if (line.trim()) {
        diffOutput += `${prefix} ${line}\n`;
      }
    });
  });
  
  return diffOutput;
}
