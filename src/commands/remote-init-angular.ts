// Migration shim — actual logic lives in src/commands/remote/init-angular.ts
// Matches the pattern of remote-init.ts. Remove when the Commander entry path
// retires.
export { remoteInitAngularCommand } from './remote/init-angular';
export { remoteInitAngularCommand as default } from './remote/init-angular';
