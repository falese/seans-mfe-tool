const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const { execSync } = require('child_process');

describe('Rspack config template', () => {
  const templatePath = path.resolve(__dirname, '../templates/base-mfe/rspack.config.js.ejs');
  const outputPath = path.resolve(__dirname, 'tmp-rspack.config.js');
  const sampleVars = {
    name: 'test-mfe',
    port: 3000,
    muiVersion: '^5.15.0',
  };

  afterAll(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  });

  it('renders without error', async () => {
    const template = await fs.readFile(templatePath, 'utf8');
    const rendered = ejs.render(template, sampleVars);
    expect(rendered).toMatch(/module.exports/);
    fs.writeFileSync(outputPath, rendered);
  });

  it('has valid JS syntax (static analysis)', () => {
    const rendered = fs.readFileSync(outputPath, 'utf8');
    const vm = require('vm');
    expect(() => new vm.Script(rendered)).not.toThrow();
  });

  it('passes Rspack build config validation', () => {
    // Only run if Rspack is installed
    try {
      execSync(`npx rspack --config ${outputPath} --mode=none`, { stdio: 'pipe' });
    } catch (err) {
      throw new Error('Rspack config failed validation: ' + err.message);
    }
  });
});
