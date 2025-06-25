# E2E Testing Setup for Electron + Vite + Playwright

## Overview

This document describes the E2E testing setup for **EspressoBar**, an Electron tray application built with Vite, React, TypeScript, and tested with Playwright.

## Key Innovation: Test Mode

### The Challenge
EspressoBar is a **tray application** that starts with a hidden window. The window only shows when:
- User clicks the tray icon
- User presses the global keyboard shortcut `Ctrl+Shift+E` (or `Cmd+Shift+E` on macOS)

This makes testing difficult because:
1. Tray interactions are hard to simulate in automated tests
2. Global keyboard shortcuts may not work reliably in test environments
3. The window positioning depends on tray icon location

### The Solution: `--test-mode` Flag

We implemented a **test mode** that bypasses the tray behavior entirely:

```typescript
// In main process (src/main/index.ts)
const isTestMode = process.argv.includes('--test-mode')

if (isTestMode) {
  // Skip tray setup, show window immediately
  console.log('🧪 TEST MODE: Skipping tray setup, showing window directly')
  createWindow()
  
  // Show window immediately when ready
  if (mainWindow) {
    const position = getCenteredWindowPosition()
    mainWindow.setPosition(position.x, position.y, false)
    mainWindow.show()
    mainWindow.focus()
    windowMode = 'keyboard'
  }
} else {
  // Normal tray behavior
  createTray()
  createWindow()
  // Window stays hidden until tray interaction
}
```

### Test Mode Benefits

1. **Immediate Window Visibility**: Window shows automatically
2. **No Tray Dependencies**: Tests don't need to interact with system tray
3. **Reliable Positioning**: Window is centered on screen
4. **Normal App Behavior**: All other functionality works exactly the same
5. **Easy Debugging**: Window appears in taskbar, can be resized

## CI/Headless Mode

### Environment Detection

The tests automatically detect CI environments and apply appropriate headless configurations:

```typescript
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

electronApp = await electron.launch({
  args: [...baseArgs, ...ciArgs],
  timeout: 15000
})
```

### Environment Behaviors

- **Local Development** (`CI` not set): Runs in headful mode, window visible for debugging
- **CI Environment** (`CI=true`): Runs in headless mode with necessary flags for Ubuntu runners

### GitHub Actions Setup

The CI workflow includes headless display setup for Electron:

```yaml
- name: Setup headless display for Electron
  uses: pyvista/setup-headless-display-action@v3

- name: Run E2E tests
  run: npm run test:e2e
  env:
    DISPLAY: :99.0
```

### Benefits

1. **Flexible Testing**: Headful locally, headless in CI
2. **Debug-Friendly**: See actual windows during local development
3. **CI-Optimized**: Proper headless flags for reliable CI execution
4. **Automatic Detection**: No manual configuration needed

## Test Setup

### Launching in Test Mode

```typescript
electronApp = await electron.launch({
  args: [
    path.join(process.cwd(), 'out', 'main', 'index.js'),
    '--test-mode' // This flag enables test mode
  ],
  timeout: 30000,
})
```

### Test Flow

1. **Launch**: App starts with `--test-mode` flag
2. **Window Creation**: Window is created and shown immediately
3. **React Loading**: Wait for React app to initialize
4. **Test Execution**: Run normal UI tests
5. **Cleanup**: Close app when tests complete

## Test Structure

### Test Categories

1. **Window Visibility Tests**
   ```typescript
   test('should load and show the app window', async () => {
     expect(await page.isVisible('body')).toBe(true)
     await expect(page.locator('#root')).toBeVisible()
   })
   ```

2. **Initial State Tests**
   ```typescript
   test('should show demo pins or empty state', async () => {
     const pinElements = await page.locator('[data-testid="pin-item"]').count()
     // Handle both empty state and demo pins scenarios
   })
   ```

3. **CRUD Operations**
   ```typescript
   test('should be able to add a pin', async () => {
     // Test pin creation via capture modal
   })
   
   test('should be able to delete a pin', async () => {
     // Test pin deletion with hover buttons
   })
   ```

4. **UI Interactions**
   ```typescript
   test('should handle keyboard shortcuts', async () => {
     // Test Escape and Ctrl/Cmd+Enter shortcuts
   })
   ```

5. **Integration Testing**
   - `tests/test-emacs-integration.js` - Manual emacsclient integration test script
   - Tests emacsclient availability, Emacs server status, and file opening functionality
   - Run with: `node tests/test-emacs-integration.js`

## Configuration

### playwright.config.ts
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})
```

### package.json Scripts
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

## Running Tests

### Prerequisites
1. **Build the app**: `npx electron-vite build`
2. **Install Playwright**: `npm install @playwright/test`

### Commands
```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run with debugging
npm run test:e2e:debug

# Run specific test
npx playwright test crud-operations
```

## Test Mode Implementation Details

### Main Process Changes

1. **Command Line Detection**
   ```typescript
   const isTestMode = process.argv.includes('--test-mode')
   ```

2. **Window Configuration**
   ```typescript
   skipTaskbar: !isTestMode, // Show in taskbar for debugging
   resizable: is.dev || isTestMode, // Allow resizing in test mode
   ```

3. **Activation Policy** (macOS)
   ```typescript
   if (isTestMode) {
     app.setActivationPolicy('regular') // Normal app behavior
   } else {
     app.setActivationPolicy('accessory') // Background agent
   }
   ```

4. **Window Show Logic**
   ```typescript
   mainWindow.on('ready-to-show', () => {
     if (isTestMode) {
       // Show immediately in test mode
       mainWindow?.show()
       mainWindow?.focus()
     }
     // Stay hidden in normal mode
   })
   ```

### No Changes Required For
- **Renderer Process**: React app works exactly the same
- **IPC Communication**: All channels work normally
- **Storage**: electron-store functions identically
- **UI Components**: No test-specific modifications needed

## Best Practices

### 1. **Robust Element Selection**
```typescript
// Handle different UI states
const addButton = page.locator('button:has-text("+ Quick note")')
const emptyAddButton = page.locator('[data-testid="empty-popup"] button:has-text("+ Quick note")')

if (await addButton.isVisible({ timeout: 2000 })) {
  await addButton.click()
} else if (await emptyAddButton.isVisible({ timeout: 2000 })) {
  await emptyAddButton.click()
}
```

### 2. **Storage Cleanup**
```typescript
// Clean storage before each test run
const storageDir = path.join(os.homedir(), '.config', 'EspressoBar')
const storagePath = path.join(storageDir, 'pinned.json')
if (fs.existsSync(storagePath)) {
  fs.unlinkSync(storagePath)
}
```

### 3. **Cross-Platform Compatibility**
```typescript
// Platform-specific keyboard shortcuts
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
await page.keyboard.press(`${modifier}+Enter`)
```

### 4. **Error Debugging**
```typescript
if (!hasReactContent) {
  await page.screenshot({ path: 'debug-no-react.png' })
  const content = await page.content()
  console.log('📄 Page content:', content.substring(0, 500))
}
```

## Troubleshooting

### Common Issues

1. **"App doesn't start in test mode"**
   - Ensure `--test-mode` flag is passed correctly
   - Check console output for test mode confirmation
   - Verify the built files exist in `out/main/index.js`

2. **"Window not visible"**
   - Confirm test mode is active (check logs)
   - Verify `skipTaskbar: !isTestMode` setting
   - Check if window is created but positioned off-screen

3. **"React app not loading"**
   - Wait for `networkidle` state
   - Check for JavaScript errors in console
   - Verify IPC communication is working

4. **"Tests are flaky"**
   - Increase timeouts for slow systems
   - Add more granular waits
   - Use `data-testid` attributes consistently

### Debug Commands
```bash
# Take screenshot during test
await page.screenshot({ path: 'debug-state.png' })

# Check element existence
const exists = await page.locator('[data-testid="pin-item"]').count()
console.log('Pin count:', exists)

# Verify test mode is active
await electronApp.evaluate(() => process.argv.includes('--test-mode'))
```

## Manual Testing

You can also manually test the app in test mode:

```bash
# Build the app
npx electron-vite build

# Run in test mode
npx electron out/main/index.js --test-mode
```

This will show the window immediately without requiring tray interaction.

## Production vs Test Mode

| Feature | Production Mode | Test Mode |
|---------|----------------|-----------|
| Window Visibility | Hidden by default | Shown immediately |
| Tray Icon | Created and functional | Skipped entirely |
| Global Shortcuts | Registered and active | Skipped |
| Taskbar | Hidden (`skipTaskbar: true`) | Visible (`skipTaskbar: false`) |
| Activation Policy (macOS) | `accessory` | `regular` |
| Window Resizing | Dev mode only | Enabled |

## Architecture Benefits

1. **Separation of Concerns**: Test mode is cleanly separated from production logic
2. **Zero Impact**: Production behavior is completely unchanged
3. **Maintainability**: Test mode logic is minimal and easy to understand
4. **Reliability**: Tests don't depend on system-level interactions
5. **Debugging**: Test mode makes development and debugging easier

## References

- [Playwright Electron Documentation](https://playwright.dev/docs/api/class-electronapplication)
- [Electron Testing Best Practices](https://www.electronjs.org/docs/latest/tutorial/testing)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

## Contributing

When adding new tests:

1. **Use `data-testid` attributes** for reliable element selection
2. **Handle multiple UI states** (empty state vs. populated state)
3. **Add proper waits** instead of fixed timeouts
4. **Test cross-platform** compatibility
5. **Clean up** between tests to ensure isolation 
