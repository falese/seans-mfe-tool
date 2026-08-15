/**
 * Shared I/O for the control-plane composition commands (ADR-083).
 *
 * `build` and `validate` differ only in whether they write. Everything up to
 * that point — locate the document, parse it, load the fleet's manifests,
 * compile — is the same, so it lives here rather than in either command.
 *
 * The compiler itself is pure and lives in `@seans-mfe/dsl`; this file is the
 * I/O shell around it.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { ValidationError, SystemError } from '@seans-mfe/contracts';
import {
  compileControlPlane,
  ControlPlaneDocumentSchema,
  DSLManifestSchema,
  type CompiledRuleDocument,
  type ControlPlaneDocument,
  type ControlPlaneFinding,
  type DSLManifest,
} from '@seans-mfe/dsl';

/** The document filename, alongside the project's rules.json. */
export const DOCUMENT_FILENAME = 'control-plane.yaml';

/** The compiled output, which the registry consumes. */
export const PAYLOAD_FILENAME = 'rules.json';

export interface LoadedComposition {
  documentPath: string;
  payloadPath: string;
  document: ControlPlaneDocument;
  payload: CompiledRuleDocument[];
  findings: ControlPlaneFinding[];
}

/**
 * Resolve the composition document from a path that may name the file itself,
 * the `control-plane/` directory, or the project root.
 *
 * Accepting all three because every one of them is what someone will type: the
 * project root is where you are, `control-plane/` is where it lives, and the
 * file is what an editor gives you.
 */
export async function resolveDocumentPath(input: string): Promise<string> {
  const resolved = path.resolve(input);

  const candidates = (await fs.pathExists(resolved)) && (await fs.stat(resolved)).isDirectory()
    ? [
        path.join(resolved, DOCUMENT_FILENAME),
        path.join(resolved, 'control-plane', DOCUMENT_FILENAME),
      ]
    : [resolved];

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) return candidate;
  }

  throw new ValidationError(
    `No ${DOCUMENT_FILENAME} found at ${resolved}. Looked in: ${candidates.join(', ')}`,
    'project',
    'existing-composition-document'
  );
}

/**
 * MFE ids do not always match their directory names — abc-kids' `abc-kids-flappy`
 * lives in `flappy/`. Try the id, then the id with the project prefix stripped.
 */
async function findManifest(fleetRoot: string, mfeId: string, project: string): Promise<string> {
  const candidates = [
    path.join(fleetRoot, mfeId, 'mfe-manifest.yaml'),
    path.join(fleetRoot, mfeId.replace(new RegExp(`^${project}-`), ''), 'mfe-manifest.yaml'),
  ];

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) return candidate;
  }

  throw new ValidationError(
    `No mfe-manifest.yaml for "${mfeId}". Looked in: ${candidates
      .map((c) => path.relative(fleetRoot, c))
      .join(', ')}`,
    'mfes',
    'existing-manifest'
  );
}

function parseYamlFile<T>(filePath: string, contents: string): T {
  try {
    return yaml.load(contents) as T;
  } catch (error) {
    throw new ValidationError(
      `Could not parse ${filePath} as YAML: ${(error as Error).message}`,
      'document',
      'valid-yaml'
    );
  }
}

/** Load, parse and compile a project's composition. */
export async function loadComposition(input: string): Promise<LoadedComposition> {
  const documentPath = await resolveDocumentPath(input);
  const controlPlaneDir = path.dirname(documentPath);
  // The fleet root is the project directory: control-plane/ sits inside it.
  const fleetRoot =
    path.basename(controlPlaneDir) === 'control-plane'
      ? path.dirname(controlPlaneDir)
      : controlPlaneDir;

  const raw = parseYamlFile<unknown>(documentPath, await fs.readFile(documentPath, 'utf8'));
  const parsed = ControlPlaneDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new ValidationError(
      `${path.relative(process.cwd(), documentPath)} is not a valid composition document:\n${issues}`,
      'document',
      'valid-control-plane-document'
    );
  }
  const document = parsed.data;

  const manifests: DSLManifest[] = [];
  for (const mfeId of document.mfes) {
    const manifestPath = await findManifest(fleetRoot, mfeId, document.project);
    const manifestRaw = parseYamlFile<unknown>(
      manifestPath,
      await fs.readFile(manifestPath, 'utf8')
    );
    const manifest = DSLManifestSchema.safeParse(manifestRaw);
    if (!manifest.success) {
      throw new SystemError(
        `${path.relative(process.cwd(), manifestPath)} is not a valid MFE manifest: ` +
          manifest.error.issues.map((i) => i.message).join('; ')
      );
    }
    manifests.push(manifest.data);
  }

  const { payload, findings } = compileControlPlane({ document, manifests });

  return {
    documentPath,
    payloadPath: path.join(controlPlaneDir, PAYLOAD_FILENAME),
    document,
    payload,
    findings,
  };
}

/** The payload as it is written to disk — the registry's own shape, stable across runs. */
export function renderPayload(payload: CompiledRuleDocument[]): string {
  return JSON.stringify(payload, null, 2) + '\n';
}
