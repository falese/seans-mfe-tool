// Migration shim: logic moved to src/commands/remote/generate.ts (A6).
// Kept so existing imports don't break. Remove when A7 completes Commander removal.
export { remoteGenerateCommand } from './remote/generate';
export { remoteGenerateCommand as default } from './remote/generate';
