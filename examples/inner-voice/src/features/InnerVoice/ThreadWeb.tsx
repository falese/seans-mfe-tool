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
            x={x}
            y={y}
            index={i}
            onClick={() => onThreadClick(thread)}
          />
        );
      })}
    </div>
  );
};

export default ThreadWeb;
