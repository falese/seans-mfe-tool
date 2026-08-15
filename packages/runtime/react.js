// Node10 resolution compatibility (ADR-084).
//
// Generated MFEs compile with `moduleResolution: "node"`, which ignores the
// `exports` map entirely and resolves `@falese/smt-runtime/react` as a literal
// path. Without this forwarder that path does not exist — the compiled output
// lives under dist/ — and `RemoteMFE` silently fails to resolve, so the
// generated class extends nothing and every inherited capability disappears.
// Modern resolvers use `exports` and never read this file.
module.exports = require('./dist/react.js');
