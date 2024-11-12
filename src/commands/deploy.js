const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Keep track of temp directories for cleanup
const tempDirs = new Set();

// Cleanup function
async function cleanupTempDirs() {
  for (const dir of tempDirs) {
    try {
      if (fs.existsSync(dir)) {
        console.log(chalk.blue(`\nCleaning up temporary directory: ${dir}`));
        await fs.remove(dir);
        console.log(chalk.green('✓ Cleanup complete'));
      }
    } catch (error) {
      console.error(chalk.yellow(`Warning: Failed to clean up directory: ${dir}`));
      console.error(chalk.gray(error.message));
    }
  }
  tempDirs.clear();
}

// Register cleanup handlers
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\nReceived SIGINT. Cleaning up...'));
  await cleanupTempDirs();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\nReceived SIGTERM. Cleaning up...'));
  await cleanupTempDirs();
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error(chalk.red('\nUncaught exception:'));
  console.error(error);
  await cleanupTempDirs();
  process.exit(1);
});

// Verify project structure
async function verifyProjectStructure() {
  console.log(chalk.blue('Checking required files...'));
  
  const requiredFiles = [
    'package.json',
    'rspack.config.js',
    'src/App.jsx',
    'src/bootstrap.jsx',
    'public/index.html'
  ];

  const missingFiles = [];
  for (const file of requiredFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
      console.log(chalk.red(`❌ Missing: ${file}`));
    } else {
      console.log(chalk.green(`✓ Found: ${file}`));
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      'Missing required files:\n' +
      missingFiles.map(file => `  - ${file}`).join('\n') +
      '\n\nPlease ensure all required files are present before deployment.'
    );
  }

  console.log(chalk.green('\n✓ Project structure verification complete'));
}

// Copy Docker configuration files
async function copyDockerFiles(tempDir, type) {
  const templateDir = path.resolve(__dirname, '..', 'templates', 'docker');
  console.log(chalk.gray(`Template directory: ${templateDir}`));
  
  // Copy Dockerfile
  const dockerfileSource = path.join(templateDir, `Dockerfile.${type}`);
  const dockerfileDest = path.join(tempDir, 'Dockerfile');
  
  if (!fs.existsSync(dockerfileSource)) {
    throw new Error(`Docker template not found: ${dockerfileSource}`);
  }
  
  await fs.copy(dockerfileSource, dockerfileDest);
  console.log(chalk.green('✓ Copied Dockerfile'));

  // Copy nginx configuration
  const nginxSource = path.join(templateDir, 'nginx.conf');
  const nginxDest = path.join(tempDir, 'nginx.conf');
  
  if (!fs.existsSync(nginxSource)) {
    throw new Error(`Nginx configuration not found: ${nginxSource}`);
  }
  
  await fs.copy(nginxSource, nginxDest);
  console.log(chalk.green('✓ Copied nginx configuration'));
}

// Print directory structure
function printDirStructure(dir, indent = '') {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    console.log(chalk.gray(`${indent}${item}${stat.isDirectory() ? '/' : ''}`));
    if (stat.isDirectory() && !item.includes('node_modules')) {
      printDirStructure(fullPath, `${indent}  `);
    }
  }
}

// Main deployment function
async function deployCommand(options) {
  let tempDir = null;
  
  try {
    const {
      type,
      env = 'development',
      port,
      name,
      registry
    } = options;

    console.log(chalk.blue(`Deploying ${type} application "${name}" to ${env} environment...`));

    // Verify project structure before proceeding
    await verifyProjectStructure();
    
    // Create temporary build directory
    tempDir = path.join(os.tmpdir(), `mfe-deploy-${name}-${Date.now()}`);
    tempDirs.add(tempDir);
    
    console.log(chalk.gray(`Using temporary directory: ${tempDir}`));
    await fs.ensureDir(tempDir);

    // Copy project files
    console.log(chalk.blue('\nCopying project files...'));
    const projectFiles = [
      'src',
      'public',
      'package.json',
      'package-lock.json',
      'rspack.config.js'
    ];

    for (const file of projectFiles) {
      const sourcePath = path.join(process.cwd(), file);
      const targetPath = path.join(tempDir, file);
      
      if (fs.existsSync(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
        console.log(chalk.gray(`Copied ${file}`));
      }
    }

    // Copy Docker configuration files
    console.log(chalk.blue('\nCopying Docker configuration files...'));
    await copyDockerFiles(tempDir, type);

    // Print directory structure for verification
    console.log(chalk.blue('\nVerifying deployment files:'));
    printDirStructure(tempDir);

    // Generate Docker image tag
    const imageTag = `${registry ? registry + '/' : ''}${name}:${env}`;

    // Build Docker image
    console.log(chalk.blue('\nBuilding Docker image...'));
    execSync(
      `docker build -t ${imageTag} ${tempDir}`, 
      { 
        stdio: 'inherit',
        env: { ...process.env, DOCKER_BUILDKIT: '1' }
      }
    );

    if (env === 'development') {
      // Run container in development mode
      console.log(chalk.blue('\nStarting development container...'));
      const containerName = `${name}-${env}`;
      
      // Stop existing container if it exists
      try {
        execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
        execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
      } catch (e) {
        // Container doesn't exist, continue
      }

      execSync(
        `docker run -d -p ${port}:80 --name ${containerName} ${imageTag}`,
        { stdio: 'inherit' }
      );
      
      // Verify container is running
      console.log(chalk.blue('\nVerifying container status...'));
      execSync(`docker ps | grep ${containerName}`, { stdio: 'inherit' });
      
      console.log(chalk.green(`\n✓ Development container started at http://localhost:${port}`));
      
      // Show container logs
      console.log(chalk.blue('\nContainer logs:'));
      execSync(`docker logs ${containerName}`, { stdio: 'inherit' });
    } else {
      // Push to registry for production
      console.log(chalk.blue('\nPushing to registry...'));
      execSync(`docker push ${imageTag}`, { stdio: 'inherit' });
      console.log(chalk.green('\n✓ Image pushed to registry successfully'));
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Deployment failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    throw error;
  } finally {
    if (tempDir) {
      await cleanupTempDirs();
    }
  }
}

// Wrap the deployCommand to ensure proper error handling
async function safeDeploy(options) {
  try {
    await deployCommand(options);
  } catch (error) {
    process.exit(1);
  }
}

module.exports = {
  deployCommand: safeDeploy,
  verifyProjectStructure
};