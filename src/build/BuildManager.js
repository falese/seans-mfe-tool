const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { rspack } = require('@rspack/core');
const { createConfiguration } = require('./config');
const { ServerRegistry } = require('./servers');

class BuildManager {
  constructor(options) {
    this.options = options;
    this.context = process.cwd();
    this.type = options.type;
    this.mode = options.mode || 'development';
    this.serverRegistry = new ServerRegistry();
  }

  async initialize() {
    console.log(chalk.blue('Initializing build configuration...'));
    
    try {
      await this.validateProject();
      this.config = await createConfiguration({
        context: this.context,
        type: this.type,
        mode: this.mode,
        ...this.options
      });

      if (process.env.DEBUG) {
        console.log(chalk.gray('\nBuild configuration:'));
        console.log(JSON.stringify(this.config, null, 2));
      }

      console.log(chalk.green('✓ Build configuration initialized'));
    } catch (error) {
      console.error(chalk.red('✗ Failed to initialize build configuration'));
      throw error;
    }
  }

  async validateProject() {
    console.log(chalk.blue('Validating project structure...'));
    
    try {
      await fs.readJSON(path.join(this.context, 'package.json'));
      console.log(chalk.green('✓ Found package.json'));
      
      // Validate and create required directories
      const dirs = ['src', 'public'];
      for (const dir of dirs) {
        const dirPath = path.join(this.context, dir);
        if (!await fs.pathExists(dirPath)) {
          await fs.mkdir(dirPath);
          console.log(chalk.yellow(`Created missing ${dir} directory`));
        } else {
          console.log(chalk.green(`✓ Found ${dir} directory`));
        }
      }

      // Validate and create required files based on type
      if (this.type === 'remote' || this.type === 'shell') {
        const files = {
          'src/index.js': this.getIndexTemplate(),
          'src/App.jsx': this.getAppTemplate(),
          'public/index.html': this.getHtmlTemplate(),
        };

        if (this.type === 'remote') {
          files['src/bootstrap.jsx'] = this.getBootstrapTemplate();
        }

        for (const [file, template] of Object.entries(files)) {
          const filePath = path.join(this.context, file);
          if (!await fs.pathExists(filePath)) {
            await fs.writeFile(filePath, template);
            console.log(chalk.yellow(`Created missing ${file}`));
          } else {
            console.log(chalk.green(`✓ Found ${file}`));
          }
        }
      }

      console.log(chalk.green('✓ Project structure validated'));
    } catch (error) {
      console.error(chalk.red('✗ Project validation failed'));
      throw new Error(`Project validation failed: ${error.message}`);
    }
  }

  getIndexTemplate() {
    if (this.type === 'remote') {
      return `import('./bootstrap');`;
    }
    
    return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  getAppTemplate() {
    const isRemote = this.type === 'remote';
    const componentName = isRemote ? 'RemoteApp' : 'ShellApp';
    
    return `import React from 'react';

function ${componentName}() {
  return (
    <div>
      <h1>${isRemote ? 'Remote' : 'Shell'} Application</h1>
      <p>Edit src/App.jsx to get started!</p>
    </div>
  );
}

export default ${componentName};`;
  }

  getHtmlTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.options.name} - ${this.type}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
  }

  getBootstrapTemplate() {
    return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

function mount(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  
  const root = createRoot(container);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  return () => {
    root.unmount();
  };
}

// Mount immediately if we're running in standalone mode
if (!window.__RSPACK_REMOTE_ENTRY__) {
  mount('root');
}

// Export mount function for federation
export { mount };`;
  }

  async build() {
    console.log(chalk.blue(`\nStarting ${this.mode} build...`));

    try {
      const compiler = rspack(this.config);
      
      return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
          if (err) {
            console.error(chalk.red('\n✗ Build failed:'));
            console.error(chalk.red(err));
            reject(err);
            return;
          }

          if (stats.hasErrors()) {
            console.error(chalk.red('\n✗ Build failed with errors:'));
            const info = stats.toJson();
            info.errors.forEach(error => {
              console.error(chalk.red(error.message));
            });
            reject(new Error('Build failed with errors'));
            return;
          }

          if (stats.hasWarnings()) {
            console.warn(chalk.yellow('\n⚠ Build completed with warnings:'));
            const info = stats.toJson();
            info.warnings.forEach(warning => {
              console.warn(chalk.yellow(warning.message));
            });
          }

          console.log(stats.toString({
            colors: true,
            modules: false,
            children: false,
            chunks: false,
            chunkModules: false
          }));

          console.log(chalk.green('\n✓ Build completed successfully'));

          compiler.close((closeErr) => {
            if (closeErr) {
              console.warn(chalk.yellow('\nWarning: Error while closing compiler:'), closeErr);
            }
            resolve(stats);
          });
        });
      });
    } catch (error) {
      console.error(chalk.red('\n✗ Build failed:'));
      console.error(chalk.red(error));
      throw error;
    }
  }

  getServerType() {
    // Simple mapping based on application type
    switch (this.type) {
      case 'remote':
      case 'shell':
        return 'rspack';
      case 'api':
        return 'nodemon';
      default:
        throw new Error(`Unknown application type: ${this.type}`);
    }
  }

  async serve() {
    console.log(chalk.blue('\nStarting development server...'));

    try {
      // Get server type based on application type
      const serverType = this.getServerType();
      console.log(chalk.gray(`Using ${serverType} server for ${this.type} application`));

      // Get server implementation
      const ServerClass = this.serverRegistry.get(serverType);
      
      // Create server instance with appropriate options
      const serverOptions = {
        ...this.options,
        compiler: serverType === 'rspack' ? rspack(this.config) : null
      };

      const server = new ServerClass(serverOptions, this.context);
      await server.start();

      // Keep the process alive
      return new Promise(() => {});

    } catch (error) {
      console.error(chalk.red('\n✗ Failed to start development server:'));
      console.error(chalk.red(error.message));
      throw error;
    }
  }
}

module.exports = { BuildManager };