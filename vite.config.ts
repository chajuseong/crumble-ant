import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: { host: true },
  build: { chunkSizeWarningLimit: 2000 },
  test: { include: ["src/tests/**/*.test.ts"], environment: "node" },
});
