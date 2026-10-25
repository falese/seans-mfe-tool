/**
 * The decomposition agent, wired (ADR-117, ADR-118 §2–§4).
 *
 * `askAgent` (`@seans-mfe/decompose`) runs the suggest-and-check flow with the
 * model injected; the coder seam (`@seans-mfe/plugin-coder`) supplies the model
 * through the `api` transport and the `decomposition-edit` prompt adaptor. Only
 * here are the two joined, and only here is the provider's key read — the
 * workspace is handed the result and never names a provider.
 */

import { askAgent, type AgentModel, type AskResult } from '@seans-mfe/decompose';
import { anthropicClient, decompositionEditModel, DEFAULT_API_MODEL } from '@seans-mfe/plugin-coder';

export interface ConnectedAgent {
  model: string;
  ask(request: string, who: string, at: string): Promise<AskResult>;
}

export type MakeModel = (opts: { apiKey: string; model: string }) => AgentModel;

const hostedModel: MakeModel = ({ apiKey, model }) =>
  decompositionEditModel({ client: anthropicClient({ ANTHROPIC_API_KEY: apiKey }), model });

/** The agent for a proposal, or why there is none. The key is read from the environment only (ADR-117 §1). */
export function agentFor(
  opts: { proposalDir: string; enabled: boolean; model?: string; env: NodeJS.ProcessEnv },
  makeModel: MakeModel = hostedModel
): { agent: ConnectedAgent } | { unavailable: string } {
  if (!opts.enabled) return { unavailable: 'The agent was turned off with --no-agent.' };
  const apiKey = opts.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { unavailable: 'No agent is connected: set ANTHROPIC_API_KEY before starting the workspace.' };
  const model = opts.model ?? DEFAULT_API_MODEL;
  const ask = makeModel({ apiKey, model });
  return { agent: { model, ask: (request, by, at) => askAgent(opts.proposalDir, { request, by, at }, ask) } };
}
