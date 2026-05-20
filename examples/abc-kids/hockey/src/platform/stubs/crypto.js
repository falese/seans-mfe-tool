// Browser stub for Node's 'crypto' module.
// The runtime uses randomUUID() — delegate to the Web Crypto API.
module.exports = {
  randomUUID: () => globalThis.crypto.randomUUID(),
};
