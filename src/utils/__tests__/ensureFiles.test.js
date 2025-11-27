const fs = require('fs-extra');
const path = require('path');
const {
  ensureMiddleware,
  ensureUtils
} = require('../ensureFiles');

// Mock fs-extra
jest.mock('fs-extra');

describe('ensureFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureMiddleware', () => {
    const middlewareDir = '/test/middleware';

    it('should ensure all three middleware files exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.pathExists).toHaveBeenCalledTimes(3);
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(middlewareDir, 'auth.js'));
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(middlewareDir, 'errorHandler.js'));
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(middlewareDir, 'validator.js'));
    });

    it('should create auth.js if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(middlewareDir, 'auth.js'),
        ''
      );
    });

    it('should create errorHandler.js if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(middlewareDir, 'errorHandler.js'),
        ''
      );
    });

    it('should create validator.js if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(middlewareDir, 'validator.js'),
        ''
      );
    });

    it('should not create files that already exist', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should create only missing files when some exist', async () => {
      // auth.js exists, errorHandler.js and validator.js do not
      fs.pathExists.mockImplementation(async (filePath) => {
        return filePath.includes('auth.js');
      });
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      expect(fs.pathExists).toHaveBeenCalledTimes(3);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(middlewareDir, 'errorHandler.js'),
        ''
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(middlewareDir, 'validator.js'),
        ''
      );
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        path.join(middlewareDir, 'auth.js'),
        expect.anything()
      );
    });

    it('should handle different middleware directory paths', async () => {
      const customDir = '/custom/path/to/middleware';
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(customDir);

      expect(fs.pathExists).toHaveBeenCalledWith(path.join(customDir, 'auth.js'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(customDir, 'auth.js'),
        ''
      );
    });

    it('should create files with empty content', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware(middlewareDir);

      const writeCalls = fs.writeFile.mock.calls;
      expect(writeCalls).toHaveLength(3);
      expect(writeCalls[0][1]).toBe('');
      expect(writeCalls[1][1]).toBe('');
      expect(writeCalls[2][1]).toBe('');
    });

    it('should process files sequentially', async () => {
      const checkOrder = [];
      fs.pathExists.mockImplementation(async (filePath) => {
        checkOrder.push(`check-${path.basename(filePath)}`);
        return false;
      });
      fs.writeFile.mockImplementation(async (filePath) => {
        checkOrder.push(`write-${path.basename(filePath)}`);
      });

      await ensureMiddleware(middlewareDir);

      expect(checkOrder).toEqual([
        'check-auth.js',
        'write-auth.js',
        'check-errorHandler.js',
        'write-errorHandler.js',
        'check-validator.js',
        'write-validator.js'
      ]);
    });
  });

  describe('ensureUtils', () => {
    const utilsDir = '/test/utils';

    it('should ensure all two utils files exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      expect(fs.pathExists).toHaveBeenCalledTimes(2);
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(utilsDir, 'logger.js'));
      expect(fs.pathExists).toHaveBeenCalledWith(path.join(utilsDir, 'response.js'));
    });

    it('should create logger.js if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(utilsDir, 'logger.js'),
        ''
      );
    });

    it('should create response.js if it does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(utilsDir, 'response.js'),
        ''
      );
    });

    it('should not create files that already exist', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should create only missing files when some exist', async () => {
      // logger.js exists, response.js does not
      fs.pathExists.mockImplementation(async (filePath) => {
        return filePath.includes('logger.js');
      });
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      expect(fs.pathExists).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(utilsDir, 'response.js'),
        ''
      );
      expect(fs.writeFile).not.toHaveBeenCalledWith(
        path.join(utilsDir, 'logger.js'),
        expect.anything()
      );
    });

    it('should handle different utils directory paths', async () => {
      const customDir = '/custom/path/to/utils';
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(customDir);

      expect(fs.pathExists).toHaveBeenCalledWith(path.join(customDir, 'logger.js'));
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(customDir, 'logger.js'),
        ''
      );
    });

    it('should create files with empty content', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureUtils(utilsDir);

      const writeCalls = fs.writeFile.mock.calls;
      expect(writeCalls).toHaveLength(2);
      expect(writeCalls[0][1]).toBe('');
      expect(writeCalls[1][1]).toBe('');
    });

    it('should process files sequentially', async () => {
      const checkOrder = [];
      fs.pathExists.mockImplementation(async (filePath) => {
        checkOrder.push(`check-${path.basename(filePath)}`);
        return false;
      });
      fs.writeFile.mockImplementation(async (filePath) => {
        checkOrder.push(`write-${path.basename(filePath)}`);
      });

      await ensureUtils(utilsDir);

      expect(checkOrder).toEqual([
        'check-logger.js',
        'write-logger.js',
        'check-response.js',
        'write-response.js'
      ]);
    });
  });

  describe('Integration - Both functions', () => {
    it('should be independent functions', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware('/middleware');
      expect(fs.writeFile).toHaveBeenCalledTimes(3);

      fs.writeFile.mockClear();

      await ensureUtils('/utils');
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should use same fs-extra API for both', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.writeFile.mockResolvedValue(undefined);

      await ensureMiddleware('/middleware');
      await ensureUtils('/utils');

      // Both should use pathExists and writeFile
      expect(fs.pathExists).toHaveBeenCalledTimes(5); // 3 + 2
      expect(fs.writeFile).toHaveBeenCalledTimes(5); // 3 + 2
    });
  });
});
