import React from "react";
import { createRoot } from "react-dom/client";
import { InnerVoice } from "../../src/features/InnerVoice/InnerVoice";

// Standalone demo harness. In demo mode (VITE_DEMO_MODE=true) the component
// streams from the Anthropic API; otherwise it targets a local `coder serve`.
const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <InnerVoice />
    </React.StrictMode>,
  );
}
