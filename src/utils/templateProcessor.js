const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');

async function processTemplates(targetDir, vars) {
  const files = await fs.readdir(targetDir);

  for (const file of files) {
    const filePath = path.join(targetDir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      await processTemplates(filePath, vars);
    } else if (file.endsWith('.ejs')) {
      const templateContent = await fs.readFile(filePath, 'utf8');
      const renderedContent = ejs.render(templateContent, vars);
      const newFilePath = filePath.replace('.ejs', '');
      await fs.writeFile(newFilePath, renderedContent);
      await fs.remove(filePath);
    }
  }
}

module.exports = {
  processTemplates
};
