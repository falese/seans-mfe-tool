/**
 * Inner-voice runtime configuration.
 *
 * Every field has a hardcoded fallback so the MFE runs standalone with no
 * manifest. At runtime the platform exposes the manifest `config:` block via
 * describe()/doDescribe(); `resolveConfig` merges any partial source over the
 * defaults, ignoring values of the wrong type.
 */
import { SYSTEM_PROMPT } from "./systemPrompt";

export interface InnerVoiceConfig {
  coderServeUrl: string;
  pauseMs: number;
  minChars: number;
  maxHistoryTurns: number;
  maxThreads: number;
  /** Token budget per generation. Reasoning models need headroom for thought + answer. */
  maxTokens: number;
  /** The persona/instructions sent with every request. Override to retune behavior. */
  systemPrompt: string;
}

export const DEFAULT_CONFIG: InnerVoiceConfig = {
  coderServeUrl: "http://localhost:3991",
  pauseMs: 2200,
  minChars: 12,
  maxHistoryTurns: 6,
  maxThreads: 12,
  maxTokens: 1024,
  systemPrompt: SYSTEM_PROMPT,
};

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/**
 * Merge a partial config (from the manifest, props, or env) over the defaults.
 * Never throws; unknown or mistyped fields fall back to the default.
 */
export function resolveConfig(source?: Partial<Record<keyof InnerVoiceConfig, unknown>> | null): InnerVoiceConfig {
  const s = source ?? {};
  return {
    coderServeUrl: str(s.coderServeUrl, DEFAULT_CONFIG.coderServeUrl),
    pauseMs: num(s.pauseMs, DEFAULT_CONFIG.pauseMs),
    minChars: num(s.minChars, DEFAULT_CONFIG.minChars),
    maxHistoryTurns: num(s.maxHistoryTurns, DEFAULT_CONFIG.maxHistoryTurns),
    maxThreads: num(s.maxThreads, DEFAULT_CONFIG.maxThreads),
    maxTokens: num(s.maxTokens, DEFAULT_CONFIG.maxTokens),
    systemPrompt: str(s.systemPrompt, DEFAULT_CONFIG.systemPrompt),
  };
}
