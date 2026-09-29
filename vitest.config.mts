import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // Playwright owns e2e/; keep Vitest out of it.
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./vitest.setup.ts"],
    // Green on an empty suite, so a fresh checkout does not look broken.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
