// Migration shim — init-angular now delegates to the unified remoteInitCommand.
// The standalone remoteInitAngularCommand is retired; use
// remoteInitCommand(name, { framework: 'angular' }) instead.
export { remoteInitCommand } from './remote/init';
