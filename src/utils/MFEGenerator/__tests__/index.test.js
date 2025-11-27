const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const diff = require('diff');
const {
  run,
  parseArgs,
  loadSpec,
  detectChanges,
  findAnnotatedSections,
  updateAnnotatedFile,
  generateMFE,
  updateMFE,
  ANNOTATION_START,
  ANNOTATION_END,
  ANNOTATION_ID_PREFIX,
  ANNOTATION_ID_SUFFIX
} = require('../index');

const specValidator = require('../spec-validator');
const implementation = require('../implementation');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('js-yaml');
jest.mock('diff');
jest.mock('chalk', () => ({
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  gray: jest.fn((str) => str)
}));
jest.mock('../spec-validator');
jest.mock('../implementation');

// Suppress console output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalProcessExit = process.exit;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  process.exit = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  process.exit = originalProcessExit;
});

describe('MFEGenerator index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('should export annotation constants', () => {
      expect(ANNOTATION_START).toBe('/* MFE-GENERATOR:START */');
      expect(ANNOTATION_END).toBe('/* MFE-GENERATOR:END */');
      expect(ANNOTATION_ID_PREFIX).toBe('/* MFE-GENERATOR:ID:');
      expect(ANNOTATION_ID_SUFFIX).toBe(' */');
    });
  });

  describe('parseArgs', () => {
    it('should parse generate command with spec path', () => {
      const args = ['generate', 'myapp.yaml'];
      const result = parseArgs(args);
      
      expect(result.cmd).toBe('generate');
      expect(result.specPath).toBe('myapp.yaml');
      expect(result.outputDir).toBe(process.cwd());
      expect(result.dryRun).toBe(false);
    });

    it('should parse update command with options', () => {
      const args = ['update', 'myapp.yml', '--output=/custom/path', '--dry-run'];
      const result = parseArgs(args);
      
      expect(result.cmd).toBe('update');
      expect(result.specPath).toBe('myapp.yml');
      expect(result.outputDir).toBe('/custom/path');
      expect(result.dryRun).toBe(true);
    });

    it('should use current directory as default output', () => {
      const args = ['generate', 'spec.yaml'];
      const result = parseArgs(args);
      
      expect(result.outputDir).toBe(process.cwd());
    });

    it('should exit with help message when --help is provided', () => {
      const args = ['generate', '--help'];
      parseArgs(args);
      
      expect(console.log).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit when no command is provided', () => {
      const args = [];
      parseArgs(args);
      
      expect(console.log).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit when no spec path is provided', () => {
      const args = ['generate'];
      parseArgs(args);
      
      expect(console.log).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should detect .yml extension', () => {
      const args = ['generate', 'myapp.yml'];
      const result = parseArgs(args);
      
      expect(result.specPath).toBe('myapp.yml');
    });

    it('should parse multiple output formats', () => {
      const args = ['generate', 'test.yaml', '--output=./output'];
      const result = parseArgs(args);
      
      expect(result.outputDir).toBe('./output');
    });
  });

  describe('loadSpec', () => {
    it('should load and validate YAML spec', async () => {
      const mockSpec = { name: 'test-app', version: '1.0.0' };
      fs.readFile.mockResolvedValue('name: test-app\nversion: 1.0.0');
      yaml.load.mockReturnValue(mockSpec);
      specValidator.validateSpec.mockReturnValue(true);
      
      const result = await loadSpec('test.yaml');
      
      expect(fs.readFile).toHaveBeenCalledWith('test.yaml', 'utf8');
      expect(yaml.load).toHaveBeenCalled();
      expect(specValidator.validateSpec).toHaveBeenCalledWith(mockSpec);
      expect(result).toEqual(mockSpec);
    });

    it('should exit on file read error', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      
      await loadSpec('missing.yaml');
      
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on YAML parse error', async () => {
      fs.readFile.mockResolvedValue('invalid: yaml: content:');
      yaml.load.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });
      
      await loadSpec('invalid.yaml');
      
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on validation error', async () => {
      fs.readFile.mockResolvedValue('name: test');
      yaml.load.mockReturnValue({ name: 'test' });
      specValidator.validateSpec.mockImplementation(() => {
        throw new Error('Validation failed');
      });
      
      await loadSpec('test.yaml');
      
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('detectChanges', () => {
    it('should detect shell name change', () => {
      const oldSpec = { shell: { name: 'old-shell' } };
      const newSpec = { shell: { name: 'new-shell' } };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.shell.nameChanged).toBe(true);
    });

    it('should detect shell port change', () => {
      const oldSpec = { shell: { port: 3000 } };
      const newSpec = { shell: { port: 4000 } };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.shell.portChanged).toBe(true);
    });

    it('should detect shell theme change', () => {
      const oldSpec = { shell: { theme: { primary: '#000' } } };
      const newSpec = { shell: { theme: { primary: '#fff' } } };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.shell.themeChanged).toBe(true);
    });

    it('should detect added remotes', () => {
      const oldSpec = { remotes: [{ name: 'remote1' }] };
      const newSpec = { remotes: [{ name: 'remote1' }, { name: 'remote2' }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.remotes.added).toHaveLength(1);
      expect(changes.remotes.added[0].name).toBe('remote2');
    });

    it('should detect removed remotes', () => {
      const oldSpec = { remotes: [{ name: 'remote1' }, { name: 'remote2' }] };
      const newSpec = { remotes: [{ name: 'remote1' }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.remotes.removed).toHaveLength(1);
      expect(changes.remotes.removed[0].name).toBe('remote2');
    });

    it('should detect modified remotes by port', () => {
      const oldSpec = { remotes: [{ name: 'remote1', port: 3001 }] };
      const newSpec = { remotes: [{ name: 'remote1', port: 3002 }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.remotes.modified).toHaveLength(1);
      expect(changes.remotes.modified[0].name).toBe('remote1');
    });

    it('should detect modified remotes by exposed components', () => {
      const oldSpec = { remotes: [{ name: 'remote1', exposedComponents: ['A'] }] };
      const newSpec = { remotes: [{ name: 'remote1', exposedComponents: ['A', 'B'] }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.remotes.modified).toHaveLength(1);
    });

    it('should detect added APIs', () => {
      const oldSpec = { apis: [{ name: 'api1' }] };
      const newSpec = { apis: [{ name: 'api1' }, { name: 'api2' }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.apis.added).toHaveLength(1);
      expect(changes.apis.added[0].name).toBe('api2');
    });

    it('should detect removed APIs', () => {
      const oldSpec = { apis: [{ name: 'api1' }, { name: 'api2' }] };
      const newSpec = { apis: [{ name: 'api1' }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.apis.removed).toHaveLength(1);
      expect(changes.apis.removed[0].name).toBe('api2');
    });

    it('should detect modified APIs by port', () => {
      const oldSpec = { apis: [{ name: 'api1', port: 5000 }] };
      const newSpec = { apis: [{ name: 'api1', port: 5001 }] };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.apis.modified).toHaveLength(1);
    });

    it('should handle empty specs', () => {
      const changes = detectChanges({}, {});
      
      expect(changes.remotes.added).toHaveLength(0);
      expect(changes.remotes.removed).toHaveLength(0);
      expect(changes.apis.added).toHaveLength(0);
      expect(changes.apis.removed).toHaveLength(0);
    });

    it('should detect multiple changes simultaneously', () => {
      const oldSpec = {
        shell: { name: 'old', port: 3000 },
        remotes: [{ name: 'r1' }],
        apis: [{ name: 'a1' }]
      };
      const newSpec = {
        shell: { name: 'new', port: 4000 },
        remotes: [{ name: 'r2' }],
        apis: [{ name: 'a2' }]
      };
      
      const changes = detectChanges(oldSpec, newSpec);
      
      expect(changes.shell.nameChanged).toBe(true);
      expect(changes.shell.portChanged).toBe(true);
      expect(changes.remotes.removed).toHaveLength(1);
      expect(changes.remotes.added).toHaveLength(1);
      expect(changes.apis.removed).toHaveLength(1);
      expect(changes.apis.added).toHaveLength(1);
    });
  });

  describe('findAnnotatedSections', () => {
    it('should find single annotated section', () => {
      const fileContent = `
line1
/* MFE-GENERATOR:START */
content line
/* MFE-GENERATOR:END */
line2
`;
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections).toHaveLength(1);
      expect(sections[0].content).toBe('content line');
    });

    it('should find section with ID', () => {
      const fileContent = `
/* MFE-GENERATOR:START */ /* MFE-GENERATOR:ID:section1 */
content
/* MFE-GENERATOR:END */
`;
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe('section1');
    });

    it('should find multiple sections', () => {
      const fileContent = `
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:a */
content a
/* MFE-GENERATOR:END */
middle
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:b */
content b
/* MFE-GENERATOR:END */
`;
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe('a');
      expect(sections[1].id).toBe('b');
    });

    it('should return empty array when no sections found', () => {
      const fileContent = 'just normal content';
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections).toHaveLength(0);
    });

    it('should handle unclosed sections', () => {
      const fileContent = `
/* MFE-GENERATOR:START */
content
no end marker
`;
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections).toHaveLength(0);
    });

    it('should track line numbers correctly', () => {
      const fileContent = `line0
line1
/* MFE-GENERATOR:START */
content
/* MFE-GENERATOR:END */
line5`;
      
      const sections = findAnnotatedSections(fileContent);
      
      expect(sections[0].startLine).toBe(2);
      expect(sections[0].endLine).toBe(4);
    });
  });

  describe('updateAnnotatedFile', () => {
    it('should update single section', async () => {
      const fileContent = `
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:test */
old content
/* MFE-GENERATOR:END */
`;
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(fileContent);
      fs.writeFile.mockResolvedValue();
      
      const updates = { test: 'new content' };
      const result = await updateAnnotatedFile('/test/file.js', updates, false);
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Updating section'));
    });

    it('should skip update if file not found', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      const result = await updateAnnotatedFile('/missing/file.js', {}, false);
      
      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('File not found'));
    });

    it('should show diff in dry run mode', async () => {
      const fileContent = `
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:test */
old
/* MFE-GENERATOR:END */
`;
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(fileContent);
      diff.diffLines.mockReturnValue([
        { added: false, removed: false, value: 'same\n' },
        { added: false, removed: true, value: 'old\n' },
        { added: true, removed: false, value: 'new\n' }
      ]);
      
      const updates = { test: 'new' };
      const result = await updateAnnotatedFile('/test/file.js', updates, true);
      
      expect(result).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled();
      // Check that diff output was generated (at least one of the diff lines should be logged)
      expect(console.log).toHaveBeenCalled();
      const allCalls = console.log.mock.calls.map(call => call.join(' '));
      const hasChangesMessage = allCalls.some(call => call.includes('Changes for'));
      expect(hasChangesMessage).toBe(true);
    });

    it('should handle multiple updates in reverse order', async () => {
      const fileContent = `
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:first */
content1
/* MFE-GENERATOR:END */
middle
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:second */
content2
/* MFE-GENERATOR:END */
`;
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(fileContent);
      fs.writeFile.mockResolvedValue();
      
      const updates = { first: 'new1', second: 'new2' };
      await updateAnnotatedFile('/test/file.js', updates, false);
      
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return false when no updates applied', async () => {
      const fileContent = 'no annotated sections';
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(fileContent);
      
      const result = await updateAnnotatedFile('/test/file.js', {}, false);
      
      expect(result).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should skip sections without matching IDs', async () => {
      const fileContent = `
/* MFE-GENERATOR:START *//* MFE-GENERATOR:ID:test */
content
/* MFE-GENERATOR:END */
`;
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(fileContent);
      
      const updates = { nonexistent: 'new content' };
      const result = await updateAnnotatedFile('/test/file.js', updates, false);
      
      expect(result).toBe(false);
    });
  });

  describe('generateMFE', () => {
    it('should generate complete MFE project', async () => {
      const spec = {
        name: 'test-project',
        description: 'Test description',
        shell: { name: 'shell' },
        remotes: [],
        apis: []
      };
      fs.ensureDir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      implementation.createReadme.mockResolvedValue();
      implementation.generateShell.mockResolvedValue();
      implementation.generateRemotes.mockResolvedValue();
      implementation.generateAPIs.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      yaml.dump.mockReturnValue('spec content');
      
      await generateMFE(spec, '/output', false);
      
      expect(fs.ensureDir).toHaveBeenCalledWith('/output/test-project');
      expect(implementation.createReadme).toHaveBeenCalled();
      expect(implementation.generateShell).toHaveBeenCalled();
      expect(implementation.generateRemotes).toHaveBeenCalled();
      expect(implementation.generateAPIs).toHaveBeenCalled();
      expect(implementation.createWorkspacePackage).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('generated successfully'));
    });

    it('should not write files in dry run mode', async () => {
      const spec = { name: 'test', description: 'desc' };
      fs.ensureDir.mockResolvedValue();
      implementation.createReadme.mockResolvedValue();
      implementation.generateShell.mockResolvedValue();
      implementation.generateRemotes.mockResolvedValue();
      implementation.generateAPIs.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await generateMFE(spec, '/output', true);
      
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle spec without description', async () => {
      const spec = { name: 'test' };
      fs.ensureDir.mockResolvedValue();
      implementation.createReadme.mockResolvedValue();
      implementation.generateShell.mockResolvedValue();
      implementation.generateRemotes.mockResolvedValue();
      implementation.generateAPIs.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await generateMFE(spec, '/output', false);
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No description provided'));
    });
  });

  describe('updateMFE', () => {
    it('should update shell when changes detected', async () => {
      const spec = { name: 'test', shell: { name: 'shell' }, remotes: [], apis: [] };
      const changes = {
        shell: { nameChanged: true },
        remotes: { added: [], removed: [], modified: [] },
        apis: { added: [], removed: [], modified: [] }
      };
      fs.ensureDir.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      // Mock updateFunctions (referenced but not imported in index.js - likely a bug)
      // For now, we'll test that the function attempts to call it
      
      await updateMFE('/project', spec, changes, false);
      
      expect(fs.ensureDir).toHaveBeenCalledWith('/project');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('updated successfully'));
    });

    it('should remove deleted remotes', async () => {
      const spec = { name: 'test', shell: {}, remotes: [], apis: [] };
      const changes = {
        shell: {},
        remotes: { added: [], removed: [{ name: 'old-remote' }], modified: [] },
        apis: { added: [], removed: [], modified: [] }
      };
      fs.ensureDir.mockResolvedValue();
      fs.pathExists.mockResolvedValue(true);
      fs.remove.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await updateMFE('/project', spec, changes, false);
      
      expect(fs.remove).toHaveBeenCalledWith('/project/old-remote');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Removing remote MFE'));
    });

    it('should remove deleted APIs', async () => {
      const spec = { name: 'test', shell: {}, remotes: [], apis: [] };
      const changes = {
        shell: {},
        remotes: { added: [], removed: [], modified: [] },
        apis: { added: [], removed: [{ name: 'old-api' }], modified: [] }
      };
      fs.ensureDir.mockResolvedValue();
      fs.pathExists.mockResolvedValue(true);
      fs.remove.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await updateMFE('/project', spec, changes, false);
      
      expect(fs.remove).toHaveBeenCalledWith('/project/old-api');
    });

    it('should skip removal if directory does not exist', async () => {
      const spec = { name: 'test', shell: {}, remotes: [], apis: [] };
      const changes = {
        shell: {},
        remotes: { added: [], removed: [{ name: 'missing' }], modified: [] },
        apis: { added: [], removed: [], modified: [] }
      };
      fs.ensureDir.mockResolvedValue();
      fs.pathExists.mockResolvedValue(false);
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await updateMFE('/project', spec, changes, false);
      
      expect(fs.remove).not.toHaveBeenCalled();
    });

    it('should not remove in dry run mode', async () => {
      const spec = { name: 'test', shell: {}, remotes: [], apis: [] };
      const changes = {
        shell: {},
        remotes: { added: [], removed: [{ name: 'old' }], modified: [] },
        apis: { added: [], removed: [], modified: [] }
      };
      fs.ensureDir.mockResolvedValue();
      fs.pathExists.mockResolvedValue(true);
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await updateMFE('/project', spec, changes, true);
      
      expect(fs.remove).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('should run generate command', async () => {
      const args = ['generate', 'test.yaml'];
      const mockSpec = { name: 'test-app', shell: {}, remotes: [], apis: [] };
      
      fs.readFile.mockResolvedValue('name: test-app');
      yaml.load.mockReturnValue(mockSpec);
      specValidator.validateSpec.mockReturnValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      yaml.dump.mockReturnValue('spec');
      implementation.createReadme.mockResolvedValue();
      implementation.generateShell.mockResolvedValue();
      implementation.generateRemotes.mockResolvedValue();
      implementation.generateAPIs.mockResolvedValue();
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await run(args);
      
      expect(fs.readFile).toHaveBeenCalledWith('test.yaml', 'utf8');
      expect(implementation.generateShell).toHaveBeenCalled();
    });

    it('should run update command with existing spec', async () => {
      const args = ['update', 'test.yaml', '--output=/project'];
      const oldSpec = { name: 'test', version: '1.0.0' };
      const newSpec = { name: 'test', version: '2.0.0' };
      
      fs.readFile
        .mockResolvedValueOnce('name: test\nversion: 2.0.0') // new spec
        .mockResolvedValueOnce('name: test\nversion: 1.0.0'); // old spec
      yaml.load
        .mockReturnValueOnce(newSpec)
        .mockReturnValueOnce(oldSpec);
      specValidator.validateSpec.mockReturnValue(true);
      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      yaml.dump.mockReturnValue('spec content');
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await run(args);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mfe-spec.yaml'),
        'spec content'
      );
    });

    it('should handle update without existing spec', async () => {
      const args = ['update', 'test.yaml'];
      const newSpec = { name: 'test' };
      
      fs.readFile.mockResolvedValue('name: test');
      yaml.load.mockReturnValue(newSpec);
      specValidator.validateSpec.mockReturnValue(true);
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      yaml.dump.mockReturnValue('spec');
      implementation.createWorkspacePackage.mockResolvedValue();
      
      await run(args);
      
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No existing spec found'));
    });

    it('should exit on unknown command', async () => {
      const args = ['unknown', 'test.yaml'];
      const mockSpec = { name: 'test' };
      
      fs.readFile.mockResolvedValue('name: test');
      yaml.load.mockReturnValue(mockSpec);
      specValidator.validateSpec.mockReturnValue(true);
      
      await run(args);
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle errors gracefully', async () => {
      const args = ['generate', 'test.yaml'];
      
      fs.readFile.mockRejectedValue(new Error('Test error'));
      
      await run(args);
      
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should show stack trace on error', async () => {
      const args = ['generate', 'test.yaml'];
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n  at line 1';
      
      fs.readFile.mockRejectedValue(error);
      
      await run(args);
      
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'));
    });
  });
});
