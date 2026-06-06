import React from "react";
import type { StreamMetrics } from "../../hooks/useCoderStream";

export interface ResponsePanelProps {
  /** Completed responses, oldest first. */
  turns: string[];
  /** Live streaming text, or null when idle. */
  liveText: string | null;
  isStreaming: boolean;
  error: string | null;
  metrics: StreamMetrics | null;
  /** Accumulated unique session threads. */
  history: string[];
  onThreadClick: (thread: string) => void;
}

/** Right panel: streaming response, faded prior turns, and session thread history. */
export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  turns,
  liveText,
  isStreaming,
  error,
  metrics,
  history,
  onThreadClick,
}) => {
  const priors = isStreaming ? turns : turns.slice(0, -1);
  const active = isStreaming ? liveText ?? "" : turns.length > 0 ? turns[turns.length - 1] : null;

  const wrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  };
  const scroll: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    fontFamily: "'EB Garamond', serif",
    fontSize: 17,
    lineHeight: 1.8,
    color: "var(--text)",
    padding: "8px 4px",
  };
  const meta: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: "var(--muted)",
    marginTop: 6,
  };
  const historyBox: React.CSSProperties = {
    flex: "0 0 auto",
    borderTop: "1px solid var(--border)",
    paddingTop: 8,
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    maxHeight: 120,
    overflowY: "auto",
  };
  const chip: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    color: "var(--text)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "2px 6px",
    cursor: "pointer",
  };

  return (
    <div style={wrap}>
      <div style={scroll}>
        {priors.map((text, i) => (
          <p
            key={`prior-${String(i)}`}
            style={{ opacity: 0.15 + (i / Math.max(priors.length, 1)) * 0.2, margin: "0 0 14px" }}
          >
            {text}
          </p>
        ))}

        {error ? (
          <p style={{ ...meta, color: "var(--accent)" }}>⚠ {error}</p>
        ) : null}

        {active !== null ? (
          <p key={`active-${String(turns.length)}`} style={{ margin: "0 0 8px", animation: "fadeUp 0.3s ease" }}>
            {active}
            {isStreaming ? (
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  marginLeft: 1,
                  color: "var(--accent)",
                  animation: "blink 0.6s step-end infinite",
                }}
              >
                ▋
              </span>
            ) : null}
          </p>
        ) : null}

        {metrics && !isStreaming ? (
          <div style={meta}>
            ttft {String(Math.round(metrics.ttft))}ms · {metrics.tokensPerSec.toFixed(1)} tok/s
          </div>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div style={historyBox} aria-label="thread history">
          {history.map((thread, i) => (
            <button
              type="button"
              key={`hist-${thread}-${String(i)}`}
              style={chip}
              onClick={() => onThreadClick(thread)}
              title={thread}
            >
              {thread}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default ResponsePanel;
