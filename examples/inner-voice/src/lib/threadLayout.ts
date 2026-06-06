/**
 * Radial placement for thread nodes around the centre pulse.
 *
 * Nodes fan out across a 120° arc (-60°…+60° from straight up), with every
 * other node pushed out slightly further so they don't overlap. The vertical
 * axis is squashed (×0.5) to fit the centre panel's aspect.
 */
export interface ThreadPosition {
  x: number;
  y: number;
}

export function threadPosition(index: number, total: number): ThreadPosition {
  const angleDeg = (index / Math.max(total - 1, 1)) * 120 - 60;
  const angleRad = (angleDeg * Math.PI) / 180;
  const radius = 90 + (index % 2) * 20;
  return {
    x: Math.sin(angleRad) * radius,
    y: -Math.cos(angleRad) * radius * 0.5,
  };
}
