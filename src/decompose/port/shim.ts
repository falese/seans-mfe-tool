/**
 * The one helper decompose:port writes into a ported MFE (ADR-128):
 *
 *   src/monolith/__port__/via-bff.ts   viaBff(monolithCall, read)
 *
 * Each of the monolith's data functions is rewritten in place to call it. Run
 * alone, it runs the monolith's own code. Composed — when a host has attached
 * its control plane (ADR-057, `inControlPlane()`) — it runs the function's
 * GraphQL document through the base class's query capability, `mfe.query()`
 * (ADR-053), with its lifecycle gate, telemetry and BFF resolution.
 */

const MARK = 'Ported by decompose:port (ADR-128)';

export function viaBffModule(): string {
  return `/**
 * ${MARK}.
 *
 * \`viaBff(monolith, read)\` is how each of the monolith's data functions reads
 * once ported. Standalone it runs \`monolith()\` — the monolith's own code,
 * against the monolith's backends. Composed by a host it reads through this
 * MFE's BFF instead, with the base class's query capability: \`read.document\`
 * is that function's GraphQL document and \`read.field\` the root field whose
 * value it returns, already in the shape the BFF gives (camel-cased, envelopes
 * unwrapped). \`{ empty }\` is data this MFE's BFF does not front: composed, the
 * function returns it without a request.
 */
import { BusinessError } from '@seans-mfe-tool/runtime';
import { mfe } from '../../platform/base-mfe/bootstrap';

export type BffRead = { document: string; field: string; variables?: Record<string, unknown> } | { empty: unknown };

let reads = 0;

/**
 * The query capability is legal only once the MFE is ready (the platform
 * contract's lifecycle gate, ADR-042), and a component fetches from its first
 * effect, while the MFE is still rendering. So a read waits for ready.
 */
async function ready(): Promise<void> {
  for (let waited = 0; mfe.getState() !== 'ready'; waited += 10) {
    const state = mfe.getState();
    if (state === 'error' || state === 'destroyed' || waited >= 10_000) {
      throw new BusinessError(\`\${mfe.constructor.name} is \${state}, not ready: its BFF cannot be queried\`, 'MFE_NOT_READY');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export function viaBff<R>(monolith: () => R, read: BffRead, when = true): R {
  if (!when || !mfe.inControlPlane()) return monolith();
  if ('empty' in read) return Promise.resolve(JSON.parse(JSON.stringify(read.empty))) as R;
  reads += 1;
  const requestId = \`port-\${read.field}-\${reads}\`;
  return ready()
    .then(() => mfe.query({
      requestId,
      timestamp: new Date(),
      inputs: { document: read.document, variables: read.variables ?? {} },
    }))
    .then((result) => {
      if (result.errors && result.errors.length > 0) {
        throw new BusinessError(result.errors.map((e) => e.message).join('\\n'), 'BFF_GRAPHQL_ERROR');
      }
      return (result.data as Record<string, unknown> | null | undefined)?.[read.field];
    }) as R;
}
`;
}
