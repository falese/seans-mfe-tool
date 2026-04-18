// Migration shim: BFF logic split into src/commands/bff/{init,build,dev,validate}.ts (A5).
// Kept so existing imports don't break. Remove when A7 completes Commander removal.
export { bffInitCommand } from './bff/init';
export { bffBuildCommand } from './bff/build';
export { bffDevCommand } from './bff/dev';
export { bffValidateCommand } from './bff/validate';
export { extractMeshConfig, writeMeshConfig, addMeshDependencies } from './bff/_shared';

export type {
  MeshConfig,
  MeshSource,
  MeshTransform,
  MeshPlugin,
  MeshServe,
  MFEManifest,
  DSLDataSection,
  BFFCommandOptions,
  ValidationResult,
  ExtractMeshConfigResult
} from './bff/_shared';
