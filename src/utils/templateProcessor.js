const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');

async function processTemplates(targetDir, vars) {
  const files = await getFiles(targetDir);

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const processedContent = ejs.render(content, vars);
    await fs.writeFile(file, processedContent);
  }
}

async function getFiles(dir) {
  let files = [];
  const items = await fs.readdir(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await getFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

module.exports = {
  processTemplates
};
