import React, { useCallback, useRef, useState } from "react";
import { ThoughtPanel } from "./ThoughtPanel";
import { ThreadWeb } from "./ThreadWeb";
import { ResponsePanel } from "./ResponsePanel";
import { usePauseTimer } from "../../hooks/usePauseTimer";
import { useCoderStream, type StreamMetrics } from "../../hooks/useCoderStream";
import { useThreads } from "../../hooks/useThreads";
import { resolveConfig, type InnerVoiceConfig } from "../../lib/config";
import { parseThreads, stripThreads } from "../../lib/parseThreads";

export interface InnerVoiceProps {
  /** Manifest config block (from describe()/doDescribe()). Falls back to defaults. */
  config?: Partial<Record<keyof InnerVoiceConfig, unknown>>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=JetBrains+Mono&display=swap');
.iv-root {
  --bg:#040404; --surface:#0d0d0d; --border:#141414;
  --text:#c8c8c8; --muted:#2a2a2a; --accent:#00ff9f;
  background:var(--bg); color:var(--text);
  height:100vh; display:flex; flex-direction:column; overflow:hidden;
}
.iv-root, .iv-root *, .iv-root *::before, .iv-root *::after { box-sizing:border-box; }
.iv-root ::placeholder { color:var(--muted); }
.iv-root ::-webkit-scrollbar { width:6px; height:6px; }
.iv-root ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
@keyframes countdownBar { from { width:0%; } to { width:100%; } }
@keyframes pulseRing { from { transform:scale(1); opacity:0.6; } to { transform:scale(2.5); opacity:0; } }
@keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
@keyframes blink { 50% { opacity:0; } }
@keyframes threadIn { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
`;

const headerStyle: React.CSSProperties = {
  flex: "0 0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 16px",
  borderBottom: "1px solid var(--border)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "var(--muted)",
};
const footerStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "8px 16px",
  borderTop: "1px solid var(--border)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  color: "var(--muted)",
  textAlign: "center",
};
const gridStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "1fr 340px 1fr",
  gap: 0,
};
const colStyle: React.CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  padding: "12px 16px",
  borderRight: "1px solid var(--border)",
  display: "flex",
};

export const InnerVoice: React.FC<InnerVoiceProps> = ({ config }) => {
  const cfg = resolveConfig(config);
  const [thought, setThought] = useState("");
  const [turns, setTurns] = useState<string[]>([]);
  // The thought last sent to the model — guards against re-sending identical text
  // (the whole evolving thought IS the prompt; we just never repeat it verbatim).
  const lastSent = useRef("");

  const threads = useThreads(cfg.maxThreads);

  const onComplete = useCallback(
    (final: string, thought_: string, _metrics: StreamMetrics) => {
      const display = stripThreads(final);
      if (display.length > 0) {
        setTurns((t) => [...t, display].slice(-cfg.maxHistoryTurns));
      }
      // Prefer threads from the final answer; fall back to the reasoning voice.
      const found = parseThreads(final);
      threads.setFromResponse(found.length > 0 ? found : parseThreads(thought_));
    },
    [cfg.maxHistoryTurns, threads],
  );

  const stream = useCoderStream({
    coderServeUrl: cfg.coderServeUrl,
    maxTokens: cfg.maxTokens,
    systemPrompt: cfg.systemPrompt,
    onComplete,
  });

  const pause = usePauseTimer({
    text: thought,
    pauseMs: cfg.pauseMs,
    minChars: cfg.minChars,
    enabled: !stream.isStreaming,
    onFire: () => {
      if (thought.trim().length >= cfg.minChars && thought !== lastSent.current) {
        lastSent.current = thought;
        stream.start(thought);
      }
    },
  });

  const followThread = useCallback((concept: string) => {
    setThought((t) => `${t.trimEnd()}${t.trim() ? " " : ""}[following thread: ${concept}]`);
  }, []);

  const handleEscape = useCallback(() => {
    setThought("");
    lastSent.current = "";
    stream.reset();
    threads.clearCurrent();
    // session thread history persists by design
  }, [stream, threads]);

  const glow = pause.active || stream.isStreaming;

  return (
    <div className="iv-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header style={headerStyle}>
        <span>inner-voice</span>
        <span>{stream.isStreaming ? "streaming…" : pause.active ? "listening…" : "idle"}</span>
      </header>

      <main style={gridStyle}>
        <section style={colStyle}>
          <ThoughtPanel
            value={thought}
            onChange={setThought}
            onEscape={handleEscape}
            countdownActive={pause.active}
            restartKey={pause.restartKey}
            pauseMs={cfg.pauseMs}
          />
        </section>

        <section style={{ ...colStyle, padding: 0 }}>
          <ThreadWeb
            threads={threads.current}
            active={glow}
            streaming={stream.isStreaming}
            onThreadClick={followThread}
          />
        </section>

        <section style={{ ...colStyle, borderRight: "none" }}>
          <ResponsePanel
            turns={turns}
            liveText={stream.isStreaming ? stream.display : null}
            thinking={stream.thinking}
            isStreaming={stream.isStreaming}
            error={stream.error}
            metrics={stream.metrics}
            history={threads.history}
            onThreadClick={followThread}
          />
        </section>
      </main>

      <footer style={footerStyle}>
        no send button — responds after {String(cfg.pauseMs)}ms of silence · esc to clear
      </footer>
    </div>
  );
};

export default InnerVoice;
