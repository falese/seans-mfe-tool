const crypto = require('crypto');

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the generated string
 * @returns {string} Secure random string
 */
function generateSecureSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate a secure JWT secret with warning comment
 * @returns {string} Secure JWT secret
 */
function generateJWTSecret() {
  return generateSecureSecret(64);
}

/**
 * Generate a secure API key
 * @returns {string} Secure API key
 */
function generateAPIKey() {
  return generateSecureSecret(32);
}

/**
 * Generate a secure session secret
 * @returns {string} Secure session secret
 */
function generateSessionSecret() {
  return generateSecureSecret(48);
}

module.exports = {
  generateSecureSecret,
  generateJWTSecret,
  generateAPIKey,
  generateSessionSecret,
};
