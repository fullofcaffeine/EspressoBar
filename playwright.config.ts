import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15000, // Reduced from 30 seconds to 15 seconds
  fullyParallel: false, // Electron tests should run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // Reduced retries
  workers: 1, // Only one worker for Electron tests
  reporter: [['html', { open: 'never' }], ['list']], // HTML report without auto-serving + list output
  use: {
    // Global test timeout - reduced for faster feedback
    actionTimeout: 5000, // Reduced from 10 seconds to 5 seconds
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    // Capture video on failure
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'electron',
      use: {
        // We'll launch Electron directly in our tests
      }
    }
  ]
})
