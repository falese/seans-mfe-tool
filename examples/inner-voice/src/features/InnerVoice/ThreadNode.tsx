import React from "react";

export interface ThreadNodeProps {
  label: string;
  x: number;
  y: number;
  index: number;
  onClick: () => void;
}

/**
 * A single radial concept node. The outer wrapper handles absolute positioning
 * (and centring on its point); the inner button runs the entrance animation, so
 * the scale/fade never fights the positioning transform.
 */
export const ThreadNode: React.FC<ThreadNodeProps> = ({ label, x, y, index, onClick }) => {
  const wrapper: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: `translate(calc(-50% + ${String(x)}px), calc(-50% + ${String(y)}px))`,
  };
  const button: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 10,
    lineHeight: 1.4,
    color: "var(--text)",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "3px 7px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    maxWidth: 130,
    overflow: "hidden",
    textOverflow: "ellipsis",
    animation: `threadIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${String(index * 0.08)}s both`,
  };
  return (
    <div style={wrapper}>
      <button type="button" style={button} onClick={onClick} title={label}>
        {label}
      </button>
    </div>
  );
};

export default ThreadNode;
