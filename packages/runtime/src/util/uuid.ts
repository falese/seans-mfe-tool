/**
 * Isomorphic UUID v4 generator.
 *
 * Prefers the Web Crypto API (available globally in browsers and in Node 19+,
 * and in Node 18+ when `--experimental-global-webcrypto` is enabled). Falls
 * back to an RFC4122 v4 string sourced from Math.random for older runtimes;
 * suitable for telemetry / envelope IDs, NOT for cryptographic use.
 *
 * Defined in @seans-mfe-tool/runtime to keep generated MFEs free of Node-only
 * imports (`crypto`) that would otherwise need browser stubs at bundle time.
 */
export function uuidv4(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
