/**
 * @seans-mfe/decompose — the decomposition proposal model (ADR-110, ADR-118).
 *
 * `decomposition.yaml` and its named edits, the fleet derived from it, the
 * read model the workspace renders, the agent's checked suggestions, and the
 * proposal directory on disk. The `decompose:*` commands wrap it; the
 * workspace and the coder seam import it.
 */

export * from './model';
export * from './backends';
export * from './edit';
export * from './openapi';
export * from './derive';
export * from './present';
export * from './status';
export * from './files';
export * from './edit-file';
export * from './ask';
