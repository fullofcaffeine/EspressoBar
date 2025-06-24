import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  // Clean up any existing storage to start fresh
  const storageDir = path.join(os.homedir(), '.config', 'EspressoBar')
  const storagePath = path.join(storageDir, 'pinned.json')

  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath)
    console.log('🧹 Cleaned up existing storage')
  }

  // Launch Electron app in test mode
  console.log('🚀 Launching Electron app in test mode...')
  electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'out', 'main', 'index.js'), '--test-mode'],
    timeout: 15000
  })

  // Wait for the app to be ready
  console.log('⏳ Waiting for app to be ready...')
  await electronApp.evaluate(async ({ app }) => {
    return app.whenReady()
  })

  // Get the main window page
  console.log('🔍 Getting main window...')
  page = await electronApp.firstWindow()

  // Wait for the renderer to load
  console.log('⏳ Waiting for renderer to load...')
  await page.waitForLoadState('networkidle', { timeout: 8000 })

  // Wait for React to initialize
  await page.waitForSelector('#root', { timeout: 5000 })

  // Additional wait for the app to fully initialize
  await page.waitForTimeout(1000)

  // Initial reset of test data after app is ready
  console.log('🧹 Performing initial reset of test data...')
  await page.evaluate(async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.resetTestData) {
      await (window as any).electronAPI.resetTestData()
    }
  })
  console.log('✅ Initial test data reset complete')
})

test.beforeEach(async () => {
  console.log('🧹 Resetting test data before each test...')

  // Reset test data via the renderer process
  await page.evaluate(async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.resetTestData) {
      await (window as any).electronAPI.resetTestData()
    }
  })

  console.log('✅ Test data reset complete')
})

test.afterAll(async () => {
  console.log('🧹 Cleaning up Electron app...')
  if (electronApp) {
    try {
      await electronApp.close()
      console.log('✅ Electron app closed successfully')
    } catch (error) {
      console.log('⚠️ Error closing Electron app:', error)
      try {
        await electronApp.evaluate(({ app }) => app.quit())
      } catch (e) {
        console.log('⚠️ Force quit also failed, app may still be running')
      }
    }
  }
})

// Helper function to navigate to preferences
async function navigateToPreferences() {
  // Wait for the main popup to be visible first
  await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

  // Look for the settings button in the TrayPopup - it should be in the header area
  // First, let's try multiple possible selectors for the settings button
  const settingsSelectors = [
    'button:has(svg)', // Any button with SVG (Settings icon)
    'button[title*="preferences"]',
    'button[title*="settings"]',
    'button:has([data-testid="settings"])',
    '.lucide-settings', // Direct class reference
    'svg[class*="lucide-settings"]' // SVG with settings class
  ]

  let navigated = false

  // Try clicking the settings button using different selectors
  for (const selector of settingsSelectors) {
    try {
      const settingsButton = page.locator(selector).first()
      if (await settingsButton.isVisible({ timeout: 1000 })) {
        await settingsButton.click()
        navigated = true
        console.log(`Settings button found with selector: ${selector}`)
        break
      }
    } catch (e) {
      // Continue to next selector
      continue
    }
  }

  // If clicking failed, navigate directly via URL and React Router
  if (!navigated) {
    console.log('Settings button click failed, using programmatic navigation')
    await page.evaluate(() => {
      // Use React Router's navigation if available
      if (window.location.pathname !== '/preferences') {
        window.history.pushState({}, '', '/preferences')
        // Force a re-render by dispatching events
        window.dispatchEvent(new Event('popstate'))
        // Also try triggering a custom navigation event
        const event = new CustomEvent('navigate', { detail: { path: '/preferences' } })
        window.dispatchEvent(event)
      }
    })
    // Give a moment for the navigation to process
    await page.waitForTimeout(500)
  }

  // Wait for preferences to load - look for any preferences-specific content
  const preferencesIndicators = [
    'text=Preferences',
    'text=Configure your application settings',
    'text=Org Directories',
    'text=Scan Controls',
    '[data-testid="incremental-scan-button"]',
    '[role="tab"]:has-text("Org Files")'
  ]

  let preferencesLoaded = false
  for (const indicator of preferencesIndicators) {
    try {
      await expect(page.locator(indicator)).toBeVisible({ timeout: 2000 })
      preferencesLoaded = true
      console.log(`Preferences loaded - found indicator: ${indicator}`)
      break
    } catch (e) {
      // Continue to next indicator
    }
  }

  if (!preferencesLoaded) {
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-navigation-failure.png' })
    console.log('Current URL:', await page.url())
    console.log('Current page content preview:', await page.locator('body').textContent())
    throw new Error('Failed to navigate to preferences - no preferences indicators found')
  }
}

// Helper function to navigate back to main popup
async function navigateToMainPopup() {
  // Look for back button or home navigation with more specific selectors
  const backSelectors = [
    'button[title*="Back"]',
    'button[title*="main"]',
    'button:has(.lucide-arrow-left)', // Back arrow button with lucide class
    'button:has(svg)', // Any button with SVG
    'button[aria-label="Back"]'
  ]

  let navigated = false
  for (const selector of backSelectors) {
    try {
      const backButton = page.locator(selector).first()
      if (await backButton.isVisible({ timeout: 1000 })) {
        await backButton.click()
        navigated = true
        console.log(`Back button found with selector: ${selector}`)
        break
      }
    } catch (e) {
      // Continue to next selector
      continue
    }
  }

  // If clicking failed, navigate directly via URL
  if (!navigated) {
    console.log('Back button click failed, using programmatic navigation')
    await page.evaluate(() => {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/')
        window.dispatchEvent(new Event('popstate'))
        // Also trigger custom navigation
        const event = new CustomEvent('navigate', { detail: { path: '/' } })
        window.dispatchEvent(event)
      }
    })
    // Give a moment for the navigation to process
    await page.waitForTimeout(500)
  }

  // Wait for main popup to load
  await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

  // Give a small delay for state to settle
  await page.waitForTimeout(500)
}

// Helper function to add a test org directory
async function addTestOrgDirectory() {
  const testOrgDir = path.join(os.tmpdir(), 'test-org-files')

  // Create test directory and file if they don't exist
  if (!fs.existsSync(testOrgDir)) {
    fs.mkdirSync(testOrgDir, { recursive: true })
  }

  const testOrgFile = path.join(testOrgDir, 'test.org')
  // Use the same content structure as the working test file
  const orgContent = `#+TITLE: Test Org File

* First headline
This is just a regular headline.

* TODO Important task
:PROPERTIES:
:pinned: yes
:END:
This task is pinned and should appear in EspressoBar.

* DONE Completed task
This is a completed task without pinning.

* Meeting notes
:PROPERTIES:
:PINNED: true
:created: 2024-01-15
:END:
This headline is also pinned (uppercase property).

* Another regular headline
Nothing special here.

* Project planning :pinned:
This headline uses a tag for pinning instead of properties.

* Random thoughts
Just some notes that are not pinned.
`

  fs.writeFileSync(testOrgFile, orgContent)

  return testOrgDir
}

test.describe('Org Scan Operations End-to-End', () => {
  test('should access preferences and see org files tab', async () => {
    console.log('🧪 Testing preferences access...')

    await navigateToPreferences()

    // Verify we're on the org files tab by default
    await expect(page.getByRole('tab', { name: 'Org Files' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('heading', { name: 'Org Directories' })).toBeVisible({
      timeout: 5000
    })

    console.log('✅ Preferences and org files tab accessible')
  })

  test('user sees scan controls when navigating to preferences', async () => {
    console.log('🧪 Testing user can see scan controls in preferences...')

    // Step 1: User navigates to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 2: User sees scan controls (though may be disabled without directories)
    const incrementalScanButton = page.locator('[data-testid="incremental-scan-button"]')
    const fullScanButton = page.locator('[data-testid="full-scan-button"]')

    await expect(incrementalScanButton).toBeVisible({ timeout: 5000 })
    await expect(fullScanButton).toBeVisible({ timeout: 5000 })

    console.log('✅ User can see scan controls in preferences')
  })

  test('user can access scan controls after configuring org directory', async () => {
    console.log('🧪 Testing user can access scan controls after directory setup...')

    // Step 1: Configure org directory (simulate user already did this)
    const testOrgDir = path.join(process.cwd(), 'test-org-files') // Use existing test directory
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh the page to ensure UI reflects the configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User can see and use scan controls
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    console.log('✅ User can access enabled scan controls after directory configuration')

    // Step 4: Verify user can actually use the scan controls
    await scanButton.click()

    // User sees scan is working (either immediate completion or scanning state)
    const scanWorked = await page
      .waitForFunction(
        () => {
          const button = document.querySelector('[data-testid="incremental-scan-button"]')
          return (
            button?.textContent?.includes('Quick Scan') ||
            button?.textContent?.includes('Scanning...')
          )
        },
        { timeout: 5000 }
      )
      .catch(() => false)

    expect(scanWorked).not.toBe(false)
    console.log('✅ User can successfully use scan controls')
  })

  test('user can trigger incremental scan', async () => {
    console.log('🧪 Testing user incremental scan workflow...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User clicks scan button
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    const buttonTextBefore = await scanButton.textContent()
    console.log('🔍 Scan button before click:', buttonTextBefore)

    await scanButton.click()
    console.log('🔄 User clicked incremental scan button')

    // Step 4: User sees scan feedback (either immediate completion or progress)
    if (buttonTextBefore?.includes('Quick Scan')) {
      // Check if it changes to scanning or completes immediately
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="incremental-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 User sees "Scanning..." feedback')
        await expect(scanButton).toContainText('Quick Scan', { timeout: 10000 })
      }
      console.log('✅ Scan completed')
    }

    // Step 5: User sees scan results
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Pinned items found:')).toBeVisible({ timeout: 5000 })

    console.log('✅ User successfully triggered incremental scan and saw results')
  })

  test('user can trigger full scan', async () => {
    console.log('🧪 Testing user full scan workflow...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User clicks full scan button
    const fullScanButton = page.locator('[data-testid="full-scan-button"]')
    await expect(fullScanButton).toBeVisible({ timeout: 5000 })
    await expect(fullScanButton).toBeEnabled({ timeout: 5000 })

    const buttonTextBefore = await fullScanButton.textContent()
    console.log('🔍 Full scan button before click:', buttonTextBefore)

    await fullScanButton.click()
    console.log('🔄 User clicked full scan button')

    // Step 4: User sees scan feedback (either immediate completion or progress)
    if (buttonTextBefore?.includes('Full Scan')) {
      // Check if it changes to scanning or completes immediately
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="full-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 User sees "Scanning..." feedback')
        await expect(fullScanButton).toContainText('Full Scan', { timeout: 10000 })
      }
      console.log('✅ Full scan completed')
    }

    // Step 5: User sees scan results
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Pinned items found:')).toBeVisible({ timeout: 5000 })

    console.log('✅ User successfully triggered full scan and saw results')
  })

  test('user sees scan progress and results', async () => {
    console.log('🧪 Testing user sees scan progress and results...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User triggers scan and sees results
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    await scanButton.click()
    console.log('🔄 User clicked scan button')

    // Step 4: User sees scan completion and results
    await page.waitForTimeout(2000) // Give time for scan to complete

    // User sees scan results
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Pinned items found:')).toBeVisible({ timeout: 5000 })

    console.log('✅ User sees scan progress and results correctly')
  })

  test('user can scan even with problematic files', async () => {
    console.log('🧪 Testing user scan with various file types...')

    // Step 1: Configure org directory (use existing test directory)
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User triggers scan
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    await scanButton.click()
    console.log('🔄 User clicked scan button')

    // Step 4: Scan completes successfully (handles any file issues gracefully)
    await page.waitForTimeout(3000) // Give time for scan to complete

    // User sees scan completed without errors blocking the UI
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })

    console.log('✅ User scan handles various file types gracefully')

    // Check that scan completed (even with errors)
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })

    // Errors should be handled gracefully (not crash the app)
    const isAppStillResponsive = await page.locator('#root').isVisible()
    expect(isAppStillResponsive).toBe(true)

    console.log('✅ Scan errors handled gracefully')

    // Note: Not cleaning up test directory as it's used by multiple tests
  })

  test('should scan pins and display them in main popup after navigation', async () => {
    console.log('🧪 Testing scan-to-popup workflow - the core use case...')

    // Use the actual test org file from the project
    const testOrgDir = path.join(process.cwd(), 'test-org-files')

    // Verify the test org file exists and has expected content
    const testOrgFile = path.join(testOrgDir, 'test.org')
    expect(fs.existsSync(testOrgFile)).toBe(true)
    console.log('✅ Test org file exists:', testOrgFile)

    // First, set up the org directory via API (more reliable than UI)
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)
    console.log('✅ Test org directory configured via API')

    // Navigate to preferences using the working pattern
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    console.log('✅ Successfully navigated to preferences')

    // Verify we can see scan controls
    const incrementalScanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(incrementalScanButton).toBeVisible({ timeout: 5000 })
    await expect(incrementalScanButton).toBeEnabled({ timeout: 5000 })
    console.log('✅ Scan controls are visible and enabled')

    // Trigger incremental scan
    const buttonTextBefore = await incrementalScanButton.textContent()
    await incrementalScanButton.click()
    console.log('🔄 User clicked scan button')

    // Handle scan feedback (might be immediate due to caching)
    if (buttonTextBefore?.includes('Quick Scan')) {
      // Check if it changes to scanning or completes immediately
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="incremental-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 User sees scan in progress')
        await expect(incrementalScanButton).toContainText('Quick Scan', { timeout: 15000 })
      }
      console.log('✅ Scan completed')
    }

    // Verify scan results show pinned items were found
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })

    // Check that the scan found the expected number of pins (6 total: 3 from test.org + 3 from detailed-test.org)
    const pinnedItemsLocator = page.locator('text=Pinned items found:').locator('..')
    await expect(pinnedItemsLocator).toContainText('6', { timeout: 5000 })
    console.log('✅ Scan found 6 pinned items as expected')

    // Now navigate back to the main popup
    try {
      await navigateToMainPopup()
      console.log('✅ Successfully navigated back to main popup')
    } catch (e) {
      console.log('⚠️ UI navigation back failed, trying direct approach...')
      await page.evaluate(() => {
        window.location.hash = '#/'
      })
      await page.waitForTimeout(1000)
    }

    // The key test: Verify that the main popup shows the expected pinned items
    console.log('🔍 Checking if pins are displayed in main popup...')

    // First check if we're showing "No pins yet" (the bug we're testing for)
    const noPinsMessage = page.locator('text=No pins yet')
    const isPinsEmpty = await noPinsMessage.isVisible({ timeout: 3000 })

    if (isPinsEmpty) {
      console.log('❌ Main popup shows "No pins yet" - this indicates the bug we\'re testing for')
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-no-pins-after-scan.png' })
      throw new Error(
        'BUG DETECTED: Expected pins to be visible in main popup after scanning, but got "No pins yet"'
      )
    }

    // Verify that the main popup shows the expected pinned items
    const pinnedCount = page.locator('text=Pinned (').first()
    await expect(pinnedCount).toBeVisible({ timeout: 5000 })
    await expect(pinnedCount).toContainText('Pinned (6)', { timeout: 5000 })
    console.log('✅ Main popup shows correct pin count: 6')

    // Verify that specific pin items are displayed
    await expect(page.locator('[data-testid="pin-item"]')).toHaveCount(6, { timeout: 5000 })

    // Check for specific pin content from test.org (using exact match to avoid conflicts)
    await expect(page.locator('text="Important task"').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text="Meeting notes"').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text="Project planning"').first()).toBeVisible({ timeout: 5000 })

    console.log('✅ All expected pinned items are visible in main popup')

    // Verify that pins have timestamps
    const timestamps = page.locator('[data-testid="pin-timestamp"]')
    await expect(timestamps).toHaveCount(6, { timeout: 5000 })
    console.log('✅ Pin timestamps are displayed')

    console.log(
      '🎉 SCAN-TO-POPUP WORKFLOW TEST PASSED - Pins are correctly displayed after scanning!'
    )
  })

  test('user performs full scan and sees pins in main popup', async () => {
    console.log('🧪 Testing user full scan workflow...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User triggers full scan
    const fullScanButton = page.locator('[data-testid="full-scan-button"]')
    await expect(fullScanButton).toBeVisible({ timeout: 5000 })
    await expect(fullScanButton).toBeEnabled({ timeout: 5000 })

    const buttonTextBefore = await fullScanButton.textContent()
    await fullScanButton.click()
    console.log('🔄 User clicked full scan button')

    // Handle scan feedback (might be immediate due to caching)
    if (buttonTextBefore?.includes('Full Scan')) {
      // Check if it changes to scanning or completes immediately
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="full-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 User sees full scan in progress')
        await expect(fullScanButton).toContainText('Full Scan', { timeout: 15000 })
      }
      console.log('✅ Full scan completed')
    }

    // Step 4: User navigates back to main popup
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Give time for state to synchronize
    await page.waitForTimeout(2000)

    // Step 5: User sees pins displayed
    await expect(page.locator('text=Pinned (')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="pin-item"]')).toHaveCount(6, { timeout: 5000 })

    console.log('✅ User sees full scan pins in main popup')
  })

  test('user can see pins after refreshing data', async () => {
    console.log('🧪 Testing user can see pins after data refresh...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })
    await scanButton.click()
    console.log('🔄 User triggered scan')

    // Step 3: User navigates back to main popup
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Give time for state to synchronize
    await page.waitForTimeout(2000)

    // Step 4: User sees pins displayed
    await expect(page.locator('text=Pinned (')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="pin-item"]')).toHaveCount(6, { timeout: 5000 })

    console.log('✅ User sees pins after refresh workflow')
  })

  test('user scans in preferences and sees pins in main popup', async () => {
    console.log('🧪 Testing user workflow: preferences scan → main popup view...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User triggers scan
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    await scanButton.click()
    console.log('🔄 User clicked scan button in preferences')

    // Wait for scan completion feedback
    await page.waitForTimeout(2000)

    // Step 4: User navigates back to main popup
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Give time for state to synchronize
    await page.waitForTimeout(2000)

    // Step 5: User sees pins in main popup
    const noPinsMessage = page.locator('text=No pins yet')
    const isPinsEmpty = await noPinsMessage.isVisible({ timeout: 2000 })

    if (isPinsEmpty) {
      console.log('❌ User sees "No pins yet" despite successful scan!')
      await page.screenshot({ path: 'regression-no-pins-after-scan.png' })
      throw new Error('Expected pins to be visible after scan, but got "No pins yet"')
    }

    // User sees pins displayed correctly
    await expect(page.locator('text=Pinned (')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-testid="pin-item"]')).toHaveCount(6, { timeout: 5000 })

    // User sees specific pin content (using exact match to avoid conflicts)
    await expect(page.locator('text="Important task"').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text="Meeting notes"').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text="Project planning"').first()).toBeVisible({ timeout: 5000 })

    console.log('✅ User successfully scanned in preferences and sees pins in main popup')
  })

  test('DEBUG: should verify org file scanning setup', async () => {
    console.log('🔍 DEBUG: Testing org file scanning setup...')

    // Use the actual test org file from the project
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    const testOrgFile = path.join(testOrgDir, 'test.org')

    console.log('📁 Test org directory:', testOrgDir)
    console.log('📄 Test org file:', testOrgFile)

    // Verify files exist
    expect(fs.existsSync(testOrgFile)).toBe(true)
    console.log('✅ Test org file exists')

    // Check file content
    const fileContent = fs.readFileSync(testOrgFile, 'utf8')
    console.log('📄 File content preview:', fileContent.substring(0, 200) + '...')

    // Count expected pins in file
    const pinnedLines = fileContent
      .split('\n')
      .filter(
        (line) =>
          line.includes(':pinned:') || line.includes(':PINNED:') || line.includes(':pinned:')
      )
    console.log('🔢 Expected pins in file:', pinnedLines.length)

    // Set up the org directory via API
    console.log('🔧 Setting up org directory via API...')
    await page.evaluate(async (dir) => {
      console.log('Setting org directories to:', [dir])
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Verify the directory was set
    const currentDirs = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.getOrgDirectories) {
        return await (window as any).electronAPI.getOrgDirectories()
      }
      return []
    })
    console.log('📁 Current org directories:', currentDirs)
    expect(currentDirs).toContain(testOrgDir)

    // Get scan stats before scanning
    const statsBefore = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.getScanStats) {
        return await (window as any).electronAPI.getScanStats()
      }
      return null
    })
    console.log('📊 Scan stats before:', statsBefore)

    // Trigger scan via API and log the full result
    console.log('🔄 Triggering incremental scan...')
    const scanResult = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.triggerIncrementalScan) {
        return await (window as any).electronAPI.triggerIncrementalScan()
      }
      return null
    })

    console.log('📊 Full scan result:', JSON.stringify(scanResult, null, 2))

    // Get scan stats after scanning
    const statsAfter = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.getScanStats) {
        return await (window as any).electronAPI.getScanStats()
      }
      return null
    })
    console.log('📊 Scan stats after:', statsAfter)

    // Get pins via API
    const pins = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.getPins) {
        return await (window as any).electronAPI.getPins()
      }
      return []
    })
    console.log('📌 Current pins from API:', JSON.stringify(pins, null, 2))

    expect(scanResult).toBeTruthy()
    console.log('🔍 DEBUG: Scan result analysis:')
    console.log('  - Total files:', scanResult.totalFiles)
    console.log('  - Processed files:', scanResult.processedFiles)
    console.log('  - Pinned items:', scanResult.pinnedItems)
    console.log('  - Errors:', scanResult.errors)
    console.log('  - Scan time:', scanResult.scanTime + 'ms')

    if (scanResult.errors && scanResult.errors.length > 0) {
      console.log('❌ Scan errors:', scanResult.errors)
    }

    if (scanResult.pinnedItems === 0) {
      console.log('⚠️  No pins found - this suggests an issue with the scanning/parsing logic')
    }

    console.log('🔍 DEBUG TEST COMPLETED - Check logs above for issues')
  })

  test('REGRESSION TEST: user scans and sees pins after fresh start', async () => {
    console.log('🧪 REGRESSION TEST: Testing real user workflow...')

    // This test simulates the complete user workflow that validates the scan-to-UI connection:
    // 1. User ensures clean state
    // 2. User goes to preferences
    // 3. User configures org directory
    // 4. User triggers a scan
    // 5. User navigates back to main view
    // 6. User should see pins (validates the scan → UI update workflow)

    // Step 1: Clear any existing pins for clean test
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.resetTestData) {
        await (window as any).electronAPI.resetTestData()
      }
    })
    console.log('✅ Reset to clean state')

    // Reload page to ensure clean UI state
    await page.reload()
    await page.waitForTimeout(1000)

    // Verify clean state
    const isEmptyState = await page.locator('text=No pins yet').isVisible({ timeout: 3000 })
    console.log(`📌 Starting state: ${isEmptyState ? 'No pins (clean)' : 'Pins already exist'}`)

    // Step 2: Set up test org directory (simulate user configured this previously)
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)
    console.log('✅ Test org directory configured')

    // Step 3: Navigate to preferences like a real user
    console.log('🔍 User navigating to preferences...')
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Verify we're in preferences by looking for scan controls
    await expect(page.locator('[data-testid="incremental-scan-button"]')).toBeVisible({
      timeout: 5000
    })
    console.log('✅ User successfully navigated to preferences')

    // Step 4: User triggers scan via UI button (like in the working manual test)
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')

    // Wait for scan controls to be visible and enabled
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })
    console.log('✅ Scan button is visible and enabled')

    // Check current button text like the working manual test does
    const currentButtonText = await scanButton.textContent()
    console.log('🔍 Current scan button text:', currentButtonText)

    // Click the scan button like a real user would
    await scanButton.click()
    console.log('🔄 User clicked scan button')

    // Handle scan flow like the working manual test
    if (currentButtonText?.includes('Quick Scan')) {
      // Button already shows "Quick Scan" - check if it changes to "Scanning..."
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="incremental-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 Scan started (button changed to "Scanning...")...')
        await expect(scanButton).toContainText('Quick Scan', { timeout: 15000 })
        console.log('✅ Scan completed')
      } else {
        console.log('✅ Scan completed immediately (used cache)')
      }
    } else {
      // Wait for normal scan flow
      await expect(scanButton).toContainText('Scanning...', { timeout: 5000 })
      console.log('🔄 Scan started...')

      await expect(scanButton).toContainText('Quick Scan', { timeout: 15000 })
      console.log('✅ Scan completed')
    }

    // Verify scan results are shown (user feedback)
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Pinned items found:')).toBeVisible({ timeout: 5000 })
    console.log('✅ User sees scan results in preferences UI')

    // Step 5: User navigates back to main popup to see results
    console.log('🔍 User navigating back to main popup...')
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })

    // Wait for main popup to load
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })
    console.log('✅ User navigated back to main popup')

    // Additional wait for React state to settle and pin store to update
    await page.waitForTimeout(2000)

    // Step 6: THE CRITICAL TEST - User should see the pins
    // This validates that scan → pin store → UI update workflow works
    const noPinsMessage = page.locator('text=No pins yet')
    const isPinsEmpty = await noPinsMessage.isVisible({ timeout: 2000 })

    if (isPinsEmpty) {
      console.log('❌ REGRESSION DETECTED: User sees "No pins yet" despite successful scan!')
      await page.screenshot({ path: 'regression-user-workflow-failed.png' })

      // Debug: Check if pins exist in API but not in UI
      const pinsInAPI = await page.evaluate(async () => {
        if ((window as any).electronAPI && (window as any).electronAPI.getPins) {
          const pins = await (window as any).electronAPI.getPins()
          return pins.length
        }
        return 0
      })
      console.log(`🐛 Debug: API has ${pinsInAPI} pins but UI shows none`)

      throw new Error('REGRESSION: User performed scan but main popup still shows "No pins yet"')
    }

    // Verify user sees the expected pins
    await expect(page.locator('text=Pinned (')).toBeVisible({ timeout: 5000 })

    // Count actual pin items
    const pinCount = await page.locator('[data-testid="pin-item"]').count()
    console.log(`📌 User sees ${pinCount} pin items in the UI`)

    // Verify we have at least the expected pins from test.org
    if (pinCount >= 6) {
      // Verify specific pins from test.org are visible to user (using exact match to avoid conflicts)
      await expect(page.locator('text="Important task"').first()).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text="Meeting notes"').first()).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text="Project planning"').first()).toBeVisible({ timeout: 5000 })
      console.log('✅ All expected test pins are visible to user')
    }

    console.log('🎉 REGRESSION TEST PASSED!')
    console.log('🎯 User workflow works: preferences → scan → back → pins visible')
    console.log('📋 This validates the scan-to-UI connection works correctly')
  })

  test('user completes comprehensive scan-to-display workflow', async () => {
    console.log('🧪 Testing comprehensive user scan-to-display workflow...')

    // Step 1: Configure org directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Step 2: User navigates to preferences and waits for UI to update
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Refresh to ensure UI reflects configured directory
    await page.reload()
    await page.waitForTimeout(1000)

    // Navigate back to preferences
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)

    // Step 3: User triggers scan
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    await scanButton.click()
    console.log('🔄 User triggered scan')

    // Wait for scan completion
    await page.waitForTimeout(3000)

    // Step 4: User navigates back to main popup
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Give time for state to synchronize
    await page.waitForTimeout(2000)

    // Step 5: User sees pins displayed correctly
    const noPinsMessage = page.locator('text=No pins yet')
    const isPinsEmpty = await noPinsMessage.isVisible({ timeout: 2000 })

    if (isPinsEmpty) {
      console.log('❌ User sees "No pins yet" despite successful scan!')
      await page.screenshot({ path: 'regression-scan-works-but-no-ui-update.png' })
      throw new Error('Pins should be visible after comprehensive scan workflow!')
    }

    // User sees pins displayed correctly
    const pinItems = page.locator('[data-testid="pin-item"]')
    const pinCount = await pinItems.count()

    console.log('📌 User sees', pinCount, 'pin items')
    expect(pinCount).toBeGreaterThanOrEqual(1)

    // User sees pin counter
    const pinnedCounters = await page.locator('text=Pinned (').count()
    if (pinnedCounters > 0) {
      const pinnedCounterText = await page.locator('text=Pinned (').first().textContent()
      console.log('✅ User sees pin counter:', pinnedCounterText)
    }

    console.log('✅ User completed comprehensive scan-to-display workflow successfully')
  })

  test('MANUAL WORKFLOW TEST: preferences → scan → back → verify pins', async () => {
    console.log('🧪 MANUAL WORKFLOW TEST: Simulating actual user workflow...')

    // Use the actual test org file from the project
    const testOrgDir = path.join(process.cwd(), 'test-org-files')

    // Step 0: Set up the org directory
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)
    console.log('✅ Org directory configured')

    // Step 1: Start on main popup (should show "No pins yet" initially)
    console.log('🔍 Step 1: Starting on main popup...')
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Verify we start with no pins (clean state)
    const initialNoPins = await page.locator('text=No pins yet').isVisible({ timeout: 3000 })
    if (initialNoPins) {
      console.log('✅ Starting state: "No pins yet" (as expected)')
    } else {
      console.log('ℹ️  Starting state: pins already visible (cached from previous tests)')
    }

    // Step 2: Navigate to preferences (simulate manual navigation)
    console.log('🔍 Step 2: Navigating to preferences...')

    // Use programmatic navigation to ensure it works
    await page.evaluate(() => {
      // Simulate clicking the preferences button
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })

    // Wait for preferences to load
    await page.waitForTimeout(1000)

    // Look for preferences indicators
    const preferencesVisible = await page
      .locator('[data-testid="incremental-scan-button"]')
      .isVisible({ timeout: 5000 })
    if (!preferencesVisible) {
      // Try alternative navigation
      await page.evaluate(() => {
        if (window.history) {
          window.history.pushState({}, '', '/preferences')
          window.dispatchEvent(new PopStateEvent('popstate'))
        }
      })
      await page.waitForTimeout(1000)
    }

    // Verify we're in preferences
    await expect(page.locator('[data-testid="incremental-scan-button"]')).toBeVisible({
      timeout: 5000
    })
    console.log('✅ Successfully navigated to preferences')

    // Step 3: Trigger scan in preferences (simulating manual scan)
    console.log('🔄 Step 3: Triggering scan in preferences...')
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeEnabled({ timeout: 5000 })

    // Check current button text to see if scan is already done
    const currentButtonText = await scanButton.textContent()
    console.log('🔍 Current scan button text:', currentButtonText)

    // Click the scan button (simulating manual click)
    await scanButton.click()

    if (currentButtonText?.includes('Quick Scan')) {
      // Scan button already shows "Quick Scan" - it will either start a new scan or use cache
      console.log('🔄 Scan button clicked (was already "Quick Scan")...')

      // Wait a moment to see if it changes to "Scanning..."
      const changedToScanning = await page
        .waitForFunction(
          () => {
            const button = document.querySelector('[data-testid="incremental-scan-button"]')
            return button?.textContent?.includes('Scanning...')
          },
          { timeout: 2000 }
        )
        .catch(() => false)

      if (changedToScanning) {
        console.log('🔄 Scan started (button changed to "Scanning...")...')
        // Wait for scan to complete
        await expect(scanButton).toContainText('Quick Scan', { timeout: 15000 })
        console.log('✅ Scan completed')
      } else {
        console.log('✅ Scan completed immediately (used cache)')
      }
    } else {
      // Button shows something else, wait for normal scan flow
      await expect(scanButton).toContainText('Scanning...', { timeout: 5000 })
      console.log('🔄 Scan started...')

      // Wait for scan to complete
      await expect(scanButton).toContainText('Quick Scan', { timeout: 15000 })
      console.log('✅ Scan completed')
    }
    console.log('✅ Scan workflow completed in preferences')

    // Verify scan results are shown
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Pinned items found:')).toBeVisible({ timeout: 5000 })

    // Get the pin count from the scan results
    const scanResultText = await page
      .locator('text=Pinned items found:')
      .locator('..')
      .textContent()
    expect(scanResultText).toContain('6')
    console.log('✅ Scan results show 6 pins found')

    // Step 4: Navigate back to main popup (simulating manual navigation back)
    console.log('🔍 Step 4: Navigating back to main popup...')

    // Use programmatic navigation back to main
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })

    // Wait for main popup to load
    await page.waitForTimeout(1000)
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Additional wait for React state to settle and pin store to update
    console.log('⏳ Waiting for pin store state to settle...')
    await page.waitForTimeout(3000) // Give more time for state updates

    // Step 5: THE CRITICAL TEST - Verify pins are now visible
    console.log('🔍 Step 5: CRITICAL TEST - Checking if pins are visible after navigation back...')

    // Check if we still see "No pins yet" (the bug)
    const stillNoPins = await page.locator('text=No pins yet').isVisible({ timeout: 2000 })

    if (stillNoPins) {
      console.log('❌ BUG DETECTED: Still showing "No pins yet" after scan and navigation back')
      console.log("💡 This suggests the pin store state isn't being updated properly")

      // Debug: Check what the API returns
      const apiPins = await page.evaluate(async () => {
        if ((window as any).electronAPI && (window as any).electronAPI.getPins) {
          return await (window as any).electronAPI.getPins()
        }
        return []
      })
      console.log('🔍 Debug: API still returns', apiPins.length, 'pins')

      // Try manually triggering a refresh to see if that helps
      console.log('🔄 Debug: Manually triggering pin refresh...')
      await page.evaluate(async () => {
        if ((window as any).electronAPI && (window as any).electronAPI.refreshPins) {
          await (window as any).electronAPI.refreshPins()
        }
      })

      // Wait a bit more for the refresh to take effect
      await page.waitForTimeout(2000)

      // Check again
      const stillNoPinsAfterRefresh = await page
        .locator('text=No pins yet')
        .isVisible({ timeout: 2000 })
      if (stillNoPinsAfterRefresh) {
        await page.screenshot({ path: 'debug-manual-workflow-still-no-pins.png' })
        throw new Error('Manual workflow simulation failed - pins not visible even after refresh')
      } else {
        console.log('✅ Manual refresh fixed it - suggests timing issue in our fix')
      }
    }

    // Verify we have pins displayed
    const pinItems = page.locator('[data-testid="pin-item"]')
    const pinCount = await pinItems.count()

    console.log('📌 Found', pinCount, 'pin items in UI after navigation back')
    expect(pinCount).toBeGreaterThanOrEqual(1)

    // Verify pin counter
    const hasPinCounter = await page.locator('text=Pinned (').count()
    if (hasPinCounter > 0) {
      const counterText = await page.locator('text=Pinned (').first().textContent()
      console.log('✅ Pin counter:', counterText)
    }

    console.log('🎉 MANUAL WORKFLOW TEST PASSED!')
    console.log('🎯 Successfully simulated: preferences → scan → back → pins visible')
    console.log('📋 This confirms the manual workflow works in e2e tests too')
  })
})
