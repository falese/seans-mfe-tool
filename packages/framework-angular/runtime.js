// Node10 resolution compatibility (ADR-084).
//
// Generated MFEs compile with `moduleResolution: "node"`, which ignores the
// `exports` map and resolves `@falese/smt-<fw>/runtime` as a literal path.
// Without this forwarder the generated slots.tsx cannot find the DeclaredSlot
// it binds — "Cannot find module ... but this result could not be resolved
// under your current 'moduleResolution' setting". Modern resolvers use
// `exports` and never read this file.
module.exports = require('./dist/runtime/index.js');
