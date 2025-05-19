// src/utils/MFEGenerator/implementation.js
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Annotation constants imported from index.js
const ANNOTATION_START = '/* MFE-GENERATOR:START */';
const ANNOTATION_END = '/* MFE-GENERATOR:END */';
const ANNOTATION_ID_PREFIX = '/* MFE-GENERATOR:ID:';
const ANNOTATION_ID_SUFFIX = ' */';

// Create README file
async function createReadme(projectDir, spec, dryRun) {
  const content = `# ${spec.name}

${spec.description || ''}

## Project Structure

This project was generated with Sean's MFE Tool based on the provided specification.

### Shell Application
- Name: ${spec.shell.name}
- Port: ${spec.shell.port}

### Remote MFEs
${spec.remotes ? spec.remotes.map(remote => `- ${remote.name} (Port: ${remote.port})`).join('\n') : 'None defined'}

### APIs
${spec.apis ? spec.apis.map(api => `- ${api.name} (Port: ${api.port}, Database: ${api.database})`).join('\n') : 'None defined'}

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

${spec.metadata ? Object.entries(spec.metadata)
    .filter(([key, value]) => typeof value !== 'object')
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')
  : 'No metadata provided'}
`;

  if (!dryRun) {
    await fs.writeFile(path.join(projectDir, 'README.md'), content);
  }
  console.log(chalk.green('✓ Created README.md'));
}

// Create a shell application directly (bypassing the seans-mfe-tool command)
async function createShellApp(projectDir, shell, remotesConfig) {
  const shellDir = path.join(projectDir, shell.name);
  
  // Create directory structure
  await fs.ensureDir(path.join(shellDir, 'src'));
  await fs.ensureDir(path.join(shellDir, 'public'));
  
  // Create package.json
  const packageJson = {
    "name": shell.name,
    "version": "1.0.0",
    "scripts": {
      "start": "rspack serve",
      "build": "rspack build",
      "dev": "rspack serve"
    },
    "dependencies": {
      "@emotion/react": "^11.11.1",
      "@emotion/styled": "^11.11.0",
      "@mui/material": "^5.15.0",
      "@mui/system": "^5.15.0",
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    },
    "devDependencies": {
      "@rspack/cli": "^1.1.0",
      "@rspack/core": "^1.1.0"
    }
  };
  
  // Add additional dependencies from spec
  if (shell.dependencies) {
    for (const [name, version] of Object.entries(shell.dependencies)) {
      packageJson.dependencies[name] = version;
    }
  }
  
  await fs.writeJson(path.join(shellDir, 'package.json'), packageJson, { spaces: 2 });
  
  // Format remotes config with proper indentation for rspack config
  const remotesStr = JSON.stringify(remotesConfig, null, 6)
    .replace(/"/g, "'")
    .replace(/},/g, '},')
    .replace(/'/g, '"');
  
  // Create rspack.config.js
  const rspackConfig = `const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  context: __dirname,
  entry: {
    main: './src/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    publicPath: 'auto',
    clean: true,
  },
  mode: "development",
  target: "web",
  module: {
    rules: [
      {
        test: /\\.jsx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "ecmascript",
                jsx: true
              },
              transform: {
                react: {
                  runtime: "automatic"
                }
              }
            }
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [".js", ".jsx", ".json"]
  },
  devServer: {
    port: ${shell.port},
    host: 'localhost',
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/'
    },
    devMiddleware: {
      publicPath: '/'
    }
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: "shell",
      filename: "remoteEntry.js",
      remotes: ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}remotes${ANNOTATION_ID_SUFFIX}
      ${remotesStr}
      ${ANNOTATION_END},
      shared: {
        react: { singleton: true, eager: true },
        "react-dom": { singleton: true, eager: true },
        "@mui/material": { singleton: true },
        "@mui/system": { singleton: true },
        "@emotion/react": { singleton: true },
        "@emotion/styled": { singleton: true }
      }
    })
  ],
  optimization: {
    moduleIds: 'named',
    chunkIds: 'named'
  }
};`;

  await fs.writeFile(path.join(shellDir, 'rspack.config.js'), rspackConfig);
  
  // Create public/index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${shell.name}</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`;

  await fs.writeFile(path.join(shellDir, 'public', 'index.html'), indexHtml);
  
  // Create index.js
  const indexJs = `// src/index.js
import('./bootstrap');`;

  await fs.writeFile(path.join(shellDir, 'src', 'index.js'), indexJs);
  
  // Create bootstrap.jsx
  const bootstrapJsx = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const mount = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

mount();`;

  await fs.writeFile(path.join(shellDir, 'src', 'bootstrap.jsx'), bootstrapJsx);
  
  // Create App.jsx
  const themeConfig = shell.theme || { 
    mode: 'light', 
    primaryColor: '#1976d2', 
    secondaryColor: '#dc004e' 
  };
  
  const appJsx = `import * as React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

const theme = createTheme({
  ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}theme${ANNOTATION_ID_SUFFIX}
  palette: {
    mode: '${themeConfig.mode || 'light'}',
    primary: {
      main: '${themeConfig.primaryColor || '#1976d2'}',
    },
    secondary: {
      main: '${themeConfig.secondaryColor || '#dc004e'}',
    },
  }
  ${ANNOTATION_END}
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              ${shell.name}
            </Typography>
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ mt: 4, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to ${shell.name}
          </Typography>
          <Typography variant="body1">
            Your Module Federation shell is running on port ${shell.port}.
          </Typography>
          ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}remote-components${ANNOTATION_ID_SUFFIX}
          ${ANNOTATION_END}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;`;

  await fs.writeFile(path.join(shellDir, 'src', 'App.jsx'), appJsx);
  
  // Install dependencies
  console.log(chalk.blue(`Installing dependencies for ${shell.name}...`));
  try {
    execSync('npm install', { 
      cwd: shellDir, 
      stdio: 'inherit',
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
    });
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Error installing dependencies for ${shell.name}: ${error.message}`));
    // Continue anyway - we've generated the files
  }
  
  return shellDir;
}



// Update the shell app with remote component imports and usage
async function updateShellWithRemotes(shellDir, remotes) {
  if (!remotes || remotes.length === 0) {
    return;
  }
  
  const appJsxPath = path.join(shellDir, 'src', 'App.jsx');
  
  if (await fs.pathExists(appJsxPath)) {
    // Read the current App.jsx file
    let appContent = await fs.readFile(appJsxPath, 'utf8');
    
    // Generate import statements for remotes
    const imports = remotes.map(remote => {
      // For each remote, we need to import its App component
      return `const ${remote.name}App = React.lazy(() => import('${remote.name}/App'));`;
    }).join('\n');
    
    // Add the imports at the top of the file after the first React import
    appContent = appContent.replace(
      /(import \* as React from 'react';)/,
      `$1\n\n// Dynamic imports from remote MFEs\n${imports}`
    );
    
    // Generate component usage
    const componentUsage = remotes.map(remote => `
          <Typography variant="h6" sx={{ mt: 2 }}>
            Remote: ${remote.name}
          </Typography>
          <React.Suspense fallback={<div>Loading ${remote.name}...</div>}>
            <${remote.name}App />
          </React.Suspense>`
    ).join('\n');
    
    // Replace the annotated section for remote components
    appContent = appContent.replace(
      new RegExp(`${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}remote-components${ANNOTATION_ID_SUFFIX}[\\s\\S]*?${ANNOTATION_END}`),
      `${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}remote-components${ANNOTATION_ID_SUFFIX}
          ${componentUsage}
          ${ANNOTATION_END}`
    );
    
    await fs.writeFile(appJsxPath, appContent);
    console.log(chalk.green(`✓ Updated shell with remote component imports`));
  }
}

// Annotate shell configuration for future updates
async function annotateShellConfig(shellDir, remotesConfig) {
  const configPath = path.join(shellDir, 'rspack.config.js');
  
  if (await fs.pathExists(configPath)) {
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Format remotes config with proper indentation
    const remotesStr = JSON.stringify(remotesConfig, null, 6)
      .replace(/"/g, "'")
      .replace(/},/g, '},')
      .replace(/'/g, '"');
    
    // Add annotations to remotes section
    const annotatedConfig = configContent.replace(
      /(remotes:)\s*({[^}]*})/s,
      `$1 ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}remotes${ANNOTATION_ID_SUFFIX}
      ${remotesStr}
      ${ANNOTATION_END}`
    );
    
    if (annotatedConfig !== configContent) {
      await fs.writeFile(configPath, annotatedConfig);
      console.log(chalk.green(`✓ Annotated shell configuration file`));
    }
  }
}

// Customize theme for shell or remote
async function customizeTheme(appDir, theme) {
  const appJsxPath = path.join(appDir, 'src', 'App.jsx');
  
  if (await fs.pathExists(appJsxPath)) {
    let appContent = await fs.readFile(appJsxPath, 'utf8');
    
    // Check if already annotated
    if (appContent.includes(ANNOTATION_START) && appContent.includes(ANNOTATION_ID_PREFIX + 'theme')) {
      // Update existing annotated theme
      const sections = findAnnotatedSections(appContent);
      const themeSection = sections.find(s => s.id === 'theme');
      
      if (themeSection) {
        const updatedContent = appContent.replace(
          appContent.substring(themeSection.startLine, themeSection.endLine + 1),
          `${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}theme${ANNOTATION_ID_SUFFIX}
  palette: {
    mode: '${theme.mode || 'light'}',
    primary: {
      main: '${theme.primaryColor || '#1976d2'}',
    },
    secondary: {
      main: '${theme.secondaryColor || '#dc004e'}',
    },
  }
  ${ANNOTATION_END}`
        );
        
        await fs.writeFile(appJsxPath, updatedContent);
        console.log(chalk.green(`✓ Updated theme`));
      }
    } else {
      // Add annotation to theme
      const annotatedContent = appContent.replace(
        /(createTheme\({)([^}]*)(}\))/s,
        `$1
  ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}theme${ANNOTATION_ID_SUFFIX}
  palette: {
    mode: '${theme.mode || 'light'}',
    primary: {
      main: '${theme.primaryColor || '#1976d2'}',
    },
    secondary: {
      main: '${theme.secondaryColor || '#dc004e'}',
    },
  }
  ${ANNOTATION_END}
$3`
      );
      
      if (annotatedContent !== appContent) {
        await fs.writeFile(appJsxPath, annotatedContent);
        console.log(chalk.green(`✓ Customized theme`));
      }
    }
  }
}

//Corrected rspack config generation with proper Module Federation remote format
function generateRspackConfig(shellName, port, remotesConfig) {
  // Create a clean object for remotes configuration with proper format:
  // "remoteName": "remoteName@http://localhost:port/remoteEntry.js"
  let remotesObj = {};
  
  if (remotesConfig && Object.keys(remotesConfig).length > 0) {
    remotesObj = Object.fromEntries(
      Object.entries(remotesConfig).map(([name, url]) => 
        // Format remote as "name": "name@url"
        [name, `${name}@${url}`]
      )
    );
  }
  
  // Return the entire config as a string
  return `const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  context: __dirname,
  entry: {
    main: './src/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    publicPath: 'auto',
    clean: true,
  },
  mode: "development",
  target: "web",
  module: {
    rules: [
      {
        test: /\\.jsx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "ecmascript",
                jsx: true
              },
              transform: {
                react: {
                  runtime: "automatic"
                }
              }
            }
          }
        }
      }
    ]
  },
  resolve: {
    extensions: [".js", ".jsx", ".json"]
  },
  devServer: {
    port: ${port},
    host: 'localhost',
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/'
    },
    devMiddleware: {
      publicPath: '/'
    }
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: "${shellName}",
      filename: "remoteEntry.js",
      remotes: ${JSON.stringify(remotesObj, null, 6)},
      shared: {
        react: { singleton: true, eager: true },
        "react-dom": { singleton: true, eager: true },
        "@mui/material": { singleton: true },
        "@mui/system": { singleton: true },
        "@emotion/react": { singleton: true },
        "@emotion/styled": { singleton: true }
      }
    })
  ],
  optimization: {
    moduleIds: 'named',
    chunkIds: 'named'
  }
};`;
}

// Completely rewritten generateShell function with no annotations in critical parts
async function generateShell(projectDir, spec, dryRun) {
  console.log(chalk.blue(`\nGenerating shell application: ${spec.shell.name}`));
  
  // Build the remotes configuration
  const remotesConfig = {};
  if (spec.remotes) {
    spec.remotes.forEach(remote => {
      remotesConfig[remote.name] = `http://localhost:${remote.port}/remoteEntry.js`;
    });
  }
  
  if (!dryRun) {
    try {
      // Create shell directory
      const shellDir = path.join(projectDir, spec.shell.name);
      await fs.ensureDir(shellDir);
      await fs.ensureDir(path.join(shellDir, 'src'));
      await fs.ensureDir(path.join(shellDir, 'public'));
      
      // Create package.json
      const packageJson = {
        "name": spec.shell.name,
        "version": "1.0.0",
        "scripts": {
          "start": "rspack serve",
          "build": "rspack build",
          "dev": "rspack serve"
        },
        "dependencies": {
          "@emotion/react": "^11.11.1",
          "@emotion/styled": "^11.11.0",
          "@mui/material": "^5.15.0",
          "@mui/system": "^5.15.0",
          "react": "^18.2.0",
          "react-dom": "^18.2.0"
        },
        "devDependencies": {
          "@rspack/cli": "^1.1.0",
          "@rspack/core": "^1.1.0"
        }
      };
      
      // Add additional dependencies from spec
      if (spec.shell.dependencies) {
        for (const [name, version] of Object.entries(spec.shell.dependencies)) {
          packageJson.dependencies[name] = version;
        }
      }
      
      await fs.writeJson(path.join(shellDir, 'package.json'), packageJson, { spaces: 2 });
      
      // Create rspack.config.js with our simplified generator
      const rspackConfig = generateRspackConfig(
        spec.shell.name,
        spec.shell.port,
        remotesConfig
      );
      
      await fs.writeFile(path.join(shellDir, 'rspack.config.js'), rspackConfig);
      
      // Create public/index.html
      const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${spec.shell.name}</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>`;

      await fs.writeFile(path.join(shellDir, 'public', 'index.html'), indexHtml);
      
      // Create index.js
      const indexJs = `// src/index.js
import('./bootstrap');`;

      await fs.writeFile(path.join(shellDir, 'src', 'index.js'), indexJs);
      
      // Create bootstrap.jsx
      const bootstrapJsx = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const mount = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Failed to find root element');
  }
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

mount();`;

      await fs.writeFile(path.join(shellDir, 'src', 'bootstrap.jsx'), bootstrapJsx);
      
      // Process remote app imports for App.jsx
      const remoteImports = [];
      const remoteComponents = [];
      
      if (spec.remotes && spec.remotes.length > 0) {
        for (const remote of spec.remotes) {
          // Convert kebab-case to camelCase for variable names
          const safeVarName = remote.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) + 'App';
          
          remoteImports.push(`const ${safeVarName} = React.lazy(() => import('${remote.name}/App'));`);
          
          remoteComponents.push(`
          <Typography variant="h6" sx={{ mt: 2 }}>
            Remote: ${remote.name}
          </Typography>
          <React.Suspense fallback={<div>Loading ${remote.name}...</div>}>
            <${safeVarName} />
          </React.Suspense>`);
        }
      }
      
      // Create App.jsx with proper imports
      const themeConfig = spec.shell.theme || { 
        mode: 'light', 
        primaryColor: '#1976d2', 
        secondaryColor: '#dc004e' 
      };
      
      const appJsx = `import * as React from 'react';
${remoteImports.length > 0 ? '\n// Dynamic imports from remote MFEs\n' + remoteImports.join('\n') : ''}
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';

const theme = createTheme({
  palette: {
    mode: '${themeConfig.mode || 'light'}',
    primary: {
      main: '${themeConfig.primaryColor || '#1976d2'}',
    },
    secondary: {
      main: '${themeConfig.secondaryColor || '#dc004e'}',
    },
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              ${spec.shell.name}
            </Typography>
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ mt: 4, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome to ${spec.shell.name}
          </Typography>
          <Typography variant="body1">
            Your Module Federation shell is running on port ${spec.shell.port}.
          </Typography>
          ${remoteComponents.join('\n')}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;`;

      await fs.writeFile(path.join(shellDir, 'src', 'App.jsx'), appJsx);
      
      // Install dependencies
      console.log(chalk.blue(`Installing dependencies for ${spec.shell.name}...`));
      try {
        execSync('npm install', { 
          cwd: shellDir, 
          stdio: 'inherit',
          env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
        });
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Error installing dependencies for ${spec.shell.name}: ${error.message}`));
      }
      
      console.log(chalk.green(`✓ Generated shell application: ${spec.shell.name}`));
    } catch (error) {
      console.error(chalk.red(`Error generating shell: ${error.message}`));
      throw error;
    }
  } else {
    console.log(chalk.yellow(`[DRY RUN] Would generate shell application: ${spec.shell.name}`));
  }
}



// Fix package.json after remote MFE creation
async function fixRemotePackageJson(remoteDir, muiVersion) {
  const packageJsonPath = path.join(remoteDir, 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    try {
      // Read the package.json
      const packageJson = await fs.readJson(packageJsonPath);
      
      // Check and fix MUI dependencies
      if (packageJson.dependencies) {
        if (packageJson.dependencies['@mui/material'] === '__MUI_VERSION__') {
          packageJson.dependencies['@mui/material'] = `^${muiVersion}`;
          console.log(chalk.blue(`Fixed @mui/material version in ${path.basename(remoteDir)}/package.json`));
        }
        
        if (packageJson.dependencies['@mui/system'] === '__MUI_VERSION__') {
          packageJson.dependencies['@mui/system'] = `^${muiVersion}`;
          console.log(chalk.blue(`Fixed @mui/system version in ${path.basename(remoteDir)}/package.json`));
        }
      }
      
      // Fix project name if needed
      if (packageJson.name === '__PROJECT_NAME__') {
        packageJson.name = path.basename(remoteDir);
        console.log(chalk.blue(`Fixed project name in ${path.basename(remoteDir)}/package.json`));
      }
      
      // Write the updated package.json
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      console.log(chalk.green(`✓ Fixed package.json in ${path.basename(remoteDir)}`));
      
      // Try installing dependencies again if they were not properly installed
      try {
        console.log(chalk.blue(`Installing dependencies for ${path.basename(remoteDir)}...`));
        execSync('npm install', { 
          cwd: remoteDir, 
          stdio: 'inherit',
          env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
        });
      } catch (installError) {
        console.error(chalk.yellow(`Warning: Error installing dependencies: ${installError.message}`));
        // Continue anyway - we can still generate the components
      }
      
      return true;
    } catch (error) {
      console.error(chalk.yellow(`Warning: Error fixing package.json: ${error.message}`));
      return false;
    }
  }
  
  return false;
}

// Generate remote MFEs
async function generateRemotes(projectDir, spec, dryRun) {
  if (!spec.remotes || spec.remotes.length === 0) {
    console.log(chalk.yellow('No remote MFEs defined in the specification'));
    return;
  }

  console.log(chalk.blue('\nGenerating remote MFEs:'));
  
  for (const remote of spec.remotes) {
    console.log(chalk.blue(`- ${remote.name} (Port: ${remote.port})`));
    
    if (!dryRun) {
      try {
        // Create remote directly instead of using seans-mfe-tool
        await createRemoteMFE(projectDir, remote);
        
        // Generate component files
        await generateComponents(path.join(projectDir, remote.name), remote);
        
        console.log(chalk.green(`✓ Generated remote MFE: ${remote.name}`));
      } catch (error) {
        console.error(chalk.red(`Error generating remote ${remote.name}: ${error.message}`));
        throw error;
      }
    } else {
      console.log(chalk.yellow(`[DRY RUN] Would generate remote MFE: ${remote.name}`));
    }
  }
}

// Create a remote MFE directly (bypassing the seans-mfe-tool command)
async function createRemoteMFE(projectDir, remote) {
  const remoteDir = path.join(projectDir, remote.name);
  
  // Create directory structure
  await fs.ensureDir(path.join(remoteDir, 'src'));
  await fs.ensureDir(path.join(remoteDir, 'public'));
  
  // Extract MUI version
  let muiVersion = '5.15.0';
  if (remote.dependencies && remote.dependencies['@mui/material']) {
    muiVersion = remote.dependencies['@mui/material'].replace(/^[\^~><=]*/, '');
  }
  
  // Create package.json
  const packageJson = {
    "name": remote.name,
    "version": "1.0.0",
    "scripts": {
      "start": "rspack serve",
      "build": "rspack build",
      "dev": "rspack serve",
      "serve": `serve dist -p ${remote.port}`
    },
    "dependencies": {
      "@mui/material": `^${muiVersion}`,
      "@mui/system": `^${muiVersion}`,
      "@emotion/react": "^11.11.1",
      "@emotion/styled": "^11.11.0",
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    },
    "devDependencies": {
      "@rspack/cli": "^0.5.0",
      "@rspack/core": "^0.5.0",
      "path-browserify": "^1.0.1",
      "stream-browserify": "^3.0.0",
      "util": "^0.12.5",
      "url": "^0.11.3",
      "buffer": "^6.0.3",
      "crypto-browserify": "^3.12.0",
      "os-browserify": "^0.3.0",
      "stream-http": "^3.2.0",
      "https-browserify": "^1.0.0",
      "assert": "^2.1.0",
      "process": "^0.11.10",
      "events": "^3.3.0",
      "serve": "^14.2.1"
    }
  };
  
  // Add additional dependencies from spec
  if (remote.dependencies) {
    for (const [name, version] of Object.entries(remote.dependencies)) {
      if (name !== '@mui/material' && name !== '@mui/system') {
        packageJson.dependencies[name] = version;
      }
    }
  }
  
  await fs.writeJson(path.join(remoteDir, 'package.json'), packageJson, { spaces: 2 });
  
  // Create rspack.config.js
  const rspackConfig = `const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = rspack.container;
const path = require('path');

/** @type {import('@rspack/cli').Configuration} */
module.exports = {
  entry: './src/bootstrap.jsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.jsx', '.js', '.json'],
    fallback: {
      "path": require.resolve("path-browserify"),
      "stream": require.resolve("stream-browserify"),
      "util": require.resolve("util/"),
      "url": require.resolve("url/"),
      "buffer": require.resolve("buffer/"),
      "crypto": require.resolve("crypto-browserify"),
      "fs": false,
      "os": require.resolve("os-browserify/browser"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "assert": require.resolve("assert/"),
      "process": require.resolve("process/browser"),
      "events": require.resolve("events/")
    }
  },
  devServer: {
    port: ${remote.port},
    host: '0.0.0.0',
    hot: true,
    historyApiFallback: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
    }
  },
  module: {
    rules: [
      {
        test: /\\.jsx?$/,
        exclude: /node_modules\\/(?!(@huggingface|other-problematic-packages)\\/).*/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'ecmascript',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        },
      },
    ],
  },
  plugins: [
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env': '{}',
      'process.browser': true,
      'process.version': JSON.stringify(process.version),
    }),
    new rspack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    }),
    new rspack.HtmlRspackPlugin({
      template: path.join(__dirname, 'public/index.html'),
      inject: true,
      publicPath: '/'
    }),
    new ModuleFederationPlugin({
      name: "${remote.name}",
      filename: "remoteEntry.js",
      exposes: ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exposes${ANNOTATION_ID_SUFFIX}
      {
        "./App": "./src/App.jsx"
      }
      ${ANNOTATION_END},
      shared: {
        react: { 
          singleton: true, 
          requiredVersion: '^18.2.0',
          eager: true
        },
        'react-dom': { 
          singleton: true, 
          requiredVersion: '^18.2.0',
          eager: true
        },
        '@mui/material': { 
          singleton: false, 
          requiredVersion: '^${muiVersion}',
          eager: false
        },
        '@mui/system': { 
          singleton: false, 
          requiredVersion: '^${muiVersion}',
          eager: false
        },
        '@emotion/react': { 
          singleton: true, 
          requiredVersion: '^11.11.1',
          eager: false
        },
        '@emotion/styled': { 
          singleton: true, 
          requiredVersion: '^11.11.0',
          eager: false
        }
      },
    }),
  ]
};`;

  await fs.writeFile(path.join(remoteDir, 'rspack.config.js'), rspackConfig);
  
  // Create public/index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${remote.name}</title>
    <style>
        body {
            margin: 0;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                        "Helvetica Neue", Arial, sans-serif;
        }
        #root {
            max-width: 1200px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;

  await fs.writeFile(path.join(remoteDir, 'public', 'index.html'), indexHtml);
  
  // Create bootstrap.jsx
  const bootstrapJsx = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const mount = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  return root;
};

// Mount immediately if we're running in standalone mode (not loaded via Module Federation)
if (!window.__POWERED_BY_FEDERATION__) {
  mount('root');
}

export default App;
export { mount };

${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exports${ANNOTATION_ID_SUFFIX}
// Export components for Module Federation
${ANNOTATION_END}
`;

  await fs.writeFile(path.join(remoteDir, 'src', 'bootstrap.jsx'), bootstrapJsx);
  
  // Create App.jsx (will be updated later)
  const appJsx = `import React from 'react';
import { Box, Typography, Container } from '@mui/material';
${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}imports${ANNOTATION_ID_SUFFIX}
${ANNOTATION_END}

const App = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          ${remote.name} MFE
        </Typography>
        ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}component-usage${ANNOTATION_ID_SUFFIX}
        ${ANNOTATION_END}
      </Box>
    </Container>
  );
};

export default App;
`;

  await fs.writeFile(path.join(remoteDir, 'src', 'App.jsx'), appJsx);
  
  // Create components directory
  await fs.ensureDir(path.join(remoteDir, 'src', 'components'));
  
  // Install dependencies
  console.log(chalk.blue(`Installing dependencies for ${remote.name}...`));
  try {
    execSync('npm install', { 
      cwd: remoteDir, 
      stdio: 'inherit',
      env: { ...process.env, ADBLOCK: '1', DISABLE_OPENCOLLECTIVE: '1' }
    });
  } catch (error) {
    console.warn(chalk.yellow(`Warning: Error installing dependencies for ${remote.name}: ${error.message}`));
    // Continue anyway - we can still generate the components
  }
  
  return remoteDir;
}

// Generate API services
async function generateAPIs(projectDir, spec, dryRun) {
  if (!spec.apis || spec.apis.length === 0) {
    console.log(chalk.yellow('No APIs defined in the specification'));
    return;
  }

  console.log(chalk.blue('\nGenerating APIs:'));
  
  for (const api of spec.apis) {
    console.log(chalk.blue(`- ${api.name} (Port: ${api.port}, Database: ${api.database})`));
    
    if (!dryRun) {
      try {
        // Ensure we have the spec file
        const apiSpecPath = path.resolve(process.cwd(), api.spec);
        
        if (!await fs.pathExists(apiSpecPath)) {
          console.log(chalk.yellow(`API spec file not found: ${apiSpecPath}`));
          continue;
        }
        
        execSync(
          `npx seans-mfe-tool api ${api.name} --port ${api.port} --database ${api.database} --spec ${apiSpecPath}`, 
          { 
            cwd: projectDir,
            stdio: 'inherit'
          }
        );
        
        console.log(chalk.green(`✓ Generated API: ${api.name}`));
      } catch (error) {
        console.error(chalk.red(`Error generating API ${api.name}: ${error.message}`));
        throw error;
      }
    } else {
      console.log(chalk.yellow(`[DRY RUN] Would generate API: ${api.name}`));
    }
  }
}

// Generate components for remote MFE
async function generateComponents(remoteDir, remote) {
  if (!remote.exposedComponents || remote.exposedComponents.length === 0) {
    console.log(chalk.yellow(`No exposed components defined for ${remote.name}`));
    return;
  }

  const componentsDir = path.join(remoteDir, 'src', 'components');
  await fs.ensureDir(componentsDir);
  
  // Generate each exposed component
  for (const component of remote.exposedComponents) {
    const componentName = component.name;
    const componentPath = path.join(componentsDir, `${componentName}.jsx`);
    
    // Create a simple component template with annotations
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
    
    await fs.writeFile(componentPath, componentContent);
  }
  
  // Update App.jsx with generated components
  await updateAppWithComponents(remoteDir, remote);
  
  // Update bootstrap.jsx to export components
  await addComponentExports(remoteDir, remote);
  
  // Update rspack.config.js with Module Federation
  await updateModuleFederation(remoteDir, remote);
}

// Update App.jsx with generated components
async function updateAppWithComponents(remoteDir, remote) {
  const appJsxPath = path.join(remoteDir, 'src', 'App.jsx');
  
  if (await fs.pathExists(appJsxPath)) {
    // Generate imports section
    const imports = remote.exposedComponents.map(c => 
      `import ${c.name} from './components/${c.name}';`
    ).join('\n');
    
    // Generate component usage
    const componentUsage = remote.exposedComponents.map(c => 
      `<${c.name} />`
    ).join('\n        ');
    
    // Create the new App.jsx with annotations
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
    
    await fs.writeFile(appJsxPath, newAppContent);
  }
}

// Add component exports to bootstrap.jsx
async function addComponentExports(remoteDir, remote) {
  const bootstrapPath = path.join(remoteDir, 'src', 'bootstrap.jsx');
  
  if (await fs.pathExists(bootstrapPath)) {
    // Generate component exports
    const componentExports = remote.exposedComponents.map(c => 
      `export { default as ${c.name} } from './components/${c.name}';`
    ).join('\n');
    
    // Read the bootstrap file
    let bootstrapContent = await fs.readFile(bootstrapPath, 'utf8');
    
    // Add the exports with annotations
    const newContent = `${bootstrapContent}

${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exports${ANNOTATION_ID_SUFFIX}
// Export components for Module Federation
${componentExports}
${ANNOTATION_END}
`;
    
    await fs.writeFile(bootstrapPath, newContent);
  }
}

// Update rspack.config.js with Module Federation configuration
async function updateModuleFederation(remoteDir, remote) {
  const configPath = path.join(remoteDir, 'rspack.config.js');
  
  if (await fs.pathExists(configPath)) {
    // Generate the exposes config
    const exposesConfig = remote.exposedComponents.reduce((acc, component) => {
      acc[component.path] = `./src/components/${component.name}.jsx`;
      return acc;
    }, { './App': './src/App.jsx' });
    
    // Format the exposes config
    const exposesStr = JSON.stringify(exposesConfig, null, 6)
      .replace(/"/g, "'")
      .replace(/},/g, '},')
      .replace(/'/g, '"');
    
    // Read the config file
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Add annotations to the exposes section
    const annotatedConfig = configContent.replace(
      /(exposes:)\s*({[^}]*})/s,
      `$1 ${ANNOTATION_START} ${ANNOTATION_ID_PREFIX}exposes${ANNOTATION_ID_SUFFIX}
      ${exposesStr}
      ${ANNOTATION_END}`
    );
    
    if (annotatedConfig !== configContent) {
      await fs.writeFile(configPath, annotatedConfig);
    }
  }
}

// Create workspace package.json
async function createWorkspacePackage(projectDir, spec, dryRun) {
  const packageJson = {
    name: spec.name,
    version: '1.0.0',
    private: true,
    workspaces: [
      spec.shell.name,
      ...(spec.remotes ? spec.remotes.map(remote => remote.name) : []),
      ...(spec.apis ? spec.apis.map(api => api.name) : [])
    ],
    scripts: {
      dev: 'concurrently ' + [
        `"npm run dev --workspace=${spec.shell.name}"`,
        ...(spec.remotes ? spec.remotes.map(remote => `"npm run dev --workspace=${remote.name}"`) : []),
        ...(spec.apis ? spec.apis.map(api => `"npm run dev --workspace=${api.name}"`) : [])
      ].join(' '),
      build: 'npm run build --workspaces',
      start: 'concurrently ' + [
        `"npm run start --workspace=${spec.shell.name}"`,
        ...(spec.remotes ? spec.remotes.map(remote => `"npm run start --workspace=${remote.name}"`) : []),
        ...(spec.apis ? spec.apis.map(api => `"npm run start --workspace=${api.name}"`) : [])
      ].join(' ')
    },
    devDependencies: {
      concurrently: "^8.2.0"
    }
  };
  
  if (!dryRun) {
    await fs.writeFile(
      path.join(projectDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
  }
  
  console.log(chalk.green('✓ Created workspace package.json'));
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

// Export all functions
module.exports = {
  createReadme,
  generateShell,
  annotateShellConfig,
  customizeTheme,
  generateRemotes,
  generateAPIs,
  generateComponents,
  updateAppWithComponents,
  addComponentExports,
  updateModuleFederation,
  createWorkspacePackage,
  findAnnotatedSections,
  fixRemotePackageJson,
  createRemoteMFE,
  createShellApp,
  updateShellWithRemotes
};