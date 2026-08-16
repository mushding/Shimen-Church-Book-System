import { defineConfig } from "@playwright/test";
// e2e: boots api (DEV_LOGIN=1, in-memory pglite) + vite, runs one happy path. `pnpm e2e`.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:5173", locale: "zh-TW", timezoneId: "Asia/Taipei" },
  webServer: [
    { command: "DEV_LOGIN=1 PGLITE_DIR=memory:// PORT=3000 pnpm --filter api exec tsx src/index.ts", url: "http://localhost:3000/api/rooms", reuseExistingServer: false, timeout: 60_000 },
    { command: "pnpm --filter web exec vite --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: false, timeout: 60_000 },
  ],
});
