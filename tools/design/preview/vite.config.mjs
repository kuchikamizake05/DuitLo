import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Standalone local preview when the Windows SWC binary is unavailable.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../../public", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../../../src", import.meta.url)) } },
  build: { outDir: fileURLToPath(new URL("../../../.local/design-preview-build", import.meta.url)), emptyOutDir: false },
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 3200, strictPort: true },
});
