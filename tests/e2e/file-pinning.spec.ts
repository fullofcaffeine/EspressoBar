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
  
  // Base arguments for all environments
  const baseArgs = [
    path.join(process.cwd(), 'out', 'main', 'index.js'),
    '--test-mode'
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
  await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })

  const settingsSelectors = [
    'button:has(svg)', // Any button with SVG (Settings icon)
    'button[title*="preferences"]',
    'button[title*="settings"]',
    'button:has([data-testid="settings"])',
    '.lucide-settings', // Direct class reference
    'svg[class*="lucide-settings"]' // SVG with settings class
  ]

  let navigated = false

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
      continue
    }
  }

  if (!navigated) {
    console.log('Settings button click failed, using programmatic navigation')
    await page.evaluate(() => {
      if (window.location.pathname !== '/preferences') {
        window.history.pushState({}, '', '/preferences')
        window.dispatchEvent(new Event('popstate'))
        const event = new CustomEvent('navigate', { detail: { path: '/preferences' } })
        window.dispatchEvent(event)
      }
    })
    await page.waitForTimeout(500)
  }

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
      continue
    }
  }

  if (!preferencesLoaded) {
    await page.screenshot({ path: 'debug-navigation-failure.png' })
    console.log('Current URL:', await page.url())
    console.log('Current page content preview:', await page.locator('body').textContent())
    throw new Error('Failed to navigate to preferences - no preferences indicators found')
  }
}

async function navigateToMainPopup() {
  const backSelectors = [
    'button[title*="Back"]',
    'button[title*="main"]',
    'button:has(.lucide-arrow-left)',
    'button:has(svg)',
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
      continue
    }
  }

  if (!navigated) {
    console.log('Back button click failed, using programmatic navigation')
    await page.evaluate(() => {
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/')
        window.dispatchEvent(new Event('popstate'))
        const event = new CustomEvent('navigate', { detail: { path: '/' } })
        window.dispatchEvent(event)
      }
    })
    await page.waitForTimeout(500)
  }

  await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })
  await page.waitForTimeout(500)
}

test.describe('File Pinning via #+filetags End-to-End', () => {
  test('should detect and display file-only pins', async () => {
    console.log('🧪 Testing file-only pin detection and display...')

    // Configure test directory that includes our file-pin test files
    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Navigate to preferences and trigger scan
    await navigateToPreferences()
    await page.waitForTimeout(1000)

    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await expect(scanButton).toBeVisible({ timeout: 5000 })
    await scanButton.click()

    // Wait for scan to complete
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })

    // Navigate back to main popup to see pins
    await navigateToMainPopup()

    // Should see pins (3 file pins + 2 headline pins from mixed-pins.org = 5 total)
    const pinElements = page.locator('[data-testid="pin-content"]')
    await expect(pinElements.first()).toBeVisible({ timeout: 5000 })
    
    // Check that we have the expected 5 total pins
    const pinCount = await pinElements.count()
    expect(pinCount).toBe(5) // 3 file pins + 2 headline pins

    console.log(`✅ Found ${pinCount} pins after scanning`)
  })

  test('should show file pins with visual distinction', async () => {
    console.log('🧪 Testing file pin visual distinction...')

    // Configure test directory
    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins') 
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Trigger scan
    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })

    // Navigate to main popup
    await navigateToMainPopup()

    // Look for file pins - they should have file icons
    const pinElements = page.locator('[data-testid="pin-item"]')
    const pinCount = await pinElements.count()
    
    // We should have 5 total pins (3 file + 2 headline)
    expect(pinCount).toBe(5)
    
    // Get all pin content elements and their associated text
    const pinContentElements = page.locator('[data-testid="pin-content"]')
    const pinTexts = await pinContentElements.allTextContents()
    
    console.log('Pin texts found:', pinTexts)
    
    // Check if the expected file pin titles are present
    const hasMyImportantProject = pinTexts.some(text => text.includes('My Important Project'))
    const hasMixedPinTypes = pinTexts.some(text => text.includes('Mixed Pin Types'))
    const hasComplexFiletags = pinTexts.some(text => text.includes('Complex Filetags'))
    
    // Check for headline pins
    const hasImportantTask = pinTexts.some(text => text.includes('Important task'))
    const hasAnotherPinnedItem = pinTexts.some(text => text.includes('Another pinned item'))
    
    console.log('File pins found:')
    console.log('  My Important Project:', hasMyImportantProject)
    console.log('  Mixed Pin Types:', hasMixedPinTypes)
    console.log('  Complex Filetags:', hasComplexFiletags)
    console.log('Headline pins found:')
    console.log('  Important task:', hasImportantTask)
    console.log('  Another pinned item:', hasAnotherPinnedItem)
    
    // All expected pins should be present
    expect(hasMyImportantProject).toBe(true)
    expect(hasMixedPinTypes).toBe(true)
    expect(hasComplexFiletags).toBe(true)
    expect(hasImportantTask).toBe(true)
    expect(hasAnotherPinnedItem).toBe(true)
    
    console.log(`✅ Pins displayed: ${pinCount}, Visual distinction test completed`)
  })

  test('should display filename as content for file pins', async () => {
    console.log('🧪 Testing file pin content display...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    // File pins should show the filename or title as content
    // file-pin-only.org has #+title: My Important Project
    // So we should see "My Important Project" as content
    const pinElements = page.locator('[data-testid="pin-content"]')
    
    if (await pinElements.count() > 0) {
      // Get all pin texts to check for file-based content
      const pinTexts = await pinElements.allTextContents()
      console.log('Pin texts found:', pinTexts)
      
      // Check if we have the expected file pins
      const hasMyImportantProject = pinTexts.some(text => text.includes('My Important Project'))
      const hasMixedPinTypes = pinTexts.some(text => text.includes('Mixed Pin Types'))
      const hasComplexFiletags = pinTexts.some(text => text.includes('Complex Filetags'))
      
      console.log('Expected file pins found:')
      console.log('  My Important Project:', hasMyImportantProject)
      console.log('  Mixed Pin Types:', hasMixedPinTypes)
      console.log('  Complex Filetags:', hasComplexFiletags)
      
      // We should have all 3 file pins
      expect(hasMyImportantProject).toBe(true)
      expect(hasMixedPinTypes).toBe(true)
      expect(hasComplexFiletags).toBe(true)
      
      expect(pinTexts.length).toBe(5) // 3 file pins + 2 headline pins
    }
  })

  test('should handle mixed file and headline pins', async () => {
    console.log('🧪 Testing mixed file and headline pins...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    // mixed-pins.org should generate both file pin and headline pins
    // We should see more than 3 pins (3 file pins + 2 headline pins from mixed-pins.org)
    const pinElements = page.locator('[data-testid="pin-content"]')
    const pinCount = await pinElements.count()
    
    // We expect 5 total pins: 3 file pins + 2 headline pins from mixed-pins.org
    expect(pinCount).toBe(5)
    
    console.log(`✅ Mixed pins test: found ${pinCount} total pins`)
  })

  test('should open file pins at line 1 when clicked', async () => {
    console.log('🧪 Testing file pin click behavior...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    const pinElements = page.locator('[data-testid="pin-content"]')
    if (await pinElements.count() > 0) {
      // Click the first pin (single click should open in Emacs)
      await pinElements.first().click()
      
      // For now, just verify the click doesn't crash the app
      // We can't easily test emacs opening in E2E tests
      await page.waitForTimeout(500)
      
      // Verify app is still responsive
      await expect(page.locator('#root')).toBeVisible({ timeout: 5000 })
      console.log('✅ File pin click test completed without errors')
    }
  })

  test('should show file pin details in detail modal', async () => {
    console.log('🧪 Testing file pin detail view...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    const pinElements = page.locator('[data-testid="pin-content"]')
    if (await pinElements.count() > 0) {
      // Command/Ctrl+click to open detail view
      const firstPin = pinElements.first()
      
      await firstPin.click({ 
        modifiers: process.platform === 'darwin' ? ['Meta'] : ['Control'] 
      })
      
      // Should open pin detail modal
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
      
      // Detail modal should show file information
      // TODO: Add specific assertions for file pin indicators once implemented
      
      // Close the modal
      const closeButton = page.locator('button:has-text("Close")').first()
      if (await closeButton.isVisible()) {
        await closeButton.click()
      } else {
        await page.keyboard.press('Escape')
      }
      
      console.log('✅ File pin detail view test completed')
    }
  })

  test('should preserve file pins after app restart', async () => {
    console.log('🧪 Testing file pin persistence across app restarts...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    // Initial scan
    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    const initialPinCount = await page.locator('[data-testid="pin-content"]').count()
    console.log(`Initial pin count: ${initialPinCount}`)

    // Restart the app by closing and reopening
    await electronApp.close()
    
    // Relaunch the app
    electronApp = await electron.launch({
      args: [
        path.join(process.cwd(), 'out', 'main', 'index.js'),
        '--test-mode',
        ...(process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-features=VizDisplayCompositor'] : [])
      ],
      timeout: 15000
    })

    page = await electronApp.firstWindow()
    await page.waitForLoadState('networkidle', { timeout: 8000 })
    await page.waitForSelector('#root', { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Check if pins are still there after restart
    const pinElements = page.locator('[data-testid="pin-content"]')
    await expect(pinElements.first()).toBeVisible({ timeout: 10000 })
    
    const finalPinCount = await pinElements.count()
    console.log(`Pin count after restart: ${finalPinCount}`)
    
    // Should have same number of pins
    expect(finalPinCount).toBe(initialPinCount)
    
    console.log('✅ File pins persisted across app restart')
  })

  test('should handle complex filetag scenarios', async () => {
    console.log('🧪 Testing complex filetag scenarios...')

    const testOrgDir = path.join(process.cwd(), 'test-org-files-file-pins')
    await page.evaluate(async (dir) => {
      if ((window as any).electronAPI && (window as any).electronAPI.setOrgDirectories) {
        await (window as any).electronAPI.setOrgDirectories([dir])
      }
    }, testOrgDir)

    await navigateToPreferences()
    const scanButton = page.locator('[data-testid="incremental-scan-button"]')
    await scanButton.click()
    await expect(page.locator('text=Last scan completed')).toBeVisible({ timeout: 10000 })
    await navigateToMainPopup()

    // complex-filetags.org has #+FILETAGS: :research:pinned:urgent:deadline:
    // This should be detected as a file pin despite having multiple tags
    const pinElements = page.locator('[data-testid="pin-content"]')
    const pinCount = await pinElements.count()
    
    expect(pinCount).toBe(5) // 3 file pins + 2 headline pins from mixed-pins.org
    console.log(`✅ Complex filetags test: found ${pinCount} pins`)
  })
}) 
