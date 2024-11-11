const validateNpmPackageName = require('validate-npm-package-name');

function validateProjectName(name) {
  const { validForNewPackages, errors, warnings } = validateNpmPackageName(name);
  
  if (!validForNewPackages) {
    throw new Error(
      `Invalid project name: ${name}\n${
        [...(errors || []), ...(warnings || [])].join('\n')
      }`
    );
  }
}

module.exports = {
  validateProjectName
};
