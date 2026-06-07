import React from "react";
import { PulseRing } from "./PulseRing";
import { ThreadNode } from "./ThreadNode";
import { threadPosition } from "../../lib/threadLayout";

export interface ThreadWebProps {
  threads: string[];
  active: boolean;
  streaming: boolean;
  onThreadClick: (thread: string) => void;
}

// threadPosition gives the radial *direction*; these spread the nodes out for
// legibility — mostly vertically, so same-side concepts land on distinct rows
// instead of stacking on top of each other in the narrow centre column.
const SPREAD_X = 1.1;
const SPREAD_Y = 3.6;

/** Center panel: a fixed pulse with concept nodes radiating around it. */
export const ThreadWeb: React.FC<ThreadWebProps> = ({ threads, active, streaming, onThreadClick }) => {
  const container: React.CSSProperties = {
    position: "relative",
    height: "100%",
    width: "100%",
    overflow: "visible",
  };
  return (
    <div style={container} aria-label="thread web">
      <PulseRing active={active} streaming={streaming} />
      {threads.map((thread, i) => {
        const { x, y } = threadPosition(i, threads.length);
        return (
          <ThreadNode
            key={`${thread}-${String(i)}`}
            label={thread}
            x={x * SPREAD_X}
            y={y * SPREAD_Y}
            index={i}
            onClick={() => onThreadClick(thread)}
          />
        );
      })}
    </div>
  );
};

export default ThreadWeb;
