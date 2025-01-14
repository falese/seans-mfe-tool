const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');

async function processTemplates(targetDir, vars) {
  const files = await fs.readdir(targetDir);

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const stats = await fs.stat(filePath);

    if (stats.isDirectory()) {
      await processTemplates(filePath, vars);
    } else if (stats.isFile()) {
      const content = await fs.readFile(filePath, 'utf8');
      const rendered = ejs.render(content, vars);
      await fs.writeFile(filePath, rendered);
    }
  }
}

module.exports = {
  processTemplates
};
