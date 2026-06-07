import React from "react";

export interface PulseRingProps {
  /** Glow the dot during countdown or streaming. */
  active: boolean;
  /** Animate the radiating rings during an active stream. */
  streaming: boolean;
}

const base: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: 10,
  height: 10,
  marginLeft: -5,
  marginTop: -5,
  borderRadius: "50%",
};

export const PulseRing: React.FC<PulseRingProps> = ({ active, streaming }) => {
  const dot: React.CSSProperties = {
    ...base,
    zIndex: 2,
    background: active ? "var(--accent)" : "var(--muted)",
    boxShadow: active ? "0 0 14px var(--accent)" : "none",
    transition: "background 0.3s ease, box-shadow 0.3s ease",
  };
  const ring = (delay: string): React.CSSProperties => ({
    ...base,
    zIndex: 1,
    border: "1px solid var(--accent)",
    animation: `pulseRing 1.5s ease-out ${delay} infinite`,
  });
  return (
    <>
      {streaming ? <span style={ring("0s")} /> : null}
      {streaming ? <span style={ring("0.5s")} /> : null}
      <span style={dot} />
    </>
  );
};

export default PulseRing;
