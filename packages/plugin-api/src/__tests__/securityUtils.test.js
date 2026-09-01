const crypto = require('crypto');
const {
  generateSecureSecret,
  generateJWTSecret,
  generateAPIKey,
  generateSessionSecret
} = require('../securityUtils');

// Mock crypto to control randomness for testing
jest.mock('crypto');

describe('securityUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecureSecret', () => {
    it('should generate a secret with default length of 64 bytes', () => {
      const mockBuffer = Buffer.from('a'.repeat(64));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSecureSecret();

      expect(crypto.randomBytes).toHaveBeenCalledWith(64);
      expect(typeof result).toBe('string');
    });

    it('should generate a secret with custom length', () => {
      const mockBuffer = Buffer.from('b'.repeat(32));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSecureSecret(32);

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(typeof result).toBe('string');
    });

    it('should return base64url encoded string', () => {
      const mockBuffer = Buffer.from('test');
      mockBuffer.toString = jest.fn().mockReturnValue('base64url-encoded');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateSecureSecret(16);

      expect(mockBuffer.toString).toHaveBeenCalledWith('base64url');
    });

    it('should generate different secrets on multiple calls', () => {
      // Mock different random bytes for each call
      let callCount = 0;
      crypto.randomBytes.mockImplementation((length) => {
        callCount++;
        return Buffer.from(`unique-${callCount}`.repeat(Math.ceil(length / 10)));
      });

      const secret1 = generateSecureSecret();
      const secret2 = generateSecureSecret();

      expect(secret1).not.toBe(secret2);
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
    });

    it('should handle small length values', () => {
      const mockBuffer = Buffer.from('x');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSecureSecret(1);

      expect(crypto.randomBytes).toHaveBeenCalledWith(1);
      expect(typeof result).toBe('string');
    });

    it('should handle large length values', () => {
      const mockBuffer = Buffer.from('z'.repeat(256));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSecureSecret(256);

      expect(crypto.randomBytes).toHaveBeenCalledWith(256);
      expect(typeof result).toBe('string');
    });
  });

  describe('generateJWTSecret', () => {
    it('should generate a JWT secret with 64 byte length', () => {
      const mockBuffer = Buffer.from('jwt'.repeat(22));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateJWTSecret();

      expect(crypto.randomBytes).toHaveBeenCalledWith(64);
      expect(typeof result).toBe('string');
    });

    it('should return base64url encoded string', () => {
      const mockBuffer = Buffer.from('jwt-secret');
      mockBuffer.toString = jest.fn().mockReturnValue('jwt-encoded');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateJWTSecret();

      expect(mockBuffer.toString).toHaveBeenCalledWith('base64url');
      expect(result).toBe('jwt-encoded');
    });

    it('should delegate to generateSecureSecret', () => {
      const mockBuffer = Buffer.from('jwt-test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateJWTSecret();

      // Should call crypto.randomBytes with 64 (default for generateSecureSecret)
      expect(crypto.randomBytes).toHaveBeenCalledWith(64);
    });

    it('should generate unique secrets on multiple calls', () => {
      let callCount = 0;
      crypto.randomBytes.mockImplementation(() => {
        callCount++;
        return Buffer.from(`jwt-${callCount}`.repeat(20));
      });

      const jwt1 = generateJWTSecret();
      const jwt2 = generateJWTSecret();

      expect(jwt1).not.toBe(jwt2);
    });
  });

  describe('generateAPIKey', () => {
    it('should generate an API key with 32 byte length', () => {
      const mockBuffer = Buffer.from('api'.repeat(11));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateAPIKey();

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(typeof result).toBe('string');
    });

    it('should return base64url encoded string', () => {
      const mockBuffer = Buffer.from('api-key');
      mockBuffer.toString = jest.fn().mockReturnValue('api-encoded');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateAPIKey();

      expect(mockBuffer.toString).toHaveBeenCalledWith('base64url');
      expect(result).toBe('api-encoded');
    });

    it('should delegate to generateSecureSecret with 32 bytes', () => {
      const mockBuffer = Buffer.from('api-test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateAPIKey();

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should generate unique API keys on multiple calls', () => {
      let callCount = 0;
      crypto.randomBytes.mockImplementation(() => {
        callCount++;
        return Buffer.from(`api-${callCount}`.repeat(10));
      });

      const key1 = generateAPIKey();
      const key2 = generateAPIKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate shorter secrets than JWT (32 vs 64 bytes)', () => {
      const mockBuffer = Buffer.from('test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateAPIKey();
      const apiKeyCall = crypto.randomBytes.mock.calls[0][0];

      crypto.randomBytes.mockClear();
      generateJWTSecret();
      const jwtCall = crypto.randomBytes.mock.calls[0][0];

      expect(apiKeyCall).toBe(32);
      expect(jwtCall).toBe(64);
      expect(apiKeyCall).toBeLessThan(jwtCall);
    });
  });

  describe('generateSessionSecret', () => {
    it('should generate a session secret with 48 byte length', () => {
      const mockBuffer = Buffer.from('session'.repeat(7));
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSessionSecret();

      expect(crypto.randomBytes).toHaveBeenCalledWith(48);
      expect(typeof result).toBe('string');
    });

    it('should return base64url encoded string', () => {
      const mockBuffer = Buffer.from('session-secret');
      mockBuffer.toString = jest.fn().mockReturnValue('session-encoded');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      const result = generateSessionSecret();

      expect(mockBuffer.toString).toHaveBeenCalledWith('base64url');
      expect(result).toBe('session-encoded');
    });

    it('should delegate to generateSecureSecret with 48 bytes', () => {
      const mockBuffer = Buffer.from('session-test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateSessionSecret();

      expect(crypto.randomBytes).toHaveBeenCalledWith(48);
    });

    it('should generate unique session secrets on multiple calls', () => {
      let callCount = 0;
      crypto.randomBytes.mockImplementation(() => {
        callCount++;
        return Buffer.from(`session-${callCount}`.repeat(15));
      });

      const session1 = generateSessionSecret();
      const session2 = generateSessionSecret();

      expect(session1).not.toBe(session2);
    });

    it('should use medium length (48 bytes) between API key (32) and JWT (64)', () => {
      const mockBuffer = Buffer.from('test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateAPIKey();
      const apiKeyLength = crypto.randomBytes.mock.calls[0][0];

      crypto.randomBytes.mockClear();
      generateSessionSecret();
      const sessionLength = crypto.randomBytes.mock.calls[0][0];

      crypto.randomBytes.mockClear();
      generateJWTSecret();
      const jwtLength = crypto.randomBytes.mock.calls[0][0];

      expect(sessionLength).toBe(48);
      expect(sessionLength).toBeGreaterThan(apiKeyLength);
      expect(sessionLength).toBeLessThan(jwtLength);
    });
  });

  describe('Integration - All functions together', () => {
    it('should all use crypto.randomBytes for generation', () => {
      const mockBuffer = Buffer.from('test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateSecureSecret();
      generateJWTSecret();
      generateAPIKey();
      generateSessionSecret();

      expect(crypto.randomBytes).toHaveBeenCalledTimes(4);
    });

    it('should all return base64url encoded strings', () => {
      const mockBuffer = Buffer.from('integration-test');
      mockBuffer.toString = jest.fn().mockReturnValue('encoded');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateSecureSecret();
      generateJWTSecret();
      generateAPIKey();
      generateSessionSecret();

      expect(mockBuffer.toString).toHaveBeenCalledTimes(4);
      expect(mockBuffer.toString).toHaveBeenCalledWith('base64url');
    });

    it('should generate secrets with correct byte lengths', () => {
      const mockBuffer = Buffer.from('test');
      crypto.randomBytes.mockReturnValue(mockBuffer);

      generateSecureSecret(); // default 64
      generateJWTSecret(); // 64
      generateAPIKey(); // 32
      generateSessionSecret(); // 48

      const calls = crypto.randomBytes.mock.calls.map(call => call[0]);
      expect(calls).toEqual([64, 64, 32, 48]);
    });
  });
});
