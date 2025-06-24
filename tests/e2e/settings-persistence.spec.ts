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
  const settingsPath = path.join(storageDir, 'settings.json')

  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath)
    console.log('🧹 Cleaned up existing settings storage')
  }

  // Launch Electron app in test mode
  console.log('🚀 Launching Electron app in test mode for settings persistence tests...')
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
  await page.waitForTimeout(1000)

  console.log('✅ Settings persistence test setup complete')
})

test.beforeEach(async () => {
  console.log('🧹 Resetting settings before each test...')

  // Reset settings via the renderer process
  await page.evaluate(async () => {
    if ((window as any).electronAPI && (window as any).electronAPI.resetSettings) {
      await (window as any).electronAPI.resetSettings()
    }
  })

  console.log('✅ Settings reset complete')
})

test.afterAll(async () => {
  console.log('🧹 Cleaning up Electron app...')
  if (electronApp) {
    try {
      await electronApp.close()
      console.log('✅ Electron app closed successfully')
    } catch (error) {
      console.log('⚠️ Error closing Electron app:', error)
    }
  }
})

test.describe('Settings Persistence', () => {
  test('should persist org directory configuration across app restarts', async () => {
    console.log('🧪 Testing org directory persistence across app restarts...')

    // Step 1: Set org directories using the API directly (more reliable than UI)
    const testDirectories = ['/Users/test/test-org-files', '/Users/test/docs']

    const initialSettings = await page.evaluate(async (directories) => {
      return await (window as any).electronAPI.updateSettings({
        orgDirectories: directories
      })
    }, testDirectories)

    expect(initialSettings.orgDirectories).toEqual(testDirectories)
    console.log('✅ Step 1: Settings updated via API')

    // Step 2: Verify settings are immediately available
    const currentSettings = await page.evaluate(async () => {
      return await (window as any).electronAPI.getSettings()
    })

    expect(currentSettings.orgDirectories).toEqual(testDirectories)
    console.log('✅ Step 2: Settings confirmed in current session')

    // Step 3: Close and restart the app to test persistence
    console.log('🔄 Step 3: Restarting app to test persistence...')
    await electronApp.close()

    // Launch new app instance
    electronApp = await electron.launch({
      args: [path.join(process.cwd(), 'out', 'main', 'index.js'), '--test-mode'],
      timeout: 15000
    })

    await electronApp.evaluate(async ({ app }) => app.whenReady())
    page = await electronApp.firstWindow()
    await page.waitForLoadState('networkidle', { timeout: 8000 })
    await page.waitForSelector('#root', { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Step 4: Verify settings were persisted
    const persistedSettings = await page.evaluate(async () => {
      return await (window as any).electronAPI.getSettings()
    })

    expect(persistedSettings.orgDirectories).toEqual(testDirectories)
    console.log('✅ Step 4: Settings persisted across app restart!')

    // Step 5: Verify we can modify and persist new settings
    const newDirectories = ['/Users/test/projects']
    const updatedSettings = await page.evaluate(async (directories) => {
      return await (window as any).electronAPI.updateSettings({
        orgDirectories: directories
      })
    }, newDirectories)

    expect(updatedSettings.orgDirectories).toEqual(newDirectories)
    console.log('✅ Step 5: Settings can be updated in persisted session')

    console.log('🎉 Org directory persistence test completed successfully!')
  })

  test('should handle multiple org directories persistence', async () => {
    console.log('🧪 Testing multiple org directories persistence...')

    // Step 1: Set multiple org directories using the API
    const multipleDirectories = ['/Users/test/projects', '/Users/test/notes', '/Users/test/archive']

    const initialSettings = await page.evaluate(async (directories) => {
      return await (window as any).electronAPI.updateSettings({
        orgDirectories: directories
      })
    }, multipleDirectories)

    expect(initialSettings.orgDirectories).toEqual(multipleDirectories)
    console.log('✅ Step 1: Multiple directories set via API')

    // Step 2: Verify settings are immediately available
    const currentSettings = await page.evaluate(async () => {
      return await (window as any).electronAPI.getSettings()
    })

    expect(currentSettings.orgDirectories).toEqual(multipleDirectories)
    expect(currentSettings.orgDirectories.length).toBe(3)
    console.log('✅ Step 2: Multiple directories confirmed in current session')

    // Step 3: Close and restart the app to test persistence
    console.log('🔄 Step 3: Restarting app to test persistence...')
    await electronApp.close()

    // Launch new app instance
    electronApp = await electron.launch({
      args: [path.join(process.cwd(), 'out', 'main', 'index.js'), '--test-mode'],
      timeout: 15000
    })

    await electronApp.evaluate(async ({ app }) => app.whenReady())
    page = await electronApp.firstWindow()
    await page.waitForLoadState('networkidle', { timeout: 8000 })
    await page.waitForSelector('#root', { timeout: 5000 })
    await page.waitForTimeout(1000)

    // Step 4: Verify all directories were persisted
    const persistedSettings = await page.evaluate(async () => {
      return await (window as any).electronAPI.getSettings()
    })

    expect(persistedSettings.orgDirectories).toEqual(multipleDirectories)
    expect(persistedSettings.orgDirectories.length).toBe(3)
    console.log('✅ Step 4: Multiple directories persisted across restart!')

    // Step 5: Test partial modification (remove one, add one)
    const modifiedDirectories = [
      '/Users/test/projects', // keep
      '/Users/test/notes', // keep
      '/Users/test/new-folder' // replace archive with this
    ]

    const updatedSettings = await page.evaluate(async (directories) => {
      return await (window as any).electronAPI.updateSettings({
        orgDirectories: directories
      })
    }, modifiedDirectories)

    expect(updatedSettings.orgDirectories).toEqual(modifiedDirectories)
    expect(updatedSettings.orgDirectories.length).toBe(3)
    console.log('✅ Step 5: Multiple directories can be modified')

    console.log('🎉 Multiple org directories persistence test completed successfully!')
  })

  test('should persist other settings like theme and hotkeys', async () => {
    console.log('🧪 Testing theme and hotkey persistence...')

    // Test theme setting persistence (this would require implementing theme settings in preferences)
    await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.updateSettings) {
        await (window as any).electronAPI.updateSettings({
          theme: 'dark',
          autoStart: true,
          hotkeys: {
            toggle: 'CommandOrControl+Shift+P',
            capture: 'CommandOrControl+Shift+N'
          }
        })
      }
    })

    // Restart and verify these settings persist
    await electronApp.close()

    electronApp = await electron.launch({
      args: [path.join(process.cwd(), 'out', 'main', 'index.js'), '--test-mode'],
      timeout: 15000
    })

    await electronApp.evaluate(async ({ app }) => {
      return app.whenReady()
    })

    page = await electronApp.firstWindow()
    await page.waitForLoadState('networkidle', { timeout: 8000 })
    await page.waitForSelector('#root', { timeout: 5000 })

    // Verify settings persisted via API
    const persistedSettings = await page.evaluate(async () => {
      if ((window as any).electronAPI && (window as any).electronAPI.getSettings) {
        return await (window as any).electronAPI.getSettings()
      }
      return null
    })

    expect(persistedSettings).toBeTruthy()
    expect(persistedSettings.theme).toBe('dark')
    expect(persistedSettings.autoStart).toBe(true)
    expect(persistedSettings.hotkeys.toggle).toBe('CommandOrControl+Shift+P')

    console.log('🎉 Theme and hotkey persistence test completed successfully!')
  })
})
