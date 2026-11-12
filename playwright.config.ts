import { defineConfig, devices } from "@playwright/test";

const previewUrl = "http://127.0.0.1:4180";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    baseURL: previewUrl,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4180 --strictPort",
    url: previewUrl,
    reuseExistingServer: false,
  },
});
