import { defineConfig, devices } from "@playwright/test";

// Where the app is served. Overridable so a CI job can bring its own vite,
// or point the suite at a hub serving its own baked-in client.
const APP_URL = process.env.WAVVON_E2E_APP_URL ?? "http://localhost:1421";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Mock-API tests (no real hub needed). The capture dir is the
    // README-asset generator with its own config — never part of a suite.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/live/**", "**/capture/**"],
    },
    // Live tests against a real local hub (see e2e/live/README.md).
    {
      name: "live-setup",
      testMatch: "**/live/live.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "live",
      testMatch: "**/live/**/*.spec.ts",
      dependencies: ["live-setup"],
      fullyParallel: false,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/owner.json",
        permissions: ["microphone", "clipboard-read", "clipboard-write"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            // Let getDisplayMedia() resolve to a fake source without a picker.
            "--auto-select-desktop-capture-source=Entire screen",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
  },
});
