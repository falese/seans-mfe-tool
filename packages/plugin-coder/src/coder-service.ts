/**
 * Out-of-process invocation of the external coder model service (ADR-085 §1,
 * ADR-019). Two transports — subprocess (`coder generate`) and a running
 * `coder serve` SSE endpoint — behind the injectable {@link CoderRunner} seam
 * so the compilation flow is unit-testable without a model.
 *
 * NOTHING here imports MLX, Python, weights, or the coder engine: the boundary
 * is a process/HTTP call to a replaceable binary (ADR-088 §2).
 */

import { execFile } from 'node:child_process';
import { BusinessError, NetworkError, SystemError } from '@seans-mfe/contracts';
import { stripFences } from './oracle';
import {
  DEFAULT_ADAPTOR,
  DEFAULT_CODER_BIN,
  type CandidateManifest,
  type CoderRunner,
  type IntentCompileRequest,
} from './types';

/** Assemble the `coder generate` argv from a request. */
export function buildGenerateArgs(request: IntentCompileRequest): string[] {
  const adaptor = request.adaptor ?? DEFAULT_ADAPTOR;
  const args = ['generate', request.intent, '--adaptor', adaptor];

  if (request.systemPromptPath) {
    args.push('--system', request.systemPromptPath);
  }
  if (request.model) {
    args.push('--model', request.model);
  }
  for (const file of request.context?.contextFiles ?? []) {
    args.push('--context', file);
  }
  return args;
}

/** Subprocess transport: spawn `coder generate …`, read the completion from stdout. */
export function makeSubprocessRunner(bin: string = DEFAULT_CODER_BIN): CoderRunner {
  return {
    generate(request: IntentCompileRequest): Promise<string> {
      const args = buildGenerateArgs(request);
      return new Promise<string>((resolve, reject) => {
        execFile(
          bin,
          args,
          { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' },
          (error, stdout, stderr) => {
            if (error) {
              const code = (error as NodeJS.ErrnoException).code;
              if (code === 'ENOENT') {
                reject(
                  new SystemError(
                    `coder binary not found on PATH ("${bin}"). The intent-manifest seam ` +
                      `invokes the external coder service out-of-process (ADR-085); install ` +
                      `coder or pass a different bin.`,
                    error,
                  ),
                );
                return;
              }
              reject(
                new BusinessError(
                  `coder generate failed: ${stderr.trim() || error.message}`,
                  'CODER_GENERATE_FAILED',
                  { bin, adaptor: request.adaptor ?? DEFAULT_ADAPTOR },
                ),
              );
              return;
            }
            resolve(stdout);
          },
        );
      });
    },
  };
}

/** SSE line-protocol prefix coder's `serve` emits per chunk. */
const SSE_DATA_PREFIX = 'data:';

/**
 * Reduce a coder `serve` response body to its text. Handles both a plain body
 * and Server-Sent-Events framing (concatenating `data:` chunk payloads, ignoring
 * the `[DONE]` sentinel).
 */
export function parseServeBody(body: string): string {
  if (!body.includes(SSE_DATA_PREFIX)) {
    return body;
  }
  const chunks: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(SSE_DATA_PREFIX)) continue;
    const payload = trimmed.slice(SSE_DATA_PREFIX.length).trim();
    if (payload === '[DONE]' || payload.length === 0) continue;
    chunks.push(payload);
  }
  return chunks.join('');
}

/** Serve transport: POST the prompt to a running `coder serve` endpoint. */
export function makeServeRunner(endpoint: string): CoderRunner {
  return {
    async generate(request: IntentCompileRequest): Promise<string> {
      const url = `${endpoint.replace(/\/$/, '')}/generate`;
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: request.intent,
            adaptor: request.adaptor ?? DEFAULT_ADAPTOR,
            ...(request.systemPromptPath ? { system: request.systemPromptPath } : {}),
            ...(request.model ? { model: request.model } : {}),
          }),
        });
      } catch (err) {
        throw new NetworkError(
          `coder serve unreachable at ${url}: ${(err as Error).message}`,
          503,
        );
      }
      if (!response.ok) {
        throw new NetworkError(
          `coder serve returned ${response.status} from ${url}`,
          response.status,
        );
      }
      return parseServeBody(await response.text());
    },
  };
}

/** Pick the real runner for a request's transport (subprocess by default). */
export function runnerForRequest(request: IntentCompileRequest): CoderRunner {
  const transport = request.transport ?? { kind: 'subprocess' };
  return transport.kind === 'serve'
    ? makeServeRunner(transport.endpoint)
    : makeSubprocessRunner(transport.bin);
}

/**
 * Compile an intent into a candidate manifest via coder, out-of-process.
 *
 * The {@link CoderRunner} is injectable: production callers omit it and get the
 * transport-appropriate real runner; tests pass a fake that returns canned YAML.
 */
export async function compileIntent(
  request: IntentCompileRequest,
  runner: CoderRunner = runnerForRequest(request),
): Promise<CandidateManifest> {
  const raw = await runner.generate(request);
  return {
    yaml: stripFences(raw),
    adaptor: request.adaptor ?? DEFAULT_ADAPTOR,
    ...(request.model ? { model: request.model } : {}),
  };
}
