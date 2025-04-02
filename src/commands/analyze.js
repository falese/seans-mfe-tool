const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { exec } = require('child_process');

// Remove ora and use a simple spinner implementation instead
const simpleSpinner = {
    interval: null,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    frameIndex: 0,
    text: '',
    
    start(text) {
      this.stop(); // Ensure any existing spinner is stopped first
      this.text = text;
      this.frameIndex = 0;
      
      process.stdout.write('\r');
      this.interval = setInterval(() => {
        const frame = this.frames[this.frameIndex];
        process.stdout.write(`\r${frame} ${this.text}`);
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      }, 80);
      
      return this;
    },
    
    succeed(text) {
      this.stop();
      process.stdout.write(`\r✓ ${text || this.text}\n`);
      return this;
    },
    
    fail(text) {
      this.stop();
      process.stdout.write(`\r✗ ${text || this.text}\n`);
      return this;
    },
    
    stop() {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
        process.stdout.write('\r                                                            \r');
      }
      return this;
    }
  };

// Configuration for analyzer
const DEFAULT_CONFIG = {
  componentPatterns: [
    'src/**/*.jsx',
    'src/**/*.tsx',
    'src/**/*.js'
  ],
  outputDir: './mfe-analysis'
};

/**
 * Analyze a project for potential MFE candidates
 */
async function analyzeCommand(options) {
  try {
    const spinner = simpleSpinner.start('Starting project analysis');
    console.log(chalk.blue('\nAnalyzing project for MFE candidates...'));
    
    // Initialize configuration
    const config = initializeConfig(options);
    spinner.start('Configuration initialized');
    
    // Create output directory
    await fs.ensureDir(config.outputDir);
    
    // Find component files
    spinner.start('Finding component files');
    const componentFiles = await findComponentFiles(options.dir || process.cwd(), config);
    spinner.succeed('Found component files');
    
    console.log(chalk.green(`Found ${componentFiles.length} component files to analyze`));
    
    if (componentFiles.length === 0) {
      console.log(chalk.yellow('No component files found. Check your patterns and project structure.'));
      return;
    }
    
    // Ensure dependencies are installed
    await ensureDependencies();
    
    // Analyze the components
    spinner.start('Analyzing components');
    const results = await analyzeComponents(componentFiles);
    spinner.succeed('Component analysis complete');
    
    // Identify potential MFEs
    spinner.start('Identifying potential MFEs');
    const mfeResults = identifyPotentialMFEs(results);
    spinner.succeed('MFE identification complete');
    spinner.stop(); // Ensure spinner is cleared completely
    process.stdout.write('\r');
    // Write output files
    await writeOutputFiles(mfeResults, config);
    
    // Generate report
    await generateReport(mfeResults, componentFiles, config);
    
    // Generate visualization
    await generateVisualization(mfeResults, config);
    
    console.log(chalk.green('\n✓ Project analysis complete!'));
    console.log(`\nResults available in: ${chalk.blue(config.outputDir)}`);
    
    // Print summary
    printSummary(mfeResults);
    
    // Print next steps
    printNextSteps(mfeResults, config);
    
  } catch (error) {
    console.error(chalk.red('\n✗ Analysis failed:'));
    console.error(chalk.red(error.message));
    if (process.env.DEBUG && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Initialize configuration for analysis
 */
function initializeConfig(options) {
  const config = { ...DEFAULT_CONFIG };
  
  // Override with command line options
  if (options.output) {
    config.outputDir = options.output;
  }
  
  if (options.patterns) {
    try {
      config.componentPatterns = JSON.parse(options.patterns);
    } catch (e) {
      console.warn(chalk.yellow('Invalid patterns format, using defaults'));
    }
  }
  
  return config;
}

/**
 * Find component files based on patterns
 */
async function findComponentFiles(projectRoot, config) {
  let componentFiles = [];
  
  for (const pattern of config.componentPatterns) {
    const matched = glob.sync(pattern, { 
      cwd: projectRoot, 
      absolute: true 
    });
    componentFiles = componentFiles.concat(matched);
  }
  
  return [...new Set(componentFiles)]; // Remove duplicates
}

/**
 * Ensure required dependencies are installed
 */
async function ensureDependencies() {
  const requiredDeps = ['@babel/parser', '@babel/traverse', 'glob'];
  const missingDeps = [];
  
  for (const dep of requiredDeps) {
    try {
      require.resolve(dep);
    } catch (e) {
      missingDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    console.log(chalk.yellow('Installing required dependencies...'));
    
    return new Promise((resolve, reject) => {
      const command = `npm install ${missingDeps.join(' ')} --no-save`;
      exec(command, (error) => {
        if (error) {
          reject(new Error(`Failed to install dependencies: ${error.message}`));
        } else {
          console.log(chalk.green('Dependencies installed successfully'));
          resolve();
        }
      });
    });
  }
}

/**
 * Analyze component files to extract necessary information
 */
async function analyzeComponents(componentFiles) {
  const results = {
    files: {},
    imports: {},
    components: {}
  };
  
  for (const [index, file] of componentFiles.entries()) {
    try {
      // Show progress for large projects
      if (index % 10 === 0) {
        process.stdout.write(`\rAnalyzing file ${index + 1}/${componentFiles.length}`);
      }
      
      // Read and parse
      const code = await fs.readFile(file, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties'],
        errorRecovery: true
      });
      
      // Extract info
      const fileName = path.basename(file);
      const componentName = fileName.split('.')[0];
      const fileInfo = {
        path: file,
        name: componentName,
        imports: [],
        exports: [],
        apiCalls: [],
        props: [],
        stateVars: []
      };
      
      // Traverse AST
      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          
          path.node.specifiers.forEach(specifier => {
            if (!specifier.local) return;
            
            const importName = specifier.local.name;
            fileInfo.imports.push({
              name: importName,
              source: source
            });
            
            // Track components
            if (/^[A-Z]/.test(importName) && !source.startsWith('react')) {
              if (!results.components[importName]) {
                results.components[importName] = {
                  usedIn: []
                };
              }
              results.components[importName].usedIn.push(file);
            }
            
            // Track potential API calls
            if (source.includes('api') || 
                source.includes('service') || 
                importName.includes('api') ||
                importName.includes('fetch') ||
                importName.includes('http')) {
              fileInfo.apiCalls.push({
                name: importName,
                source: source
              });
            }
          });
        },
        
        ExportDefaultDeclaration(path) {
          if (path.node.declaration && path.node.declaration.name) {
            fileInfo.exports.push({
              name: path.node.declaration.name,
              default: true
            });
          }
        },
        
        ExportNamedDeclaration(path) {
          if (path.node.declaration && path.node.declaration.id) {
            fileInfo.exports.push({
              name: path.node.declaration.id.name,
              default: false
            });
          }
        }
      });
      
      // Store results
      results.files[fileName] = fileInfo;
      
    } catch (error) {
      console.log(chalk.yellow(`\nWarning: Error processing ${file}: ${error.message}`));
    }
  }
  
  // Clear progress line
  process.stdout.write('\r\x1b[K');
  
  return results;
}

/**
 * Identify potential MFEs based on component relationships
 */
function identifyPotentialMFEs(results) {
  console.log('\n--- Starting MFE identification ---');
  console.log(`Analyzing ${Object.keys(results.files).length} files for potential MFEs`);
  
  // Clone results to add MFE data
  const mfeResults = {
    ...results,
    potentialMFEs: []
  };
  
  console.log('Setting up domain patterns...');
  // Domain patterns to help identify MFEs
  const domainPatterns = [
    'account', 'payment', 'transaction', 'dashboard', 'user',
    'profile', 'settings', 'notification', 'report', 'card',
    'admin', 'auth', 'product', 'cart', 'checkout', 'order',
    'search', 'detail', 'list', 'form', 'table', 'graph', 'chart'
  ];
  
  console.log('Starting to group files by domain...');
  // Group by domain
  const domains = {};
  let counter = 0;
  const total = Object.keys(results.files).length;
  
  for (const fileName of Object.keys(results.files)) {
    counter++;
    if (counter % 100 === 0) {
      console.log(`Processed ${counter}/${total} files for domain grouping`);
    }
    
    // Check file name for domain hints
    let foundDomain = 'general';
    
    for (const domain of domainPatterns) {
      if (fileName.toLowerCase().includes(domain)) {
        foundDomain = domain;
        break;
      }
    }
    
    // Initialize domain if it doesn't exist
    if (!domains[foundDomain]) {
      domains[foundDomain] = [];
    }
    
    domains[foundDomain].push(fileName);
  }
  
  console.log(`Finished domain grouping. Found ${Object.keys(domains).length} domains.`);
  console.log('Domains:', Object.keys(domains).join(', '));
  
  console.log('Creating MFE suggestions from domains...');
  // Create MFE suggestions from domains
  let domainCounter = 0;
  for (const domain of Object.keys(domains)) {
    domainCounter++;
    console.log(`Processing domain ${domainCounter}/${Object.keys(domains).length}: ${domain}`);
    
    if (domain !== 'general' && domains[domain].length > 0) {
      const components = domains[domain];
      console.log(`Domain ${domain} has ${components.length} components`);
      
      // Get related API calls
      console.log(`Getting API dependencies for ${domain}...`);
      const apiCalls = new Set();
      let componentCounter = 0;
      
      for (const comp of components) {
        componentCounter++;
        if (componentCounter % 100 === 0) {
          console.log(`Processed ${componentCounter}/${components.length} components for API dependencies`);
        }
        
        const fileInfo = results.files[comp];
        if (fileInfo && fileInfo.apiCalls) {
          for (const api of fileInfo.apiCalls) {
            if (api.source) {
              apiCalls.add(api.source);
            }
          }
        }
      }
      
      console.log(`Found ${apiCalls.size} API dependencies for ${domain}`);
      
      mfeResults.potentialMFEs.push({
        name: `${domain.charAt(0).toUpperCase() + domain.slice(1)}MFE`,
        components: components,
        apiDependencies: Array.from(apiCalls),
        type: components.length > 5 ? 'application' : 'component'
      });
      
      console.log(`Added ${domain} to potential MFEs`);
    }
  }
  
  console.log(`Created ${mfeResults.potentialMFEs.length} domain-based MFE candidates`);
  
  // Check if we need to create component group based MFEs
  if (domains['general'] && domains['general'].length > 0) {
    console.log(`Analyzing ${domains['general'].length} general components for relationships...`);
    
    console.log('Setting up component groups...');
    // Identify related components by imports/exports
    const componentGroups = {};
    
    let generalCounter = 0;
    const generalTotal = domains['general'].length;
    
    // This loop can be expensive with lots of components
    console.log('Starting component relationship analysis (this might take a while)...');
    
    for (const fileName of domains['general']) {
      generalCounter++;
      if (generalCounter % 100 === 0) {
        console.log(`Processed ${generalCounter}/${generalTotal} general components`);
      }
      
      const fileInfo = results.files[fileName];
      if (!fileInfo) {
        console.log(`Warning: Missing file info for ${fileName}`);
        continue;
      }
      
      const componentName = fileInfo.name;
      
      // Check imports to find related components
      console.log(`Analyzing imports for ${componentName} (${fileInfo.imports ? fileInfo.imports.length : 0} imports)`);
      
      if (fileInfo.imports && fileInfo.imports.length > 0) {
        for (const imp of fileInfo.imports) {
          if (/^[A-Z]/.test(imp.name) && imp.source.startsWith('.')) { // Local component import
            console.log(`Found relationship between ${componentName} and ${imp.name}`);
            
            if (!componentGroups[componentName]) {
              componentGroups[componentName] = new Set();
            }
            componentGroups[componentName].add(imp.name);
            
            if (!componentGroups[imp.name]) {
              componentGroups[imp.name] = new Set();
            }
            componentGroups[imp.name].add(componentName);
          }
        }
      }
    }
    
    console.log(`Finished component relationship analysis. Found ${Object.keys(componentGroups).length} component groups`);
    
    // Check each component group to see if it qualifies as an MFE
    console.log('Identifying MFE candidates from component groups...');
    let groupCounter = 0;
    
    for (const compName of Object.keys(componentGroups)) {
      groupCounter++;
      if (groupCounter % 100 === 0) {
        console.log(`Processed ${groupCounter}/${Object.keys(componentGroups).length} component groups`);
      }
      
      console.log(`Component group ${compName} has ${componentGroups[compName].size} related components`);
      
      if (componentGroups[compName].size >= 3) {
        console.log(`${compName} might be an MFE candidate (has ${componentGroups[compName].size} related components)`);
        
        // Check if this component is already part of a domain MFE
        let alreadyIncluded = false;
        for (const mfe of mfeResults.potentialMFEs) {
          if (mfe.components.includes(`${compName}.jsx`) || 
              mfe.components.includes(`${compName}.tsx`) ||
              mfe.components.includes(`${compName}.js`)) {
            alreadyIncluded = true;
            console.log(`${compName} is already part of an MFE: ${mfe.name}`);
            break;
          }
        }
        
        if (!alreadyIncluded) {
          console.log(`${compName} is not part of any existing MFE, creating a new candidate`);
          
          // Get related files
          const relatedFiles = [];
          for (const fileName of Object.keys(results.files)) {
            if (fileName.startsWith(compName) || 
                componentGroups[compName].has(results.files[fileName].name)) {
              relatedFiles.push(fileName);
            }
          }
          
          console.log(`Found ${relatedFiles.length} files related to ${compName}`);
          
          if (relatedFiles.length >= 3) {
            mfeResults.potentialMFEs.push({
              name: `${compName}MFE`,
              components: relatedFiles,
              apiDependencies: [],
              type: 'component'
            });
            
            console.log(`Added ${compName}MFE to potential MFEs`);
          } else {
            console.log(`${compName} has fewer than 3 related files, not adding as MFE candidate`);
          }
        }
      }
    }
  }
  
  console.log(`MFE identification complete. Found ${mfeResults.potentialMFEs.length} potential MFEs`);
  return mfeResults;
}

/**
 * Write analysis output files
 */
async function writeOutputFiles(results, config) {
  // Write raw analysis
  const analysisFile = path.join(config.outputDir, 'analysis.json');
  await fs.writeJson(analysisFile, results, { spaces: 2 });
  
  // Write MFE suggestions
  const suggestionsFile = path.join(config.outputDir, 'mfe-suggestions.json');
  await fs.writeJson(suggestionsFile, {
    potentialMFEs: results.potentialMFEs
  }, { spaces: 2 });
  
  // Write summary
  const summary = {
    totalComponents: Object.keys(results.files).length,
    potentialMFEs: results.potentialMFEs.length,
    domainsIdentified: [...new Set(results.potentialMFEs.map(mfe => 
      mfe.name.replace('MFE', '').toLowerCase()
    ))]
  };
  
  const summaryFile = path.join(config.outputDir, 'summary.json');
  await fs.writeJson(summaryFile, summary, { spaces: 2 });
}

/**
 * Generate a detailed HTML report
 */
async function generateReport(results, componentFiles, config) {
  const reportFile = path.join(config.outputDir, 'report.html');
  
  // Generate HTML content with bootstrap
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MFE Analysis Report</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { padding: 20px; }
    .card { margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="mb-4">Micro Frontend Analysis Report</h1>
    
    <div class="row">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">
            <h2>Summary</h2>
          </div>
          <div class="card-body">
            <p><strong>Total Components Analyzed:</strong> ${Object.keys(results.files).length}</p>
            <p><strong>Potential MFEs Identified:</strong> ${results.potentialMFEs.length}</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="row">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">
            <h2>Potential Micro Frontends</h2>
          </div>
          <div class="card-body">
            <div class="accordion" id="mfeAccordion">
              ${results.potentialMFEs.map((mfe, index) => `
                <div class="accordion-item">
                  <h2 class="accordion-header" id="heading${index}">
                    <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}">
                      ${mfe.name} (${mfe.components.length} components)
                    </button>
                  </h2>
                  <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#mfeAccordion">
                    <div class="accordion-body">
                      <p><strong>Type:</strong> ${mfe.type}</p>
                      <p><strong>Components:</strong></p>
                      <ul class="list-group mb-3">
                        ${mfe.components.map(comp => `<li class="list-group-item">${comp}</li>`).join('')}
                      </ul>
                      <p><strong>API Dependencies:</strong></p>
                      <ul class="list-group">
                        ${mfe.apiDependencies.length > 0 ? 
                          mfe.apiDependencies.map(api => `<li class="list-group-item">${api}</li>`).join('') : 
                          '<li class="list-group-item">None detected</li>'}
                      </ul>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="row mt-4">
      <div class="col-md-12">
        <div class="card">
          <div class="card-header">
            <h2>Next Steps</h2>
          </div>
          <div class="card-body">
            <p>Based on this analysis, consider these steps to implement Module Federation:</p>
            <ol>
              <li>Start with the most isolated MFEs first (those with minimal dependencies)</li>
              <li>Use the seans-mfe-tool to create shell and remote applications</li>
              <li>Move related components into their respective MFE repositories</li>
              <li>Configure shared dependencies appropriately</li>
            </ol>
            <p>Example commands:</p>
            <pre><code>
# Create shell application
seans-mfe-tool shell my-shell --port 3000

# Create remote MFEs
${results.potentialMFEs.slice(0, 3).map((mfe, i) => 
  `seans-mfe-tool remote ${mfe.name.toLowerCase()} --port ${3001 + i}`
).join('\n')}
            </code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
  `;
  
  await fs.writeFile(reportFile, html);
}

/**
 * Generate a visualization of the component relationships
 */
async function generateVisualization(results, config) {
  const visualFile = path.join(config.outputDir, 'visualization.html');
  
  // Prepare data for D3 visualization
  const nodes = [];
  const links = [];
  
  // Add MFEs as nodes
  results.potentialMFEs.forEach((mfe, index) => {
    nodes.push({
      id: mfe.name,
      group: 1,
      size: 15,
      type: 'mfe'
    });
    
    // Add components as nodes
    mfe.components.forEach(comp => {
      const compName = comp.split('.')[0];
      nodes.push({
        id: compName,
        group: 2,
        size: 8,
        type: 'component'
      });
      
      // Link components to MFEs
      links.push({
        source: mfe.name,
        target: compName,
        value: 2
      });
    });
  });
  
  // Add links between related components
  Object.keys(results.files).forEach(fileName => {
    const fileInfo = results.files[fileName];
    const componentName = fileInfo.name;
    
    fileInfo.imports.forEach(imp => {
      if (/^[A-Z]/.test(imp.name) && imp.source.startsWith('.')) {
        links.push({
          source: componentName,
          target: imp.name,
          value: 1
        });
      }
    });
  });
  
  // Deduplicate nodes
  const uniqueNodes = [];
  const nodeIds = new Set();
  
  nodes.forEach(node => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      uniqueNodes.push(node);
    }
  });
  
  // Generate visualization
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MFE Component Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; }
    .node { cursor: pointer; }
    .link { stroke-opacity: 0.6; }
    .node text { font-size: 10px; font-family: sans-serif; }
  </style>
</head>
<body>
  <svg id="visualization" width="100%" height="100vh"></svg>
  
  <script>
    // Data
    const data = {
      nodes: ${JSON.stringify(uniqueNodes)},
      links: ${JSON.stringify(links)}
    };
    
    // Create visualization
    const svg = d3.select("#visualization");
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Create force simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2));
    
    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.value));
    
    // Create node groups
    const node = svg.append("g")
      .selectAll(".node")
      .data(data.nodes)
      .join("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
    
    // Add circles to nodes
    node.append("circle")
      .attr("r", d => d.size)
      .attr("fill", d => d.type === 'mfe' ? "#ff7f0e" : "#1f77b4");
    
    // Add text to nodes
    node.append("text")
      .attr("dx", d => d.size + 5)
      .attr("dy", ".35em")
      .text(d => d.id);
    
    // Update positions
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  </script>
</body>
</html>
  `;
  
  await fs.writeFile(visualFile, html);
}

/**
 * Print summary of results to console
 */
function printSummary(results) {
  console.log(chalk.blue('\nAnalysis Summary:'));
  console.log(`Components analyzed: ${chalk.green(Object.keys(results.files).length)}`);
  console.log(`Potential MFEs identified: ${chalk.green(results.potentialMFEs.length)}`);
  
  if (results.potentialMFEs.length > 0) {
    console.log(chalk.blue('\nTop MFE candidates:'));
    
    // Sort by component count
    const sortedMFEs = [...results.potentialMFEs]
      .sort((a, b) => b.components.length - a.components.length)
      .slice(0, 5);
    
    sortedMFEs.forEach(mfe => {
      console.log(`- ${chalk.green(mfe.name)} (${mfe.components.length} components)`);
    });
  }
}

/**
 * Print next steps for the user
 */
function printNextSteps(results, config) {
  console.log(chalk.blue('\nNext Steps:'));
  console.log(`1. Review the detailed report at: ${chalk.green(path.join(config.outputDir, 'report.html'))}`);
  console.log(`2. Visualize component relationships at: ${chalk.green(path.join(config.outputDir, 'visualization.html'))}`);
  console.log(`3. Create your first MFE with:`);
  
  if (results.potentialMFEs.length > 0) {
    const firstMFE = results.potentialMFEs[0];
    console.log(chalk.green(`   seans-mfe-tool shell my-shell --port 3000`));
    console.log(chalk.green(`   seans-mfe-tool remote ${firstMFE.name.toLowerCase()} --port 3001`));
  } else {
    console.log(chalk.green(`   seans-mfe-tool shell my-shell --port 3000`));
    console.log(chalk.green(`   seans-mfe-tool remote my-first-mfe --port 3001`));
  }
}

module.exports = {
  analyzeCommand
};

process.on('exit', () => {
    simpleSpinner.stop();
  });
  
  process.on('SIGINT', () => {
    simpleSpinner.stop();
    process.exit(1);
  });