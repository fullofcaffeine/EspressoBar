import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  NativeImage,
  globalShortcut,
  screen,
  dialog
} from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { Pin } from '../shared/types'
import { IPC_CHANNELS } from '../shared/types'
import { OrgService } from './services/orgService'
import { EmacsService } from './services/emacsService'

// Debug logging at the very start
console.log('🚀 MAIN PROCESS STARTING')
console.log('🔍 Initial process.argv:', process.argv)
console.log('🔍 Initial process.env.ELECTRON_TEST_MODE:', process.env.ELECTRON_TEST_MODE)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let windowMode: 'tray' | 'keyboard' | null = null // Track which mode the window is in

// Check if we're in test mode - support both environment variable and command line argument
const isTestMode = process.env.ELECTRON_TEST_MODE === 'true' || process.argv.includes('--test-mode')

// Debug test mode detection
console.log('🔍 TEST MODE DEBUG:')
console.log('  - ELECTRON_TEST_MODE env var:', process.env.ELECTRON_TEST_MODE)
console.log('  - process.argv:', process.argv)
console.log('  - isTestMode result:', isTestMode)

// Don't show the app in the dock - this should be a background/tray-only app
// But allow it in test mode for easier debugging
if (process.platform === 'darwin' && app.dock && !isTestMode) {
  app.dock.hide()
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 320,
    height: 600,
    transparent: !isTestMode, // Not transparent in test mode so we can see it
    backgroundColor: isTestMode ? '#ffffff' : '#00000000', // White background in test mode
    show: false,
    autoHideMenuBar: true,
    resizable: is.dev || isTestMode, // Allow resizing in dev mode or test mode
    frame: isTestMode, // Show frame in test mode for easier debugging
    skipTaskbar: !isTestMode, // Don't skip taskbar in test mode for easier debugging
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    // In test mode, show the window when it's ready
    if (isTestMode) {
      console.log('🧪 Test mode: Window ready, showing immediately')
      const position = getCenteredWindowPosition()
      console.log(`🧪 Test mode: Setting window position to x=${position.x}, y=${position.y}`)
      mainWindow?.setPosition(position.x, position.y, false)
      mainWindow?.show()
      mainWindow?.focus()
      mainWindow?.setAlwaysOnTop(true) // Make sure it's visible in test mode
      console.log('🧪 Test mode: Window shown, focused, and set to always on top')
      windowMode = 'keyboard'
    }
    // Don't show automatically in normal mode - will be shown via tray click
  })

  // Hide window instead of closing it
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      windowMode = null
    }
  })

  // Hide window when it loses focus, but only in tray mode
  mainWindow.on('blur', () => {
    if (windowMode === 'tray') {
      mainWindow?.hide()
      windowMode = null
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log('🌐 Loading dev URL:', process.env['ELECTRON_RENDERER_URL'])
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    console.log('📄 Loading HTML file from:', htmlPath)
    console.log('🔍 __dirname is:', __dirname)
    console.log('🔍 HTML file exists:', require('fs').existsSync(htmlPath))
    mainWindow.loadFile(htmlPath)
  }
}

// Resolve the tray icon path correctly for both dev and production builds
// Currently unused but available for future use when switching from empty icon approach
// @ts-ignore - unused function kept for future use
function getTrayIcon(): NativeImage {
  console.log('🔍 Getting tray icon...')

  // Use proper tray template images for better positioning and appearance
  const iconPaths = [
    resolve(__dirname, '../../resources/trayTemplate.png'), // Dev path - proper tray template
    join(process.resourcesPath, 'trayTemplate.png'), // Production path
    resolve(app.getAppPath(), 'resources', 'trayTemplate.png') // Alternative path
  ]

  for (const iconPath of iconPaths) {
    console.log(`🔍 Trying tray template icon path: ${iconPath}`)
    try {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        console.log(`✅ Successfully loaded tray template icon from: ${iconPath}`)

        // Keep the original image without resizing - let macOS handle the sizing
        console.log(`📊 Original image properties:`, {
          isEmpty: img.isEmpty(),
          size: img.getSize(),
          aspectRatio: img.getAspectRatio(),
          nativeHandle: !!img.getNativeHandle()
        })

        if (process.platform === 'darwin') {
          // Enable template image for proper macOS tray behavior
          img.setTemplateImage(true)
          console.log(`✅ Template image ENABLED - letting macOS handle sizing automatically`)
          console.log(`📊 Final image properties:`, {
            isEmpty: img.isEmpty(),
            size: img.getSize(),
            isTemplateImage: img.isTemplateImage()
          })
        }

        return img
      } else {
        console.log(`⚠️  Empty image from path: ${iconPath}`)
      }
    } catch (error) {
      console.log(`❌ Error loading tray template icon from ${iconPath}:`, error)
    }
  }

  console.error('❌ Failed to load tray template icon from all paths')
  // Fallback to empty image (alternative approach for positioning issues)
  console.log('🔄 Using empty image as fallback (reference: transparent tray icon approach)')
  return nativeImage.createEmpty()
}

function createTray(): void {
  try {
    console.log('🚀 Creating tray icon...')
    console.log(`🖥️  Platform: ${process.platform}`)

    // Try the empty/transparent icon approach for better positioning on macOS
    // This is a known workaround for tray positioning issues
    console.log('🔄 Using empty/transparent icon approach for better macOS positioning')
    const trayIcon = nativeImage.createEmpty()

    // Alternative: If you want to try with the actual icon, uncomment this:
    // const trayIcon = getTrayIcon()

    if (trayIcon.isEmpty()) {
      console.log('✅ Using empty icon (this is intentional for positioning fix)')
    }

    console.log('📱 Creating Tray instance...')
    tray = new Tray(trayIcon)

    // Set tooltip
    tray.setToolTip('EspressoBar - Quick Pin Access')
    console.log('✅ Tray tooltip set')

    // Since we're using an empty icon, set a title to make it visible
    tray.setTitle('☕')
    console.log('✅ Tray title set to make it visible with empty icon')

    // Handle click events - no context menu, just toggle window
    tray.on('click', () => {
      console.log('🖱️  Tray clicked!')
      handleTrayClick()
    })

    if (process.platform === 'darwin') {
      // On macOS, handle right-click the same as left-click (no context menu)
      tray.on('right-click', () => {
        console.log('🖱️  Tray right-clicked (macOS) - treating as regular click!')
        handleTrayClick()
      })
      console.log('✅ macOS tray click handlers set')
    }

    // Create empty context menu to ensure tray icon visibility without actual menu
    const dummyContextMenu = Menu.buildFromTemplate([])
    tray.setContextMenu(dummyContextMenu)
    console.log('✅ Tray created successfully!')
    console.log(`📍 Platform: ${process.platform}`)

    // Add debugging to help locate the tray icon
    setTimeout(() => {
      if (tray && !tray.isDestroyed()) {
        const bounds = tray.getBounds()
        console.log(
          `🎯 TRAY LOCATION: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`
        )

        // Flash the context menu to make the tray icon more visible
        console.log('🔍 Flashing context menu to help you locate the tray icon...')
        tray.popUpContextMenu()

        setTimeout(() => {
          // Close the menu after a brief moment
          console.log('✨ Context menu should be visible now - this shows where your tray icon is!')
        }, 1000)
      }
    }, 2000)
  } catch (error) {
    console.error('❌ Error creating tray:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available')
  }
}

function getTrayWindowPosition() {
  if (!mainWindow || !tray) return { x: 0, y: 0 }

  const windowBounds = mainWindow.getBounds()
  const trayBounds = tray.getBounds()

  // Center window horizontally below the tray icon
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
  // Position window 4 pixels vertically below the tray icon
  const y = Math.round(trayBounds.y + trayBounds.height + 4)

  return { x, y }
}

function getCenteredWindowPosition() {
  if (!mainWindow) return { x: 0, y: 0 }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

  const windowBounds = mainWindow.getBounds()

  // Center window on screen
  const x = Math.round((screenWidth - windowBounds.width) / 2)
  const y = Math.round((screenHeight - windowBounds.height) / 2)

  return { x, y }
}

function showWindowInTrayMode(): void {
  console.log('showWindowInTrayMode called')
  if (mainWindow) {
    console.log('Main window exists, showing in tray mode...')

    const position = getTrayWindowPosition()
    console.log(`Setting window position to: x=${position.x}, y=${position.y} (tray positioning)`)
    mainWindow.setPosition(position.x, position.y, false)

    mainWindow.show()
    mainWindow.focus()
    windowMode = 'tray'
    console.log('✅ Window shown in tray mode and focused')
  } else {
    console.error('❌ No main window to show!')
  }
}

function showWindowInKeyboardMode(): void {
  console.log('showWindowInKeyboardMode called')
  if (mainWindow) {
    console.log('Main window exists, showing in keyboard mode...')

    const position = getCenteredWindowPosition()
    console.log(
      `Setting window position to: x=${position.x}, y=${position.y} (centered positioning)`
    )
    mainWindow.setPosition(position.x, position.y, false)

    mainWindow.show()
    mainWindow.focus()
    windowMode = 'keyboard'
    console.log('✅ Window shown in keyboard mode and focused')
  } else {
    console.error('❌ No main window to show!')
  }
}

function hideWindow(): void {
  mainWindow?.hide()
  windowMode = null
}

function handleTrayClick(): void {
  if (mainWindow?.isVisible()) {
    if (windowMode === 'keyboard') {
      // Switch from keyboard mode to tray mode
      hideWindow()
      showWindowInTrayMode()
    } else {
      // Hide if already in tray mode
      hideWindow()
    }
  } else {
    // Show in tray mode
    showWindowInTrayMode()
  }
}

function handleKeyboardShortcut(): void {
  if (mainWindow?.isVisible()) {
    if (windowMode === 'tray') {
      // Switch from tray mode to keyboard mode
      hideWindow()
      showWindowInKeyboardMode()
    } else {
      // Hide if already in keyboard mode
      hideWindow()
    }
  } else {
    // Show in keyboard mode
    showWindowInKeyboardMode()
  }
}

// Settings interface
interface AppSettings {
  orgDirectories: string[]
  theme: 'light' | 'dark' | 'system'
  autoStart: boolean
  hotkeys: {
    toggle: string
    capture: string
  }
  version: number
}

// Initialize electron-store for persistent settings (using dynamic import for ESM compatibility)
let settingsStore: any = null
let pinOrderStore: any = null

async function initializeSettingsStore() {
  try {
    const Store = (await import('electron-store')).default
    settingsStore = new Store<AppSettings>({
      name: 'settings',
      defaults: {
        orgDirectories: [],
        theme: 'system',
        autoStart: false,
        hotkeys: {
          toggle: 'CommandOrControl+Shift+E',
          capture: 'CommandOrControl+Shift+E'
        },
        version: 1
      }
    })

    // Initialize pin ordering store
    pinOrderStore = new Store({
      name: 'pin-order',
      defaults: {
        order: [] as string[]
      }
    })

    console.log('✅ Settings store initialized')
    console.log('📁 Settings file location:', (settingsStore as any).path)
    console.log('✅ Pin order store initialized')
    console.log('📁 Pin order file location:', (pinOrderStore as any).path)
    return settingsStore
  } catch (error) {
    console.error('❌ Failed to initialize settings store:', error)
    throw error
  }
}

// Settings service functions
function getSettings(): AppSettings {
  if (!settingsStore) {
    // Return defaults if store not initialized
    return {
      orgDirectories: [],
      theme: 'system',
      autoStart: false,
      hotkeys: {
        toggle: 'CommandOrControl+Shift+E',
        capture: 'CommandOrControl+Shift+E'
      },
      version: 1
    }
  }

  return {
    orgDirectories: (settingsStore as any).get('orgDirectories'),
    theme: (settingsStore as any).get('theme'),
    autoStart: (settingsStore as any).get('autoStart'),
    hotkeys: (settingsStore as any).get('hotkeys'),
    version: (settingsStore as any).get('version')
  }
}

function updateSettings(newSettings: Partial<AppSettings>): AppSettings {
  if (!settingsStore) {
    console.warn('⚠️ Settings store not initialized, cannot update settings')
    return getSettings()
  }

  // Update individual settings
  Object.entries(newSettings).forEach(([key, value]) => {
    if (value !== undefined) {
      ;(settingsStore as any).set(key, value)
    }
  })

  console.log('💾 Settings updated:', newSettings)
  return getSettings()
}

function resetSettings(): AppSettings {
  if (!settingsStore) {
    console.warn('⚠️ Settings store not initialized, cannot reset settings')
    return getSettings()
  }

  ;(settingsStore as any).clear()
  const defaultSettings = getSettings()
  console.log('🧹 Settings reset to defaults')
  return defaultSettings
}

// Test store for in-memory pin storage during testing
let testPins: Pin[] = []

// Org service for scanning and parsing org files
let orgService: OrgService | null = null
let emacsService: EmacsService | null = null

// Set up IPC handlers for pin operations with org service
function setupOrgIPCHandlers(): void {
  console.log('🔧 Setting up org-based IPC handlers...')

  // Get all pins from org service
  ipcMain.handle(IPC_CHANNELS.GET_PINS, async (): Promise<Pin[]> => {
    if (!orgService) {
      console.log('📋 GET_PINS requested - org service not initialized, returning empty array')
      return []
    }

    // Get pins from org service
    const currentPins = orgService.getCurrentPins()
    console.log(`📋 GET_PINS requested - returning ${currentPins.length} pins from org service`)
    return currentPins
  })

  // Add a new pin (manual capture)
  ipcMain.handle(IPC_CHANNELS.ADD_PIN, async (_event, content: string): Promise<Pin> => {
    console.log('➕ ADD_PIN requested:', content)

    const newPin: Pin = {
      id: `manual-pin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      content: content.trim(),
      timestamp: Date.now(),
      tags: ['manual']
    }

    // For now, just add to test pins array
    testPins.unshift(newPin)
    console.log('✅ Manual pin created and stored:', newPin.id)

    // Notify renderer of updates
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, [...testPins])
    }

    return newPin
  })

  // Remove a pin
  ipcMain.handle(IPC_CHANNELS.REMOVE_PIN, async (_event, id: string): Promise<void> => {
    console.log('🗑️ REMOVE_PIN requested:', id)

    try {
      if (orgService) {
        // Remove pin using org service
        await orgService.removePin(id)
        console.log('✅ Pin removed via org service:', id)
      } else {
        // Fallback: remove from test pins
        const initialLength = testPins.length
        testPins = testPins.filter(pin => pin.id !== id)

        if (testPins.length < initialLength) {
          console.log('✅ Pin removed from test pins:', id)

          // Notify renderer of updates
          if (mainWindow) {
            mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, [...testPins])
          }
        } else {
          console.log('⚠️ Pin not found in test pins:', id)
        }
      }
    } catch (error) {
      console.error('❌ Failed to remove pin:', error)
      throw error
    }
  })

  // Save capture (same as add pin for now) - TEMPORARILY COMMENTED OUT
  // ipcMain.handle('save-capture', async (_event, content: string): Promise<Pin> => {
  //   console.log('💾 SAVE_CAPTURE requested:', content)
  //
  //   const newPin: Pin = {
  //     id: `capture-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  //     content: content.trim(),
  //     timestamp: Date.now(),
  //     tags: ['capture']
  //   }
  //
  //   testPins.unshift(newPin)
  //   console.log('✅ Capture saved and stored:', newPin.id)
  //
  //   // Notify renderer of updates
  //   if (mainWindow) {
  //     mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, [...testPins])
  //   }
  //
  //   return newPin
  // })

  // Refresh pins (trigger org scan)
  ipcMain.handle(IPC_CHANNELS.REFRESH_PINS, async (): Promise<Pin[]> => {
    console.log('🔄 REFRESH_PINS requested - triggering org scan')

    if (orgService) {
      const scanResult = await orgService.triggerScan()
      console.log(`✅ Org scan completed: ${scanResult.pinnedItems} pins found`)

      // Get the actual pins from the org service
      const currentPins = orgService.getCurrentPins()
      console.log(`🔄 Returning ${currentPins.length} pins from org service`)
      return currentPins
    }

    // Fallback to test pins if org service is not available
    console.log('⚠️ Org service not available, returning test pins')
    return [...testPins]
  })

  // Reorder pins
  ipcMain.handle(IPC_CHANNELS.REORDER_PINS, async (_event, pinIds: string[]): Promise<void> => {
    console.log('🔄 REORDER_PINS requested:', pinIds)

    // Save pin order persistently
    if (pinOrderStore) {
      (pinOrderStore as any).set('order', pinIds)
      console.log('💾 Pin order saved to persistent storage')
    }

    if (orgService) {
      // Apply sort order to org service pins
      orgService.reorderPins(pinIds)
      console.log('✅ Pin order updated in org service')

      // Notify renderer of updates with new order
      const currentPins = orgService.getCurrentPins()
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, currentPins)
      }
    } else {
      // Fallback: reorder test pins array
      const pinMap = new Map(testPins.map(pin => [pin.id, pin]))
      const reorderedPins = pinIds.map(id => pinMap.get(id)!).filter(Boolean)
      
      // Update the testPins array with the new order
      testPins.length = 0
      testPins.push(...reorderedPins)
      
      console.log('✅ Test pins reordered')

      // Notify renderer of updates
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, [...testPins])
      }
    }
  })

  // Org directory management
  ipcMain.handle(
    IPC_CHANNELS.SET_ORG_DIRECTORIES,
    async (_event, directories: string[]): Promise<void> => {
      console.log('📁 SET_ORG_DIRECTORIES requested:', directories)

      // Update persistent settings
      updateSettings({ orgDirectories: directories })

      // Update org service
      if (orgService) {
        await orgService.setOrgDirectories(directories)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.GET_ORG_DIRECTORIES, async (): Promise<string[]> => {
    console.log('📁 GET_ORG_DIRECTORIES requested')

    // Get from persistent settings instead of just org service
    const settings = getSettings()
    return settings.orgDirectories
  })

  ipcMain.handle(IPC_CHANNELS.PICK_ORG_DIRECTORY, async (): Promise<string | null> => {
    console.log('📁 PICK_ORG_DIRECTORY requested')

    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Org Directory',
      message: 'Choose a directory to scan for org files',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Select Directory'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Org scan operations
  ipcMain.handle(IPC_CHANNELS.TRIGGER_INCREMENTAL_SCAN, async () => {
    console.log('🔄 TRIGGER_INCREMENTAL_SCAN requested')

    if (orgService) {
      return await orgService.triggerIncrementalScan()
    }

    return {
      totalFiles: 0,
      processedFiles: 0,
      pinnedItems: 0,
      errors: ['Org service not initialized'],
      scanTime: 0
    }
  })

  ipcMain.handle(IPC_CHANNELS.TRIGGER_FULL_SCAN, async () => {
    console.log('🧹 TRIGGER_FULL_SCAN requested')

    if (orgService) {
      return await orgService.triggerFullScan()
    }

    return {
      totalFiles: 0,
      processedFiles: 0,
      pinnedItems: 0,
      errors: ['Org service not initialized'],
      scanTime: 0
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_SCAN_PROGRESS, async () => {
    if (orgService) {
      return orgService.getScanProgress()
    }

    return {
      isScanning: false,
      totalFiles: 0,
      processedFiles: 0,
      currentFile: '',
      isComplete: true
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_SCAN_STATS, async () => {
    if (orgService) {
      return await orgService.getStats()
    }

    return null
  })

  // Settings management
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async (): Promise<AppSettings> => {
    console.log('⚙️ GET_SETTINGS requested')
    return getSettings()
  })

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_SETTINGS,
    async (_event, newSettings: Partial<AppSettings>): Promise<AppSettings> => {
      console.log('⚙️ UPDATE_SETTINGS requested:', newSettings)
      const updatedSettings = updateSettings(newSettings)

      // If org directories were updated, update the org service
      if (newSettings.orgDirectories && orgService) {
        await orgService.setOrgDirectories(newSettings.orgDirectories)
      }

      return updatedSettings
    }
  )

  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async (): Promise<AppSettings> => {
    console.log('🧹 RESET_SETTINGS requested')
    const defaultSettings = resetSettings()

    // Reset org service directories too
    if (orgService) {
      await orgService.setOrgDirectories([])
    }

    return defaultSettings
  })

  // Reset all test data (for test cleanup)
  ipcMain.handle(IPC_CHANNELS.RESET_TEST_DATA, async (): Promise<void> => {
    console.log('🧹 RESET_TEST_DATA requested')

    // Reset pins
    testPins = []
    console.log('✅ Test pins cleared')

    // Notify renderer of all updates
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, [...testPins])
    }

    console.log('✅ All test data reset')
  })

  // Emacs integration - open file in Emacs using emacsclient
  ipcMain.handle(
    IPC_CHANNELS.OPEN_IN_EMACS,
    async (
      _event,
      filePath: string,
      lineNumber?: number
    ): Promise<{ success: boolean; error?: string }> => {
      console.log(
        `📝 OPEN_IN_EMACS requested: ${filePath}${lineNumber ? ` at line ${lineNumber}` : ''}`
      )

      if (!emacsService) {
        emacsService = new EmacsService()
      }

      return await emacsService.openInEmacs(filePath, lineNumber)
    }
  )

  // Window operations
  ipcMain.handle(IPC_CHANNELS.HIDE_WINDOW, async (): Promise<void> => {
    console.log('🪟 HIDE_WINDOW requested')
    hideWindow()
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_WINDOW, async (): Promise<void> => {
    console.log('🪟 SHOW_WINDOW requested')
    showWindowInKeyboardMode()
  })

  ipcMain.handle(IPC_CHANNELS.TOGGLE_WINDOW, async (): Promise<void> => {
    console.log('🪟 TOGGLE_WINDOW requested')
    if (mainWindow?.isVisible()) {
      hideWindow()
    } else {
      showWindowInKeyboardMode()
    }
  })

  console.log('✅ Org-based IPC handlers set up successfully')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Initialize settings store first
  try {
    await initializeSettingsStore()
    console.log('✅ Settings store ready')
  } catch (error) {
    console.error('❌ Failed to initialize settings store, using defaults:', error)
  }

  // In test mode, skip tray behavior and show window directly
  if (isTestMode) {
    console.log('🧪 TEST MODE: Skipping tray setup, showing window directly')

    // Don't set as background agent in test mode
    if (process.platform === 'darwin') {
      app.setActivationPolicy('regular') // Allow normal app behavior
      console.log('✅ Test mode: App set as regular app (not background agent)')
    }
  } else {
    // Normal production behavior: status bar app
    if (process.platform === 'darwin') {
      // Set as background agent app (prevents it from appearing in Cmd+Tab and keeps it in status bar area)
      app.setActivationPolicy('accessory')
      console.log('✅ App set as macOS background agent (status bar only)')

      // Also ensure LSUIElement is respected (should be set in Info.plist or electron-builder config)
      console.log('🔧 Activation policy set to accessory for proper tray behavior')
    }
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Load saved settings
  const savedSettings = getSettings()
  console.log('📋 Loaded saved settings:', {
    orgDirectoriesCount: savedSettings.orgDirectories.length,
    theme: savedSettings.theme,
    autoStart: savedSettings.autoStart
  })

  // Initialize org service with saved directories
  orgService = new OrgService({
    scanIntervalMs: 30000, // 30 seconds
    maxFileSizeMB: 10,
    directories: savedSettings.orgDirectories // Load from persistent settings
  })

  // Set up IPC handlers for pin operations
  setupOrgIPCHandlers() // Use org handlers for both test and production modes

  if (!isTestMode) {
    // Normal mode: Create tray FIRST, then window
    createTray()
    createWindow()

    // Initialize org service with main window and saved directories
    if (orgService && mainWindow) {
      // Create callback to get pin order from persistent storage
      const getPinOrderCallback = () => {
        if (pinOrderStore) {
          return (pinOrderStore as any).get('order') || []
        }
        return []
      }

      orgService
        .initialize(mainWindow, getPinOrderCallback)
        .then(async () => {
          console.log('✅ Org service initialized with main window and pin order callback')

          // Ensure org directories are loaded from settings
          if (savedSettings.orgDirectories.length > 0 && orgService) {
            await orgService.setOrgDirectories(savedSettings.orgDirectories)
            console.log(
              `📁 Loaded ${savedSettings.orgDirectories.length} org directories from settings`
            )
          }
        })
        .catch((error) => {
          console.error('❌ Failed to initialize org service:', error)
        })
    }

    // Register global shortcut for keyboard mode
    const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+E', () => {
      console.log('🔥 Global shortcut triggered!')
      handleKeyboardShortcut()
    })

    if (shortcutRegistered) {
      console.log('✅ Global shortcut registered: Cmd+Shift+E (Mac) / Ctrl+Shift+E (Others)')
    } else {
      console.log('❌ Failed to register global shortcut')
    }

    // Window will only be shown when tray icon is clicked or shortcut is used
    console.log('✅ App ready - window hidden by default, use tray icon or Ctrl+Shift+E to show')
  } else {
    // Test mode: Create window and show it immediately
    createWindow()

    // Initialize org service in test mode too (for persistence testing)
    if (orgService && mainWindow) {
      // Create callback to get pin order from persistent storage
      const getPinOrderCallback = () => {
        if (pinOrderStore) {
          return (pinOrderStore as any).get('order') || []
        }
        return []
      }

      orgService
        .initialize(mainWindow, getPinOrderCallback)
        .then(async () => {
          console.log('🧪 Test mode: Org service initialized with pin order callback')

          // Ensure org directories are loaded from settings
          if (savedSettings.orgDirectories.length > 0 && orgService) {
            await orgService.setOrgDirectories(savedSettings.orgDirectories)
            console.log(
              `🧪 Test mode: Loaded ${savedSettings.orgDirectories.length} org directories from settings`
            )
          }
        })
        .catch((error) => {
          console.error('❌ Test mode: Failed to initialize org service:', error)
        })
    }

    // Show window immediately in test mode
    if (mainWindow) {
      console.log('🧪 Test mode: Showing window immediately')

      // Center the window for testing
      const position = getCenteredWindowPosition()
      console.log(`🧪 Test mode: Setting window position to x=${position.x}, y=${position.y}`)
      mainWindow.setPosition(position.x, position.y, false)
      mainWindow.show()
      mainWindow.focus()
      mainWindow.setAlwaysOnTop(true) // Make sure it's visible in test mode
      windowMode = 'keyboard' // Set to keyboard mode for testing

      console.log(
        '✅ Test mode: Window shown, focused, set to always on top, and ready for testing'
      )
    }
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()

      // In test mode, show the window immediately
      if (isTestMode && mainWindow) {
        const position = getCenteredWindowPosition()
        console.log(
          `🧪 Test mode (activate): Setting window position to x=${position.x}, y=${position.y}`
        )
        mainWindow.setPosition(position.x, position.y, false)
        mainWindow.show()
        mainWindow.focus()
        mainWindow.setAlwaysOnTop(true)
        windowMode = 'keyboard'
        console.log('🧪 Test mode (activate): Window shown and set to always on top')
      }
    }
  })
})

// Don't quit when all windows are closed - keep running in system tray
app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  // The app will be accessible through the tray icon
})

// Handle before-quit to set the quitting flag
app.on('before-quit', async () => {
  isQuitting = true

  // Shutdown org service
  if (orgService) {
    await orgService.shutdown()
  }

  // Unregister global shortcuts
  globalShortcut.unregisterAll()
  console.log('🧹 Global shortcuts unregistered')
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
