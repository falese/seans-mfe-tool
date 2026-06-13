import React from "react";

export interface ThoughtPanelProps {
  value: string;
  onChange: (value: string) => void;
  onEscape: () => void;
  countdownActive: boolean;
  /** Restarts the countdown bar animation on each keystroke. */
  restartKey: number;
  pauseMs: number;
  /** Shown while the thought is below the firing threshold, e.g. "4 / 12". Null otherwise. */
  minHint: string | null;
}

/** Left panel: the borderless thought field plus the silence countdown bar. */
export const ThoughtPanel: React.FC<ThoughtPanelProps> = ({
  value,
  onChange,
  onEscape,
  countdownActive,
  restartKey,
  pauseMs,
  minHint,
}) => {
  const wrap: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  };
  const track: React.CSSProperties = {
    height: 2,
    background: "var(--border)",
    flex: "0 0 auto",
  };
  const fill: React.CSSProperties = {
    height: "100%",
    width: 0,
    background: "var(--accent)",
    animation: `countdownBar ${String(pauseMs)}ms linear forwards`,
  };
  const textarea: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 680,
    marginInline: "auto",
    resize: "none",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text)",
    caretColor: "var(--accent)",
    fontFamily: "'EB Garamond', serif",
    fontSize: 20,
    lineHeight: 1.7,
    letterSpacing: "0.01em",
    padding: "16px 8px",
  };
  const hint: React.CSSProperties = {
    flex: "0 0 auto",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: "var(--muted)",
    padding: "0 8px 6px",
    textAlign: "center",
  };
  return (
    <div style={wrap}>
      <div style={track}>
        {countdownActive ? <div key={restartKey} style={fill} /> : null}
      </div>
      <textarea
        style={textarea}
        value={value}
        placeholder="start thinking…"
        autoFocus
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onEscape();
          }
        }}
      />
      {minHint ? <div style={hint}>keep typing… {minHint}</div> : null}
    </div>
  );
};

export default ThoughtPanel;
