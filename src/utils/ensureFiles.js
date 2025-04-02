const fs = require('fs-extra');
const path = require('path');

async function ensureMiddleware(middlewareDir) {
  const middlewareFiles = [
    'auth.js',
    'errorHandler.js',
    'validator.js'
  ];

  for (const file of middlewareFiles) {
    const filePath = path.join(middlewareDir, file);
    if (!await fs.pathExists(filePath)) {
      await fs.writeFile(filePath, '');
    }
  }
}

async function ensureUtils(utilsDir) {
  const utilsFiles = [
    'logger.js',
    'response.js'
  ];

  for (const file of utilsFiles) {
    const filePath = path.join(utilsDir, file);
    if (!await fs.pathExists(filePath)) {
      await fs.writeFile(filePath, '');
    }
  }
}

module.exports = {
  ensureMiddleware,
  ensureUtils
};
