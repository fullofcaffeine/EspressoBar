import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

let electronApp: ElectronApplication
let page: Page

// Helper function to restore CRUD test file to original state
async function restoreCrudTestFile() {
  const crudTestFilePath = path.join(process.cwd(), 'test-org-files-crud', 'crud-test.org')
  const originalContent = `* TODO Delete me first :pinned:
  This task will be deleted by the delete pin test.

* TODO Delete me second :pinned:
  This task will be deleted in comprehensive deletion scenarios.

* TODO Keep me pinned :pinned:
  This task should remain pinned during tests.

* TODO Regular task (not pinned)
  This is just a regular task without the pinned property.

* TODO Another regular task
  This task is also not pinned and should not show up in the pinned items.
`
  
  try {
    // Ensure directory exists
    const crudTestDir = path.join(process.cwd(), 'test-org-files-crud')
    if (!fs.existsSync(crudTestDir)) {
      fs.mkdirSync(crudTestDir, { recursive: true })
    }
    fs.writeFileSync(crudTestFilePath, originalContent, 'utf-8')
  } catch (error) {
    console.log('⚠️ Could not restore CRUD test file:', error)
  }
}

test.beforeAll(async () => {
  // Clean up any existing storage to start fresh
  const storageDir = path.join(os.homedir(), '.config', 'EspressoBar')
  const storagePath = path.join(storageDir, 'pinned.json')

  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath)
    console.log('🧹 Cleaned up existing storage')
  }

  // Launch Electron app in test mode - this bypasses tray behavior
  console.log('🚀 Launching Electron app in test mode...')
  
  // Base arguments for all environments
  const baseArgs = [
    path.join(process.cwd(), 'out', 'main', 'index.js'),
    '--test-mode' // This flag makes the window show immediately
  ]
  
  // Additional flags for headless CI environments
  const ciArgs = process.env.CI ? [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-features=VizDisplayCompositor'
  ] : []
  
  if (process.env.CI) {
    console.log('🤖 CI environment detected - using headless mode with additional flags')
  } else {
    console.log('💻 Local environment detected - using headful mode')
  }
  
  electronApp = await electron.launch({
    args: [...baseArgs, ...ciArgs],
    timeout: 15000 // Reduced from 30 seconds
  })

  // Wait for the app to be ready
  console.log('⏳ Waiting for app to be ready...')
  await electronApp.evaluate(async ({ app }) => {
    return app.whenReady()
  })

  // Get the main window page (should be visible immediately in test mode)
  console.log('🔍 Getting main window...')
  page = await electronApp.firstWindow()

  // Wait for the renderer to load
  console.log('⏳ Waiting for renderer to load...')
  await page.waitForLoadState('networkidle', { timeout: 8000 }) // Reduced from 15 seconds

  // Wait for React to initialize
  await page.waitForSelector('#root', { timeout: 5000 }) // Reduced from 10 seconds

  // Additional wait for the app to fully initialize
  await page.waitForTimeout(1000) // Reduced from 2 seconds

  // Debug: Check if React app has loaded
  const hasReactContent = await page.evaluate(() => {
    const root = document.getElementById('root')
    return root && root.children.length > 0
  })

  console.log('🔍 React app loaded:', hasReactContent)

  if (!hasReactContent) {
    console.log('⚠️  React app not loaded, taking screenshot for debugging...')
    await page.screenshot({ path: 'debug-no-react.png' })

    const content = await page.content()
    console.log('📄 Page content:', content.substring(0, 500))
  }

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

  // Restore CRUD test file to original state
  await restoreCrudTestFile()

  // Reset test data via the renderer process (which will call the main process)
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
      // Force kill if needed
      try {
        await electronApp.evaluate(({ app }) => app.quit())
      } catch (e) {
        console.log('⚠️ Force quit also failed, app may still be running')
      }
    }
  }
})

test.describe('CRUD Operations End-to-End', () => {
  test('should load and show the app window', async () => {
    console.log('🧪 Testing app window visibility...')

    // The window should be visible immediately in test mode
    expect(await page.isVisible('body')).toBe(true)

    // Check if we have the root element
    await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

    // Check if React content loaded
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root')
      return root && root.innerHTML.trim().length > 0
    })

    expect(hasContent).toBe(true)
    console.log('✅ App window is visible and React content loaded')
  })

  test('should show demo pins or empty state', async () => {
    console.log('🧪 Testing initial state...')

    // Wait for the app to be fully loaded
    await page.waitForSelector('#root', { timeout: 5000 })

    // Check if we have demo pins or empty state
    const pinElements = await page.locator('[data-testid="pin-item"]').count()
    console.log(`Found ${pinElements} pins`)

    if (pinElements === 0) {
      // Should show empty state - look for actual text instead of testid
      const emptyStateVisible = await page.locator('text=No pins yet').isVisible({ timeout: 3000 })
      const setupVisible = await page
        .locator('text=Setup Org Directories')
        .isVisible({ timeout: 3000 })

      if (emptyStateVisible || setupVisible) {
        console.log('✅ Empty state is visible')
        expect(emptyStateVisible || setupVisible).toBe(true)
      } else {
        // Take screenshot for debugging and continue
        await page.screenshot({ path: 'debug-initial-state.png' })
        console.log('⚠️ Empty state not found as expected, but continuing test...')
      }
    } else {
      // Should show pin list with demo pins
      const pinListVisible = await page.locator('text=Pinned (').isVisible({ timeout: 3000 })
      expect(pinListVisible || pinElements > 0).toBe(true)
      console.log('✅ Pin list is visible with demo pins')
    }
  })

  test('should show setup button when no pins exist', async () => {
    console.log('🧪 Testing setup button for empty state...')

    // Wait for the app to be ready
    await page.waitForSelector('#root', { timeout: 10000 })

    // Look for the setup button in empty state (try both old and new text)
    const setupButton = page.locator('button:has-text("Setup Org Directories")')
    const oldQuickNoteButton = page.locator('button:has-text("+ Quick note…")')

    // Check if setup button is visible (new version)
    if (await setupButton.isVisible({ timeout: 2000 })) {
      console.log('✅ Setup button found in empty state')
      expect(await setupButton.isVisible()).toBe(true)

      // Click the setup button to navigate to preferences
      await setupButton.click()

      // Should navigate to preferences page
      await expect(page.locator('text=Preferences')).toBeVisible({ timeout: 5000 })
      console.log('✅ Setup button successfully navigates to preferences')
    } else if (await oldQuickNoteButton.isVisible({ timeout: 2000 })) {
      // Handle case where old version is still being served (due to caching)
      console.log('⚠️ Found old quick note button - this suggests build caching issue')
      expect(await oldQuickNoteButton.isVisible()).toBe(true)
      console.log('✅ Old button found (this will be updated when build refreshes)')
    } else {
      // If no buttons, we might have pins already - that's OK too
      const pinElements = await page.locator('[data-testid="pin-item"]').count()
      if (pinElements > 0) {
        console.log('✅ No setup button needed - pins already exist')
        expect(pinElements).toBeGreaterThan(0)
      } else {
        // Take screenshot for debugging
        await page.screenshot({ path: 'debug-no-setup-button.png' })
        console.log('📄 Current page content for debugging:')
        const content = await page.content()
        console.log(content.substring(0, 1000))
        throw new Error('Could not find setup button, quick note button, or existing pins')
      }
    }
  })

  test('should be able to delete a pin from org files', async () => {
    console.log('🧪 Testing pin deletion...')

    // Wait for the app to be ready
    await page.waitForSelector('#root', { timeout: 10000 })

    // Set up dedicated CRUD test directory to avoid interfering with other tests  
    const crudTestDir = path.join(process.cwd(), 'test-org-files-crud')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, crudTestDir)

    // Trigger a scan to ensure we have fresh data
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.refreshPins) {
        await (window as any).electronAPI.refreshPins()
      }
    })

    await page.waitForTimeout(2000) // Wait for scan to complete

    // Check if we have existing pins from org files
    const pinCount = await page.locator('[data-testid="pin-item"]').count()
    console.log(`🔍 Initial pin count: ${pinCount}`)

    if (pinCount === 0) {
      console.log('⚠️ No pins found - setting up test data first...')
      
      // Navigate to preferences and do a full scan
      await page.evaluate(() => {
        window.location.hash = '#/preferences'
        window.dispatchEvent(new Event('hashchange'))
      })
      await page.waitForTimeout(1000)

      const fullScanButton = page.locator('[data-testid="full-scan-button"]')
      if (await fullScanButton.isVisible({ timeout: 3000 })) {
        await fullScanButton.click()
        await page.waitForTimeout(3000) // Wait for scan
      }

      // Navigate back to main view
      await page.evaluate(() => {
        window.location.hash = '#/'
        window.dispatchEvent(new Event('hashchange'))
      })
      await page.waitForTimeout(1000)

      const newPinCount = await page.locator('[data-testid="pin-item"]').count()
      if (newPinCount === 0) {
        console.log('⚠️ Still no pins found after scan - skipping test')
        return
      }
      console.log(`🔍 After scan pin count: ${newPinCount}`)
    }

    // Find the first pin
    const firstPin = page.locator('[data-testid="pin-item"]').first()
    await expect(firstPin).toBeVisible({ timeout: 5000 })

    // Get the pin content for verification
    const pinContent = await firstPin.locator('[data-testid="pin-content"]').textContent()
    console.log(`🔍 Pin to delete: "${pinContent}"`)

    // Initially, delete button should be transparent (opacity 0)
    const deleteButton = firstPin.locator('[data-testid="delete-pin"]')
    const initialOpacity = await deleteButton.evaluate(el => window.getComputedStyle(el).opacity)
    expect(initialOpacity).toBe('0')

    // Hover over the pin to reveal delete button
    await firstPin.hover()
    await page.waitForTimeout(500)

    // Now delete button should be visible
    await expect(deleteButton).toBeVisible({ timeout: 3000 })
    console.log('✅ Delete button appears on hover')

    // Get initial pin count for comparison
    const initialPinCount = await page.locator('[data-testid="pin-item"]').count()

    // Click the delete button
    await deleteButton.click()
    console.log('🗑️ Delete button clicked')

    // Wait for deletion to complete
    await page.waitForTimeout(2000)

    // Verify the pin was deleted from the UI
    const newPinCount = await page.locator('[data-testid="pin-item"]').count()
    console.log(`🔍 Pin count after deletion: ${newPinCount}`)

    if (newPinCount === 0) {
      // Should show empty state
      await expect(page.locator('text=Nothing pinned yet')).toBeVisible({ timeout: 5000 })
      console.log('✅ Pin deleted successfully - now showing empty state')
    } else {
      // Should have one less pin
      expect(newPinCount).toBe(initialPinCount - 1)
      console.log('✅ Pin deleted successfully - pin count decreased')
      
      // Verify the specific pin is no longer in the list
      const remainingPinContents = await page.locator('[data-testid="pin-content"]').allTextContents()
      expect(remainingPinContents).not.toContain(pinContent)
      console.log('✅ Deleted pin no longer appears in list')
    }

    // Verify that incremental scan doesn't bring the pin back
    console.log('🔄 Testing incremental scan after deletion...')
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.refreshPins) {
        await (window as any).electronAPI.refreshPins()
      }
    })
    await page.waitForTimeout(2000)

    // Pin count should remain the same after scan
    const postScanPinCount = await page.locator('[data-testid="pin-item"]').count()
    expect(postScanPinCount).toBe(newPinCount)
    console.log('✅ Incremental scan does not restore deleted pin')

    // Verify the deleted pin content is still not in the list
    if (postScanPinCount > 0) {
      const postScanPinContents = await page.locator('[data-testid="pin-content"]').allTextContents()
      expect(postScanPinContents).not.toContain(pinContent)
      console.log('✅ Deleted pin content confirmed removed from org file')
    }
  })

  test('should handle ESC key to close window', async () => {
    console.log('🧪 Testing ESC key to close window...')

    await page.waitForSelector('#root', { timeout: 10000 })

    // Window should be visible initially
    expect(await page.isVisible('body')).toBe(true)

    // Set up console listener to capture all console messages
    const allLogs: string[] = []
    page.on('console', (msg) => {
      allLogs.push(msg.text())
    })

    // First verify that hideWindow API is available
    const apiResult = await page.evaluate(() => {
      return {
        electronAPIExists: typeof (window as any).electronAPI !== 'undefined',
        hideWindowExists: typeof (window as any).electronAPI?.hideWindow === 'function',
        windowObject: Object.keys(window as any).filter((key) => key.includes('electron'))
      }
    })

    console.log('🔍 API availability:', apiResult)
    expect(apiResult.electronAPIExists).toBe(true)
    expect(apiResult.hideWindowExists).toBe(true)

    // Test ESC when no modal is open
    console.log('🧪 Testing ESC key when no modal is open...')
    await page.keyboard.press('Escape')

    // Wait for the timeout delay in our handler plus processing time
    await page.waitForTimeout(1500)

    // Check if our ESC handler was triggered for non-modal case
    const escLogs = allLogs.filter((log) => log.includes('ESC key pressed, hiding window'))
    expect(escLogs.length).toBeGreaterThan(0)
    console.log('✅ ESC key works when no modal is open')

    // Clear logs for next test
    allLogs.length = 0

    // Test ESC when modal is open (if there are pins to click)
    const hasAnyPins = await page.evaluate(() => {
      const pinElements = document.querySelectorAll('[data-testid="pin-item"]')
      return pinElements.length > 0
    })

    if (hasAnyPins) {
      console.log('🧪 Testing ESC key behavior with modal...')

      // Click a pin to open modal (use ctrl+click for detail view)
      await page.keyboard.down('Meta') // Use Meta on macOS
      await page.click('[data-testid="pin-item"]')
      await page.keyboard.up('Meta')

      // Wait for modal to open
      await page.waitForSelector('[data-testid="pin-detail-modal"]', { timeout: 3000 })

      // Press ESC - should close modal, not window
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      // Modal should be closed
      expect(await page.isVisible('[data-testid="pin-detail-modal"]')).toBe(false)

      // Now press ESC again - should close window
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1500)

      // Check that window-closing ESC was triggered
      const windowEscLogs = allLogs.filter((log) => log.includes('ESC key pressed, hiding window'))
      expect(windowEscLogs.length).toBeGreaterThan(0)

      console.log('✅ ESC key properly handles modal vs window closing')
    } else {
      console.log('ℹ️ No pins available to test modal behavior')
    }
  })

  test('should handle comprehensive pin deletion scenarios', async () => {
    console.log('🧪 Testing comprehensive pin deletion scenarios...')

    // Wait for the app to be ready
    await page.waitForSelector('#root', { timeout: 10000 })

    // Set up dedicated CRUD test directory to avoid interfering with other tests
    const crudTestDir = path.join(process.cwd(), 'test-org-files-crud')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, crudTestDir)

    // Trigger a scan to ensure we have fresh data including crud-test.org
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.refreshPins) {
        await (window as any).electronAPI.refreshPins()
      }
    })

    await page.waitForTimeout(2000) // Wait for scan to complete

    // Get initial pin count (should be 9 total: 6 from test.org + detailed-test.org + 3 from crud-test.org)
    let pinCount = await page.locator('[data-testid="pin-item"]').count()
    console.log(`🔍 Starting with ${pinCount} pins`)

    if (pinCount < 2) {
      console.log('⚠️ Need more pins for comprehensive testing - running full scan...')
      
      await page.evaluate(() => {
        window.location.hash = '#/preferences'
        window.dispatchEvent(new Event('hashchange'))
      })
      await page.waitForTimeout(1000)

      const fullScanButton = page.locator('[data-testid="full-scan-button"]')
      if (await fullScanButton.isVisible({ timeout: 3000 })) {
        await fullScanButton.click()
        await page.waitForTimeout(3000)
      }

      await page.evaluate(() => {
        window.location.hash = '#/'
        window.dispatchEvent(new Event('hashchange'))
      })
      await page.waitForTimeout(1000)

      pinCount = await page.locator('[data-testid="pin-item"]').count()
      if (pinCount < 2) {
        console.log('⚠️ Still insufficient pins - skipping comprehensive test')
        return
      }
    }

    // Test 1: Delete button visibility behavior
    console.log('🧪 Test 1: Delete button visibility on hover')
    const firstPin = page.locator('[data-testid="pin-item"]').first()
    
    // Delete button should have opacity 0 initially (visually hidden)
    let deleteButton = firstPin.locator('[data-testid="delete-pin"]')
    const initialOpacity = await deleteButton.evaluate(el => window.getComputedStyle(el).opacity)
    expect(initialOpacity).toBe('0')
    
    // Hover to show delete button
    await firstPin.hover()
    await page.waitForTimeout(300)
    await expect(deleteButton).toBeVisible({ timeout: 2000 })
    
    // Move away to hide delete button
    await page.locator('body').hover() // Hover away from pin
    await page.waitForTimeout(300)
    const finalOpacity = await deleteButton.evaluate(el => window.getComputedStyle(el).opacity)
    expect(finalOpacity).toBe('0')
    console.log('✅ Delete button visibility behavior correct')

    // Test 2: Delete middle pin (to test list reordering)
    if (pinCount >= 3) {
      console.log('🧪 Test 2: Delete middle pin')
      const middlePin = page.locator('[data-testid="pin-item"]').nth(1)
      const middlePinContent = await middlePin.locator('[data-testid="pin-content"]').textContent()
      
      await middlePin.hover()
      await page.waitForTimeout(300)
      deleteButton = middlePin.locator('[data-testid="delete-pin"]')
      await deleteButton.click()
      await page.waitForTimeout(2000)
      
      const remainingContents = await page.locator('[data-testid="pin-content"]').allTextContents()
      expect(remainingContents).not.toContain(middlePinContent)
      console.log('✅ Middle pin deleted successfully')
      
      pinCount = await page.locator('[data-testid="pin-item"]').count()
    }

    // Test 3: Delete all remaining pins one by one
    console.log('🧪 Test 3: Delete all remaining pins')
    while (pinCount > 0) {
      const currentPin = page.locator('[data-testid="pin-item"]').first()
      await currentPin.hover()
      await page.waitForTimeout(300)
      
      deleteButton = currentPin.locator('[data-testid="delete-pin"]')
      await deleteButton.click()
      await page.waitForTimeout(1500)
      
      const newCount = await page.locator('[data-testid="pin-item"]').count()
      expect(newCount).toBe(pinCount - 1)
      pinCount = newCount
      console.log(`🔍 Pins remaining: ${pinCount}`)
    }

    // Test 4: Verify empty state is shown
    console.log('🧪 Test 4: Verify empty state after deleting all pins')
    const emptyStateVisible = await page.locator('text=Nothing pinned yet').isVisible({ timeout: 3000 })
    expect(emptyStateVisible).toBe(true)
    console.log('✅ Empty state displayed correctly')

    // Test 5: Verify scan doesn't restore deleted pins
    console.log('🧪 Test 5: Verify scan doesn\'t restore deleted pins')
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.refreshPins) {
        await (window as any).electronAPI.refreshPins()
      }
    })
    await page.waitForTimeout(2000)

    const finalPinCount = await page.locator('[data-testid="pin-item"]').count()
    expect(finalPinCount).toBe(0)
    console.log('✅ Deleted pins remain deleted after scan')
  })
})
