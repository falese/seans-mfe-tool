/**
 * Safe accessors for Vite build-time env. These read `import.meta.env`, which
 * only exists under a Vite build; everything is guarded so the module also
 * imports cleanly under a plain test runner.
 */
function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

export function isDemoMode(): boolean {
  return readEnv("VITE_DEMO_MODE") === "true";
}

export function anthropicApiKey(): string {
  return readEnv("VITE_ANTHROPIC_API_KEY") ?? "";
}

export function anthropicModel(): string | undefined {
  return readEnv("VITE_ANTHROPIC_MODEL");
}

export function basePath(): string {
  return readEnv("VITE_BASE_PATH") ?? "/";
}
