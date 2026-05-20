// Browser build stub for Node.js 'crypto' module.
// randomUUID is the only function used; delegate to the Web Crypto API.
module.exports = {
  randomUUID: () => globalThis.crypto.randomUUID(),
};
