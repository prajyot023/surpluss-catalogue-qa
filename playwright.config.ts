import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests live in `e2e/`. The app must be running at
 * http://localhost:3001 — `webServer` below starts it for you, or set
 * PLAYWRIGHT_SKIP_WEBSERVER=1 and run `npm run dev` in another terminal.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
