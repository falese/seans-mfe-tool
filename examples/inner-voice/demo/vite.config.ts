import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base is set at build time from VITE_BASE_PATH (GitHub Pages serves under a
// subpath, e.g. /seans-mfe-tool/inner-voice/). Defaults to "/" for local dev.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  build: { outDir: "dist" },
});
