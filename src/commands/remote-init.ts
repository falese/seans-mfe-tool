// Migration shim: logic moved to src/commands/remote/init.ts (A6).
// Kept so existing imports don't break. Remove when A7 completes Commander removal.
export { remoteInitCommand } from './remote/init';
export { remoteInitCommand as default } from './remote/init';
