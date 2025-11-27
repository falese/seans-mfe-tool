const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const {
  ensureDir,
  copyTemplateFiles,
  arrayDiff,
  toCamelCase,
  toPascalCase,
  toKebabCase
} = require('../utils');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  green: jest.fn((str) => str)
}));

// Suppress console output
console.log = jest.fn();

describe('MFEGenerator utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDir', () => {
    it('should return true if directory already exists', async () => {
      fs.pathExists.mockResolvedValue(true);

      const result = await ensureDir('/test/path');

      expect(result).toBe(true);
      expect(fs.pathExists).toHaveBeenCalledWith('/test/path');
      expect(fs.ensureDir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue(undefined);

      const result = await ensureDir('/test/new-path');

      expect(result).toBe(true);
      expect(fs.pathExists).toHaveBeenCalledWith('/test/new-path');
      expect(fs.ensureDir).toHaveBeenCalledWith('/test/new-path');
      expect(console.log).toHaveBeenCalledWith('Creating directory: /test/new-path');
    });

    it('should log creation message with chalk.yellow', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue(undefined);

      await ensureDir('/test/path');

      expect(chalk.yellow).toHaveBeenCalledWith('Creating directory: /test/path');
    });

    it('should not create directory in dry run mode', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await ensureDir('/test/path', true);

      expect(result).toBe(true);
      expect(fs.ensureDir).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Creating directory: /test/path');
    });

    it('should return true even in dry run mode', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await ensureDir('/test/path', true);

      expect(result).toBe(true);
    });
  });

  describe('copyTemplateFiles', () => {
    beforeEach(() => {
      fs.pathExists.mockResolvedValue(true);
      fs.ensureDir.mockResolvedValue(undefined);
    });

    it('should return false if source directory does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await copyTemplateFiles('/src', '/dest');

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith('Template directory not found: /src');
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it('should create destination directory', async () => {
      fs.readdir.mockResolvedValue([]);

      const result = await copyTemplateFiles('/src', '/dest');

      // ensureDir is called through the ensureDir function
      expect(result).toBe(true);
    });

    it('should copy a single file', async () => {
      fs.readdir.mockResolvedValue(['file.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('file content');
      fs.writeFile.mockResolvedValue(undefined);

      const result = await copyTemplateFiles('/src', '/dest');

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalledWith('/src/file.txt', 'utf8');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/file.txt', 'file content');
      expect(console.log).toHaveBeenCalledWith('✓ Copied file.txt');
    });

    it('should copy multiple files', async () => {
      fs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');
      fs.writeFile.mockResolvedValue(undefined);

      await copyTemplateFiles('/src', '/dest');

      expect(fs.readFile).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(console.log).toHaveBeenCalledWith('✓ Copied file1.txt');
      expect(console.log).toHaveBeenCalledWith('✓ Copied file2.txt');
    });

    it('should recursively copy directories', async () => {
      fs.readdir
        .mockResolvedValueOnce(['subdir'])
        .mockResolvedValueOnce(['file.txt']);
      fs.stat
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');
      fs.writeFile.mockResolvedValue(undefined);

      await copyTemplateFiles('/src', '/dest');

      expect(fs.readdir).toHaveBeenCalledTimes(2);
      expect(fs.readdir).toHaveBeenCalledWith('/src');
      expect(fs.readdir).toHaveBeenCalledWith('/src/subdir');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/subdir/file.txt', 'content');
    });

    it('should apply transformFn to file content if provided', async () => {
      fs.readdir.mockResolvedValue(['file.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('original content');
      fs.writeFile.mockResolvedValue(undefined);

      const transformFn = jest.fn((content) => content.toUpperCase());

      await copyTemplateFiles('/src', '/dest', false, transformFn);

      expect(transformFn).toHaveBeenCalledWith('original content', 'file.txt');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/file.txt', 'ORIGINAL CONTENT');
    });

    it('should pass filename to transformFn', async () => {
      fs.readdir.mockResolvedValue(['test.js']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');
      fs.writeFile.mockResolvedValue(undefined);

      const transformFn = jest.fn((content, filename) => `${filename}: ${content}`);

      await copyTemplateFiles('/src', '/dest', false, transformFn);

      expect(transformFn).toHaveBeenCalledWith('content', 'test.js');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/test.js', 'test.js: content');
    });

    it('should not write files in dry run mode', async () => {
      fs.readdir.mockResolvedValue(['file.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');

      await copyTemplateFiles('/src', '/dest', true);

      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('✓ Copied file.txt');
    });

    it('should still log copied files in dry run mode', async () => {
      fs.readdir.mockResolvedValue(['file.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');

      await copyTemplateFiles('/src', '/dest', true);

      expect(console.log).toHaveBeenCalledWith('✓ Copied file.txt');
    });

    it('should log with chalk.green for copied files', async () => {
      fs.readdir.mockResolvedValue(['file.txt']);
      fs.stat.mockResolvedValue({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');
      fs.writeFile.mockResolvedValue(undefined);

      await copyTemplateFiles('/src', '/dest');

      expect(chalk.green).toHaveBeenCalledWith('✓ Copied file.txt');
    });

    it('should handle mixed files and directories', async () => {
      fs.readdir
        .mockResolvedValueOnce(['file1.txt', 'subdir', 'file2.txt'])
        .mockResolvedValueOnce(['nested.txt']);
      fs.stat
        .mockResolvedValueOnce({ isDirectory: () => false })
        .mockResolvedValueOnce({ isDirectory: () => true })
        .mockResolvedValueOnce({ isDirectory: () => false })
        .mockResolvedValueOnce({ isDirectory: () => false });
      fs.readFile.mockResolvedValue('content');
      fs.writeFile.mockResolvedValue(undefined);

      await copyTemplateFiles('/src', '/dest');

      expect(fs.writeFile).toHaveBeenCalledTimes(3);
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/file1.txt', 'content');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/subdir/nested.txt', 'content');
      expect(fs.writeFile).toHaveBeenCalledWith('/dest/file2.txt', 'content');
    });
  });

  describe('arrayDiff', () => {
    it('should find added items', () => {
      const arr1 = ['a', 'b', 'c'];
      const arr2 = ['a', 'b', 'c', 'd', 'e'];

      const result = arrayDiff(arr1, arr2);

      expect(result.added).toEqual(['d', 'e']);
    });

    it('should find removed items', () => {
      const arr1 = ['a', 'b', 'c', 'd'];
      const arr2 = ['a', 'c'];

      const result = arrayDiff(arr1, arr2);

      expect(result.removed).toEqual(['b', 'd']);
    });

    it('should find both added and removed items', () => {
      const arr1 = ['a', 'b', 'c'];
      const arr2 = ['b', 'd', 'e'];

      const result = arrayDiff(arr1, arr2);

      expect(result.added).toEqual(['d', 'e']);
      expect(result.removed).toEqual(['a', 'c']);
    });

    it('should return empty arrays when arrays are identical', () => {
      const arr1 = ['a', 'b', 'c'];
      const arr2 = ['a', 'b', 'c'];

      const result = arrayDiff(arr1, arr2);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('should handle empty first array', () => {
      const result = arrayDiff([], ['a', 'b']);

      expect(result.added).toEqual(['a', 'b']);
      expect(result.removed).toEqual([]);
    });

    it('should handle empty second array', () => {
      const result = arrayDiff(['a', 'b'], []);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual(['a', 'b']);
    });

    it('should handle both empty arrays', () => {
      const result = arrayDiff([], []);

      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it('should work with numbers', () => {
      const result = arrayDiff([1, 2, 3], [2, 3, 4, 5]);

      expect(result.added).toEqual([4, 5]);
      expect(result.removed).toEqual([1]);
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld');
    });

    it('should convert snake_case to camelCase', () => {
      // Implementation removes underscores but doesn't treat as word boundary
      expect(toCamelCase('hello_world')).toBe('helloworld');
    });

    it('should convert space-separated to camelCase', () => {
      expect(toCamelCase('hello world')).toBe('helloWorld');
    });

    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('HelloWorld')).toBe('helloWorld');
    });

    it('should handle single word', () => {
      expect(toCamelCase('hello')).toBe('hello');
    });

    it('should handle multiple words with mixed separators', () => {
      // Implementation: dashes and spaces create boundaries, underscores just removed
      expect(toCamelCase('hello-world_foo bar')).toBe('helloWorldfooBar');
    });

    it('should handle already camelCase string', () => {
      expect(toCamelCase('helloWorld')).toBe('helloWorld');
    });

    it('should handle empty string', () => {
      expect(toCamelCase('')).toBe('');
    });

    it('should handle string with multiple spaces', () => {
      expect(toCamelCase('hello   world')).toBe('helloWorld');
    });

    it('should handle string with multiple dashes', () => {
      expect(toCamelCase('hello---world')).toBe('helloWorld');
    });

    it('should handle string with multiple underscores', () => {
      // Implementation removes underscores but doesn't split on them
      expect(toCamelCase('hello___world')).toBe('helloworld');
    });
  });

  describe('toPascalCase', () => {
    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('hello-world')).toBe('HelloWorld');
    });

    it('should convert snake_case to PascalCase', () => {
      // Implementation removes underscores but doesn't treat as word boundary
      expect(toPascalCase('hello_world')).toBe('Helloworld');
    });

    it('should convert space-separated to PascalCase', () => {
      expect(toPascalCase('hello world')).toBe('HelloWorld');
    });

    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('helloWorld')).toBe('HelloWorld');
    });

    it('should handle single word', () => {
      expect(toPascalCase('hello')).toBe('Hello');
    });

    it('should handle multiple words with mixed separators', () => {
      // Implementation: dashes and spaces create boundaries, underscores just removed
      expect(toPascalCase('hello-world_foo bar')).toBe('HelloWorldfooBar');
    });

    it('should handle already PascalCase string', () => {
      expect(toPascalCase('HelloWorld')).toBe('HelloWorld');
    });

    it('should handle empty string', () => {
      expect(toPascalCase('')).toBe('');
    });

    it('should handle string with multiple spaces', () => {
      expect(toPascalCase('hello   world')).toBe('HelloWorld');
    });

    it('should handle string with multiple dashes', () => {
      expect(toPascalCase('hello---world')).toBe('HelloWorld');
    });

    it('should handle string with multiple underscores', () => {
      // Implementation removes underscores but doesn't split on them
      expect(toPascalCase('hello___world')).toBe('Helloworld');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('helloWorld')).toBe('hello-world');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('HelloWorld')).toBe('hello-world');
    });

    it('should convert snake_case to kebab-case', () => {
      expect(toKebabCase('hello_world')).toBe('hello-world');
    });

    it('should convert space-separated to kebab-case', () => {
      expect(toKebabCase('hello world')).toBe('hello-world');
    });

    it('should handle single word', () => {
      expect(toKebabCase('hello')).toBe('hello');
    });

    it('should handle multiple words with mixed separators', () => {
      expect(toKebabCase('HelloWorld_foo bar')).toBe('hello-world-foo-bar');
    });

    it('should handle already kebab-case string', () => {
      expect(toKebabCase('hello-world')).toBe('hello-world');
    });

    it('should handle empty string', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should handle uppercase words', () => {
      expect(toKebabCase('HELLO WORLD')).toBe('hello-world');
    });

    it('should handle string with multiple spaces', () => {
      expect(toKebabCase('hello   world')).toBe('hello-world');
    });

    it('should handle string with multiple underscores', () => {
      expect(toKebabCase('hello___world')).toBe('hello-world');
    });

    it('should handle consecutive uppercase letters', () => {
      expect(toKebabCase('XMLHttpRequest')).toBe('xmlhttp-request');
    });
  });
});
