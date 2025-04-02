// src/commands/deploy.js
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
      if (await fs.exists(dir)) {
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

// Development deployment function
async function developmentDeploy(options) {
  const { name, port, type } = options;
  const containerName = `${name}-dev`;
  const imageTag = `${name}:development`;
  const projectDir = process.cwd();

  try {
    // Stop existing container if it exists
    try {
      execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
      execSync(`docker rm ${containerName}`, { stdio: 'ignore' });
      console.log(chalk.blue(`Removed existing container: ${containerName}`));
    } catch (e) {
      // Container doesn't exist, continue
    }

    // Create temporary build directory
    const tempDir = path.join(os.tmpdir(), `mfe-deploy-${name}-${Date.now()}`);
    tempDirs.add(tempDir);
    await fs.ensureDir(tempDir);

    // Copy project files
    console.log(chalk.blue('\nPreparing deployment files...'));
    const projectFiles = ['src', 'public', 'package.json', 'package-lock.json', 'rspack.config.js'];
    for (const file of projectFiles) {
      const sourcePath = path.join(projectDir, file);
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, path.join(tempDir, file));
      }
    }

    // Copy Docker configuration
    await copyDockerFiles(tempDir, type);

    // Build image
    console.log(chalk.blue('\nBuilding Docker image...'));
    execSync(
      `docker build -t ${imageTag} --target development ${tempDir}`, 
      { 
        stdio: 'inherit',
        env: { ...process.env, DOCKER_BUILDKIT: '1' }
      }
    );

    // Run container with development settings
    console.log(chalk.blue('\nStarting development container...'));
    execSync(
      `docker run -d \
        --name ${containerName} \
        -p ${port}:80 \
        -v ${projectDir}/src:/app/src \
        -v ${projectDir}/public:/app/public \
        --env-file .env.development \
        ${imageTag}`,
      { stdio: 'inherit' }
    );

    // Wait for container to be ready
    await waitForContainer(containerName);
    
    // Show container info
    console.log(chalk.green(`\n✓ Development container ready at http://localhost:${port}`));
    console.log(chalk.blue('\nUseful commands:'));
    console.log(`  Logs: docker logs -f ${containerName}`);
    console.log(`  Shell: docker exec -it ${containerName} /bin/sh`);
    console.log(`  Stop: docker stop ${containerName}`);
    
    // Stream logs if requested
    if (options.logs) {
      console.log(chalk.blue('\nStreaming container logs...'));
      execSync(`docker logs -f ${containerName}`, { stdio: 'inherit' });
    }

  } catch (error) {
    console.error(chalk.red('\n✗ Development deployment failed:'));
    console.error(error.message);
    throw error;
  } finally {
    await cleanupTempDirs();
  }
}

// Helper function to wait for container readiness
async function waitForContainer(containerName, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const status = execSync(
        `docker inspect -f '{{.State.Status}}' ${containerName}`,
        { encoding: 'utf8' }
      ).trim();
      
      if (status === 'running') {
        return true;
      }
    } catch (e) {
      // Container not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Container failed to start within timeout');
}

// Main deployment command
async function deployCommand(options) {
  try {
    // Verify project structure
    await verifyProjectStructure();

    if (options.env === 'development') {
      await developmentDeploy(options);
    } else {
      throw new Error('Production deployment not yet implemented');
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Deployment failed:'));
    console.error(chalk.red(error.message));
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = {
  deployCommand,
  verifyProjectStructure,
  copyDockerFiles,
  developmentDeploy,
  waitForContainer
};