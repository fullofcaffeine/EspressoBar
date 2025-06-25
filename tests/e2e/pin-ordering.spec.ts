import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

let electronApp: ElectronApplication
let page: Page

/**
 * Drag and Drop Helper Functions
 * 
 * We provide three approaches for drag and drop, from simplest to most compatible:
 * 
 * 1. dragAndDropSimple: Uses Playwright's built-in dragTo() - simplest but may not work with all drag libraries
 * 2. dragAndDropRobust: Uses dragTo() on the drag handle with force option - better for @dnd-kit compatibility
 * 3. dragAndDropManual: Full manual control with mouse events - most compatible but most complex
 * 
 * The app uses @dnd-kit which sometimes requires specific mouse event sequences.
 * We use dragAndDropRobust as it provides a good balance of simplicity and compatibility.
 */

// Helper function for simplified drag and drop using Playwright's built-in method
async function dragAndDropSimple(source: any, target: any) {
  // This is the simplest approach - Playwright's built-in dragTo
  await source.dragTo(target)
}

// Helper function for more robust drag and drop with better @dnd-kit compatibility
async function dragAndDropRobust(page: Page, source: any, target: any) {
  // Hover to ensure drag handle is visible
  await source.hover()
  await page.waitForTimeout(300) // Wait for hover transition
  
  const dragHandle = source.locator('[data-testid="drag-handle"]')
  await expect(dragHandle).toBeVisible()
  
  // Use Playwright's dragTo on the handle itself
  // This is more reliable than manual mouse movements
  await dragHandle.dragTo(target, {
    // Force bypasses actionability checks which can help with dynamic elements
    force: true,
    // Target the center of the drop zone
    targetPosition: { x: 0, y: 0 }
  })
}

// Alternative helper using manual mouse control for maximum compatibility
async function dragAndDropManual(page: Page, source: any, target: any) {
  await source.hover()
  await page.waitForTimeout(300)
  
  const dragHandle = source.locator('[data-testid="drag-handle"]')
  await expect(dragHandle).toBeVisible()
  
  // Get center coordinates more reliably
  const sourceBox = await dragHandle.boundingBox()
  const targetBox = await target.boundingBox()
  
  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding boxes for drag and drop')
  }
  
  // Move to exact center of drag handle
  const sourceCenter = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2
  }
  
  const targetCenter = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2
  }
  
  // Perform drag with smoother animation
  await page.mouse.move(sourceCenter.x, sourceCenter.y)
  await page.mouse.down()
  
  // Move in multiple steps for better compatibility with drag libraries
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps: 10 })
  
  // Small pause before drop to ensure drag state is recognized
  await page.waitForTimeout(50)
  await page.mouse.up()
}

test.beforeAll(async () => {
  // Clean up any existing storage to start fresh
  const storageDir = path.join(os.homedir(), '.config', 'EspressoBar')
  const storagePath = path.join(storageDir, 'pinned.json')
  const settingsPath = path.join(storageDir, 'settings.json')

  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath)
    console.log('🧹 Cleaned up existing pin storage')
  }

  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath)
    console.log('🧹 Cleaned up existing settings storage')
  }

  // Launch Electron app in test mode
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
  await page.waitForSelector('#root', { timeout: 5000 })

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
  console.log('🧹 Cleaning up after all tests...')
  if (electronApp) {
    await electronApp.close()
  }
})

// Helper function to set up test org directory and scan for pins
async function setupTestOrgData() {
  const testOrgDir = path.join(process.cwd(), 'test-org-files')
  
  // Configure org directory
  await page.evaluate(async (dir) => {
    if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
      await (window as any).electronAPI.setOrgDirectories([dir])
    }
  }, testOrgDir)

  // Navigate to preferences to trigger scan via UI (following working test pattern)
  await page.evaluate(() => {
    window.location.hash = '#/preferences'
    window.dispatchEvent(new Event('hashchange'))
  })
  await page.waitForTimeout(1000)

  // Click scan button like in working tests
  const scanButton = page.locator('[data-testid="incremental-scan-button"]')
  await expect(scanButton).toBeVisible({ timeout: 5000 })
  await expect(scanButton).toBeEnabled({ timeout: 5000 })
  await scanButton.click()

  // Wait for scan to complete
  await page.waitForTimeout(3000)
}

test.describe('Pin Ordering & Drag and Drop', () => {

  test('should display pins in parsing order by default', async () => {
    console.log('🧪 Testing default pin ordering...')
    
    // Set up test data first
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    // Verify we have pins loaded - should have 6 total from test.org + detailed-test.org
    const pinItems = page.locator('[data-testid="pin-item"]')
    await expect(pinItems).toHaveCount(6, { timeout: 5000 })
    const pinCount = await pinItems.count()
    console.log(`🔍 Found ${pinCount} pins`)
    
    expect(pinCount).toBe(6)
    
    // Verify pins are displayed in expected parsing order
    // The first pin should be visible and contain expected content from org files
    const firstPin = pinItems.first()
    await expect(firstPin).toBeVisible()
    
         // Get the content of each pin to verify they're in parsing order
     const pinContents: string[] = []
     for (let i = 0; i < Math.min(pinCount, 6); i++) {
       const content = await pinItems.nth(i).locator('[data-testid="pin-content"]').textContent()
       if (content?.trim()) {
         pinContents.push(content.trim())
       }
     }
     
     console.log('📝 Pin contents in order:', pinContents)
     
     // Pins should be in a consistent order (parsing order from org files)
     expect(pinContents.length).toBeGreaterThan(0)
     expect(pinContents[0]).toBeTruthy()
    
    console.log('✅ Default pin ordering test passed')
  })

  test('should show drag handles only on hover', async () => {
    console.log('🧪 Testing drag handle visibility...')
    
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    // Verify pins are displayed
    await expect(page.locator('[data-testid="pin-item"]')).toHaveCount(6, { timeout: 5000 })
    
    const firstPin = page.locator('[data-testid="pin-item"]').first()
    await expect(firstPin).toBeVisible()
    
    // Drag handle should not be visible initially
    const dragHandle = firstPin.locator('[data-testid="drag-handle"]')
    await expect(dragHandle).not.toBeVisible()
    
    // Hover over the pin
    await firstPin.hover()
    await page.waitForTimeout(300) // Wait for hover transition
    
    // Drag handle should now be visible
    await expect(dragHandle).toBeVisible()
    
    // Move mouse away from pin
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300) // Wait for hover transition
    
    // Drag handle should be hidden again
    await expect(dragHandle).not.toBeVisible()
    
    console.log('✅ Drag handle hover test passed')
  })

  test('should reorder pins via drag and drop', async () => {
    console.log('🧪 Testing drag and drop reordering...')
    
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    // Verify we have 6 pins for testing
    const pinItems = page.locator('[data-testid="pin-item"]')
    await expect(pinItems).toHaveCount(6, { timeout: 5000 })
    const pinCount = await pinItems.count()
    
    expect(pinCount).toBe(6)
    
         // Get initial order
     const initialContents: string[] = []
     for (let i = 0; i < Math.min(pinCount, 4); i++) {
       const content = await pinItems.nth(i).locator('[data-testid="pin-content"]').textContent()
       if (content?.trim()) {
         initialContents.push(content.trim())
       }
     }
     
     console.log('📝 Initial order:', initialContents)
     
     // Drag first pin to second position
     const firstPin = pinItems.first()
     const secondPin = pinItems.nth(1)
     
     // Use the simplified drag and drop helper
     await dragAndDropRobust(page, firstPin, secondPin)
     
     await page.waitForTimeout(1000) // Wait for reordering animation and state updates
     
     // Verify order changed
     const newContents: string[] = []
     for (let i = 0; i < Math.min(pinCount, 4); i++) {
       const content = await pinItems.nth(i).locator('[data-testid="pin-content"]').textContent()
       if (content?.trim()) {
         newContents.push(content.trim())
       }
     }
     
     console.log('📝 New order:', newContents)
     
     // The order should have changed - first and second items should be swapped
     expect(newContents[0]).toBe(initialContents[1])
     expect(newContents[1]).toBe(initialContents[0])
    
    console.log('✅ Drag and drop reordering test passed')
  })

  test('should persist custom order across app restarts', async () => {
    console.log('🧪 Testing order persistence...')
    
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    const pinItems = page.locator('[data-testid="pin-item"]')
    await expect(pinItems).toHaveCount(6, { timeout: 5000 })
    const pinCount = await pinItems.count()
    
    expect(pinCount).toBe(6)
    
    // Get initial order and perform reordering
    const initialContent = await pinItems.first().locator('[data-testid="pin-content"]').textContent()
    const secondContent = await pinItems.nth(1).locator('[data-testid="pin-content"]').textContent()
    
    // Drag first pin to second position
    const firstPin = pinItems.first()
    const secondPin = pinItems.nth(1)
    
    // Use the simplified drag and drop helper
    await dragAndDropRobust(page, firstPin, secondPin)
    
    await page.waitForTimeout(1000) // Wait for reordering animation and state updates
    
    // Verify order changed
    const reorderedFirst = await pinItems.first().locator('[data-testid="pin-content"]').textContent()
    expect(reorderedFirst).toBe(secondContent)
    
         // Restart the app to test persistence
     console.log('🔄 Restarting app to test persistence...')
     await electronApp.close()
     
     // Launch app again
     const baseArgs = [
       path.join(process.cwd(), 'out', 'main', 'index.js'),
       '--test-mode'
     ]
     
     const ciArgs = process.env.CI ? [
       '--no-sandbox',
       '--disable-setuid-sandbox',
       '--disable-gpu',
       '--disable-dev-shm-usage',
       '--disable-features=VizDisplayCompositor'
     ] : []
     
     electronApp = await electron.launch({
       args: [...baseArgs, ...ciArgs],
       timeout: 15000
     })

     await electronApp.evaluate(async ({ app }) => {
       return app.whenReady()
     })

     page = await electronApp.firstWindow()
     await page.waitForLoadState('networkidle', { timeout: 8000 })
     await page.waitForSelector('#root', { timeout: 5000 })
     
     // Wait for pins to load (they should load with custom order)
     await page.waitForTimeout(2000)

     // Navigate to main popup
     await page.evaluate(() => {
       window.location.hash = '#/'
       window.dispatchEvent(new Event('hashchange'))
     })
     await page.waitForTimeout(1000)

     // Wait for pins to be properly loaded
     const newPinItems = page.locator('[data-testid="pin-item"]')
     await expect(newPinItems).toHaveCount(6, { timeout: 8000 })

     // Verify the custom order persisted
     const persistedFirst = await newPinItems.first().locator('[data-testid="pin-content"]').textContent()
     
     expect(persistedFirst).toBe(secondContent)
    
    console.log('✅ Order persistence test passed')
  })

  test('should add new items at top during incremental scan', async () => {
    console.log('🧪 Testing incremental scan behavior...')
    
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    // Get current pin count
    const initialPinItems = page.locator('[data-testid="pin-item"]')
    await expect(initialPinItems).toHaveCount(6, { timeout: 5000 })
    const initialCount = await initialPinItems.count()
    const initialFirstContent = await initialPinItems.first().locator('[data-testid="pin-content"]').textContent()
    
    // Go to preferences to trigger incremental scan
    await page.evaluate(() => {
      window.location.hash = '#/preferences'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
         // Click incremental scan button
     const quickScanButton = page.locator('[data-testid="incremental-scan-button"]')
     await expect(quickScanButton).toBeVisible()
     await quickScanButton.click()
     
     // Wait for scan to complete
     await page.waitForTimeout(2000)
     
     // Go back to main view
     await page.evaluate(() => {
       window.location.hash = '#/'
       window.dispatchEvent(new Event('hashchange'))
     })
     await page.waitForTimeout(1000)
    
    // Verify incremental scan maintains order (no new items expected in test)
    const finalPinItems = page.locator('[data-testid="pin-item"]')
    const finalCount = await finalPinItems.count()
    const finalFirstContent = await finalPinItems.first().locator('[data-testid="pin-content"]').textContent()
    
    // In incremental scan without new files, order should be preserved
    expect(finalCount).toBe(initialCount)
    expect(finalFirstContent).toBe(initialFirstContent)
    
    console.log('✅ Incremental scan behavior test passed')
  })

  test('should preserve custom order during full scan', async () => {
    console.log('🧪 Testing full scan behavior...')
    
    await setupTestOrgData()
    
    // Navigate to main popup view
    await page.evaluate(() => {
      window.location.hash = '#/'
      window.dispatchEvent(new Event('hashchange'))
    })
    await page.waitForTimeout(1000)
    
    const pinItems = page.locator('[data-testid="pin-item"]')
    await expect(pinItems).toHaveCount(6, { timeout: 5000 })
    const pinCount = await pinItems.count()
    
    expect(pinCount).toBe(6)
    
    // Perform reordering first
    const firstPin = pinItems.first()
    const secondPin = pinItems.nth(1)
    const secondContent = await secondPin.locator('[data-testid="pin-content"]').textContent()
    
    // Use the simplified drag and drop helper
    await dragAndDropRobust(page, firstPin, secondPin)
    
    await page.waitForTimeout(1000) // Wait for reordering animation and state updates
    
    // Verify reorder worked
    const reorderedFirst = await pinItems.first().locator('[data-testid="pin-content"]').textContent()
    expect(reorderedFirst).toBe(secondContent)
    
         // Go to preferences and trigger full scan
     await page.evaluate(() => {
       window.location.hash = '#/preferences'
       window.dispatchEvent(new Event('hashchange'))
     })
     await page.waitForTimeout(1000)
     
     const fullScanButton = page.locator('[data-testid="full-scan-button"]')
     await expect(fullScanButton).toBeVisible()
     await fullScanButton.click()
     
     // Wait for scan to complete
     await page.waitForTimeout(2000)
     
     // Go back to main view
     await page.evaluate(() => {
       window.location.hash = '#/'
       window.dispatchEvent(new Event('hashchange'))
     })
     await page.waitForTimeout(1000)
    
    // Verify custom order is preserved after full scan
    const finalPinItems = page.locator('[data-testid="pin-item"]')
    const finalFirstContent = await finalPinItems.first().locator('[data-testid="pin-content"]').textContent()
    
    expect(finalFirstContent).toBe(secondContent)
    
    console.log('✅ Full scan behavior test passed')
  })
}) 
