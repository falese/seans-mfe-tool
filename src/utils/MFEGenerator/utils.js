const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Utility module with helper functions for MFE generator
 */

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dir - Directory path
 * @param {boolean} dryRun - Whether to perform a dry run
 * @returns {Promise<boolean>} - Whether the directory exists or was created
 */
async function ensureDir(dir, dryRun = false) {
  if (await fs.pathExists(dir)) {
    return true;
  }
  
  console.log(chalk.yellow(`Creating directory: ${dir}`));
  
  if (!dryRun) {
    await fs.ensureDir(dir);
  }
  
  return true;
}

/**
 * Recursively copies template files to a destination
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {boolean} dryRun - Whether to perform a dry run 
 * @param {Function} transformFn - Optional function to transform file content
 * @returns {Promise<boolean>} - Whether the copy was successful
 */
async function copyTemplateFiles(src, dest, dryRun = false, transformFn = null) {
  // Check if source exists
  if (!await fs.pathExists(src)) {
    console.log(chalk.yellow(`Template directory not found: ${src}`));
    return false;
  }
  
  // Create destination directory
  await ensureDir(dest, dryRun);
  
  // Get list of files
  const files = await fs.readdir(src);
  
  // Copy each file/directory
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    const stat = await fs.stat(srcPath);
    
    if (stat.isDirectory()) {
      // Recursively copy directory
      await copyTemplateFiles(srcPath, destPath, dryRun, transformFn);
    } else {
      // Read file
      let content = await fs.readFile(srcPath, 'utf8');
      
      // Transform content if needed
      if (transformFn) {
        content = transformFn(content, file);
      }
      
      // Write to destination
      if (!dryRun) {
        await fs.writeFile(destPath, content);
      }
      
      console.log(chalk.green(`✓ Copied ${file}`));
    }
  }
  
  return true;
}

/**
 * Gets the difference between two arrays
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {Object} - Object with added and removed items
 */
function arrayDiff(arr1, arr2) {
  return {
    added: arr2.filter(item => !arr1.includes(item)),
    removed: arr1.filter(item => !arr2.includes(item))
  };
}

/**
 * Converts a string to camelCase
 * @param {string} str - Input string
 * @returns {string} - camelCase string
 */
function toCamelCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => 
      index === 0 ? letter.toLowerCase() : letter.toUpperCase()
    )
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

/**
 * Converts a string to PascalCase
 * @param {string} str - Input string
 * @returns {string} - PascalCase string
 */
function toPascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter) => letter.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

/**
 * Converts a string to kebab-case
 * @param {string} str - Input string
 * @returns {string} - kebab-case string
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

module.exports = {
  ensureDir,
  copyTemplateFiles,
  arrayDiff,
  toCamelCase,
  toPascalCase,
  toKebabCase
};
