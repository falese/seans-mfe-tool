const fs = require('fs-extra');
const path = require('path');

async function processTemplate(projectPath, vars) {
  const files = await fs.readdir(projectPath, { recursive: true });
  
  for (const file of files) {
    const filePath = path.join(projectPath, file);
    if ((await fs.stat(filePath)).isFile()) {
      let content = await fs.readFile(filePath, 'utf8');
      
      // Replace template variables
      content = content
        .replace(/__PROJECT_NAME__/g, vars.name)
        .replace(/__PORT__/g, vars.port)
        .replace(/__REMOTES__/g, JSON.stringify(vars.remotes, null, 2));
      
      await fs.writeFile(filePath, content);
    }
  }
}

module.exports = {
  processTemplate
};
