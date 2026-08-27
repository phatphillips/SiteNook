import { defineConfig, devices } from '@playwright/test'

/** E2E against an already-running stack (e.g. docker compose on port 80). */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/results/e2e-results.json' }]
  ],
  use: {
    baseURL: process.env.NUXT_URL || 'http://localhost',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
