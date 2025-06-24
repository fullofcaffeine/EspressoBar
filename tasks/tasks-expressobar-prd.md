## Relevant Files

- `src/main/index.ts` - Main Electron process entry point, tray setup, IPC handlers, and persistent pin storage with electron-store
- `src/main/index.test.ts` - Unit tests for main process
- `src/preload/index.ts` - Secure IPC bridge between main and renderer processes with contextBridge API
- `src/preload/index.test.ts` - Unit tests for preload script
- `src/renderer/components/TrayPopup.tsx` - Main popup component showing pinned items
- `src/renderer/components/TrayPopup.test.tsx` - Unit tests for TrayPopup component
- `src/renderer/components/CaptureModal.tsx` - Modal for capturing new items
- `src/renderer/components/CaptureModal.test.tsx` - Unit tests for CaptureModal component
- `src/renderer/components/Preferences.tsx` - Settings/preferences interface
- `src/renderer/components/Preferences.test.tsx` - Unit tests for Preferences component
- `src/renderer/components/EmptyPopup.tsx` - Empty state when no pins exist
- `src/renderer/components/EmptyPopup.test.tsx` - Unit tests for EmptyPopup component
- `src/renderer/components/PinDetailModal.tsx` - Rich detail view modal for individual pins with timestamps, content, and Emacs integration
- `src/renderer/stores/pinStore.ts` - Zustand store for managing pin state with CRUD operations and IPC communication
- `src/renderer/src/App.tsx` - Main app component integrated with pin store, loading states, and error handling
- `src/renderer/stores/pinStore.test.ts` - Unit tests for pin store
- `src/main/services/fileWatcher.ts` - Chokidar-based file watching service
- `src/main/services/fileWatcher.test.ts` - Unit tests for file watcher
- `src/main/services/orgParser.ts` - Service for parsing org-mode files and extracting pins
- `src/main/services/orgParser.test.ts` - Unit tests for org parser
- `src/main/services/orgScanner.ts` - Background service for recursive org file scanning and efficient incremental parsing
- `src/main/services/orgScanner.test.ts` - Unit tests for org scanner service
- `src/main/services/fileCache.ts` - File modification tracking and caching service for efficient parsing
- `src/main/services/fileCache.test.ts` - Unit tests for file cache service
- `src/main/services/emacsService.ts` - Cross-platform emacsclient integration service for "Open in Emacs" functionality
- `src/shared/types.ts` - Shared TypeScript interfaces and types
- `package.json` - Dependencies and build configuration
- `tsconfig.node.json` - TypeScript configuration for main/preload processes (updated to include shared types)
- `electron-builder.config.js` - Packaging configuration for distribution
- `tests/e2e/pin-detail-view.spec.ts` - E2E tests for pin detail modal functionality and Emacs integration
- `tests/e2e/settings-persistence.spec.ts` - E2E tests for settings persistence functionality
- `tests/test-emacs-integration.js` - Manual integration test script for emacsclient setup validation

### Notes

- Unit tests should typically be placed alongside the code files they are testing
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration
- The project uses Electron Vite template as the foundation
- IPC communication must be secure using preload.ts and contextBridge
- Integration test script available at `tests/test-emacs-integration.js` for emacsclient setup validation

## Tasks

  - [x] 1.0 Project Setup & Foundation
  - [x] 1.1 Clone electron-vite template: `git clone https://github.com/alex8088/electron-vite.git espressobar`
  - [x] 1.2 Initialize project: `cd espressobar && npm install`
  - [x] 1.3 Verify basic setup works: `npm run dev` and check Electron app launches
  - [x] 1.4 Install additional dependencies: `npm install tailwindcss @tailwindcss/forms zustand chokidar electron-store @sentry/electron`
  - [x] 1.5 Configure Tailwind CSS in `tailwind.config.js` and add to main CSS file
  - [x] 1.6 Set up basic tray icon functionality in `src/main/index.ts`
  - [x] 1.7 Configure window to hide instead of close and show on tray click
  - [x] 1.8 Test tray icon appears and clicking shows/hides window

- [x] 2.0 Core UI Components & Static Interface  
  - [x] 2.1 Create `src/shared/types.ts` with Pin interface and other shared types
  - [x] 2.2 Implement `src/renderer/components/TrayPopup.tsx` using provided HTML mockup
  - [x] 2.3 Implement `src/renderer/components/EmptyPopup.tsx` for zero-state
  - [x] 2.4 Implement `src/renderer/components/CaptureModal.tsx` with form handling
  - [x] 2.5 Create basic `src/renderer/components/Preferences.tsx` with tab navigation
  - [x] 2.6 Install and configure React Router: `npm install react-router-dom`
  - [x] 2.7 Set up routing between popup and preferences views
  - [x] 2.8 Add dark/light theme support using Tailwind dark mode classes
  - [x] 2.9 Test all components render correctly with mock data

- [ ] 3.0 Data Management & IPC Communication
  - [x] 3.1 Create `src/renderer/stores/pinStore.ts` using Zustand with pin CRUD operations
  - [x] 3.2 Implement secure `src/preload/index.ts` with contextBridge API exposure
  - [x] 3.3 Add IPC handlers in main process for: `getPins()`, `addPin()`, `removePin()`, `saveCapture()`
  - [x] 3.4 Create `~/.pinned.json` file management in main process using electron-store
  - [x] 3.5 Implement pin data serialization/deserialization with proper timestamps
  - [x] 3.6 Connect TrayPopup component to pin store and display real pin data
  - [x] 3.7 Wire up CaptureModal to save new pins via IPC
  - [x] 3.8 Add pin removal functionality with hover delete button
  - [x] 3.9 Test all CRUD operations work end-to-end

- [ ] 4.0 Org File Processing & Background Scanning
  - [x] 4.1 Create `src/main/services/fileCache.ts` for tracking file modification times and parsed content cache
  - [x] 4.2 Implement `src/main/services/orgScanner.ts` for recursive org file discovery in specified directories
  - [x] 4.3 Add efficient incremental parsing logic - only parse files modified since last scan
  - [x] 4.4 Implement org-mode headline parsing to detect `:pinned:` or `:PINNED:` properties in any headline (not just TODO)
  - [x] 4.5 Create background periodic job (every 30 seconds) for scanning org directories non-blocking
  - [x] 4.6 Add file date extraction and ordering logic - order pins by org file modification date DESC
  - [x] 4.7 Implement `src/main/services/orgParser.ts` to extract pinned headlines with file context (filename, line number, heading text)
  - [x] 4.8 Create IPC handlers for org directory management: `setOrgDirectories()`, `getOrgDirectories()`, `refreshOrgFiles()`
  - [x] 4.8.1 Add PICK_ORG_DIRECTORY IPC channel for directory selection dialog
  - [x] 4.8.2 Implement directory picker using Electron's showOpenDialog
  - [x] 4.9 Connect org scanner to pin store - replace manual JSON pins with org-sourced pins
  - [x] 4.10 Add progress tracking for org scanning process with IPC events to show progress bar in UI
  - [x] 4.11 Implement error handling for org file parsing (malformed files, permission issues, etc.)
  - [x] 4.11.1 Add force-retrigger scan functionality in preferences pane
  - [x] 4.11.2 Implement incremental scan (only modified files since last scan)
  - [x] 4.11.3 Implement full clean scan (all files, ignoring cache)
  - [x] 4.11.4 Add scan controls UI in preferences with status display
  - [x] 4.11.5 Create comprehensive E2E tests for org scan operations
  - [x] 4.11.5.1 Fix E2E tests to follow proper user simulation patterns ✅ COMPLETED
  - [x] 4.11.5.2 Fix empty pinned items bug where scan works but UI doesn't update ✅ COMPLETED
  - [x] 4.11.5.3 Convert API-focused tests to user workflow simulation ✅ COMPLETED
  - [x] 4.11.5.4 Update E2E workflow rules to enforce user simulation only ✅ COMPLETED
  - [x] 4.11.6 Add proper TypeScript types for scan operations and results
  - [x] 4.11.7 Fix E2E test regression: empty pinned items after scan ✅ COMPLETED
  - [ ] 4.11.8 Clean up remaining API-focused tests that don't reflect user experience
  - [ ] 4.12 Test recursive scanning works with nested org file directories  
  - [ ] 4.13 Verify efficient incremental parsing - only modified files are re-parsed on subsequent scans

- [x] 4.5 Manual Scan Controls & Force Retrigger (✅ COMPLETED)
  - [x] 4.5.1 Enhance OrgService with triggerIncrementalScan() and triggerFullScan() methods
  - [x] 4.5.2 Add scan type parameter to performScan() method for force scanning
  - [x] 4.5.3 Implement cache clearing for full clean scans
  - [x] 4.5.4 Add new IPC channels: TRIGGER_INCREMENTAL_SCAN, TRIGGER_FULL_SCAN, GET_SCAN_PROGRESS, GET_SCAN_STATS
  - [x] 4.5.5 Update preload script to expose scan methods to renderer
  - [x] 4.5.6 Create proper TypeScript interfaces for ScanResult and ScanProgress
  - [x] 4.5.7 Add scan control UI in preferences with Quick Scan and Full Scan buttons
  - [x] 4.5.8 Implement scan status display with progress indicators and results
  - [x] 4.5.9 Add button states (enabled/disabled) based on org directory configuration
  - [x] 4.5.10 Create comprehensive E2E test suite for scan operations
  - [x] 4.5.11 Fix TypeScript global interface declarations for electronAPI
  - [x] 4.5.12 Test preferences navigation and scan control functionality

- [ ] 5.0 File Watching & Live Updates (Legacy - Consider Deprecating)
  - [ ] 5.1 Create `src/main/services/fileWatcher.ts` using chokidar (if real-time updates needed)
  - [ ] 5.2 Set up file watching for user-specified org files (from preferences)
  - [ ] 5.3 Implement debounced file change handler (300ms delay) to trigger org scanner refresh
  - [ ] 5.4 Connect file changes to pin store updates via IPC events
  - [ ] 5.5 Add automatic pin refresh when org files are modified
  - [ ] 5.6 Implement org capture format: append new pins to specified inbox file
  - [ ] 5.7 Test file watching works with real org files and updates UI in real-time

- [ ] 6.0 Packaging, Preferences & Polish
  - [ ] 6.1 Configure `electron-builder.config.js` for macOS (.dmg) and Linux (.deb) packaging
  - [x] 6.2 Implement full Preferences interface with "Org Files", "Hotkeys", and "Advanced" tabs
  - [x] 6.2.1 Add scan control buttons (Quick Scan/Full Scan) to Org Files tab
  - [x] 6.2.2 Add scan status display with progress indicators and results
  - [x] 6.3 Add file picker for adding/removing watched org files in preferences
  - [x] 6.3.1 Add back navigation from preferences to main pinned items screen
  - [ ] 6.4 Implement global hotkey registration (default Alt+Space) using Electron's globalShortcut
  - [ ] 6.5 Add hotkey customization in preferences with conflict detection
  - [ ] 6.6 Implement auto-start toggle functionality using electron's app.setLoginItemSettings
  - [ ] 6.7 Set up Sentry error reporting for both main and renderer processes
  - [ ] 6.8 Add window positioning logic to center popup on screen
  - [ ] 6.9 Implement proper window focus management and blur-to-hide behavior
  - [ ] 6.10 Test packaging: `npm run build` and verify .dmg/.deb files work correctly
  - [ ] 6.11 Set up code signing for macOS distribution (if certificates available)
  - [ ] 6.12 Verify all success metrics: <200ms popup latency, <150ms capture latency, ≤120MB RAM usage 

## Recent Changes (Version 1.0 - Org-Only Focus)

### User Experience Changes ✅ COMPLETED
- **Removed Quick Note Functionality**: Removed + Quick note button and capture modal - focusing purely on org file-based pins
- **Updated Click Behavior**: 
  - Single click on pin → Opens in Emacs (if filePath available)
  - Command/Ctrl+click on pin → Opens detail view modal
- **Added ESC Key Support**: ESC key now closes the window regardless of how it was opened (tray or keyboard shortcut)
- **Updated Empty State**: Now directs users to "Setup Org Directories" instead of adding quick notes

### Technical Implementation ✅ COMPLETED
- Updated `TrayPopup.tsx` to remove quick note button and implement new click behavior
- Updated `EmptyPopup.tsx` to focus on org directory setup instead of quick capture
- Updated `App.tsx` to remove capture modal functionality and add ESC key handling
- Added IPC handlers for window operations (hide/show/toggle)
- Updated shared types to remove `onAddPin` properties
- Updated all E2E tests to work with new behavior and org-file-only approach

### Test Updates ✅ COMPLETED
- Modified CRUD operations tests to work with org-file-only approach
- Updated pin detail view tests to use command-click for detail view
- Added test for single-click behavior (should not open detail view)
- Added test for ESC key functionality
- Updated empty state tests to check for "Setup Org Directories" button

## Current Development Phase: 4. Testing & Reliability

## 7.0 GitHub Repository Setup & CI/CD ✅ IN PROGRESS
- [x] 7.1 Create GitHub Actions CI/CD workflow for automated testing and building
- [x] 7.2 Configure multi-platform builds (macOS, Windows, Linux) with matrix strategy
- [x] 7.3 Set up test automation with Playwright browser installation
- [x] 7.4 Configure artifact uploading for build outputs
- [x] 7.5 Set up automatic release binary distribution
- [x] 7.6 Update .gitignore for comprehensive Node.js/Electron patterns
- [x] 7.6.1 Fix ESLint configuration and missing dependencies for CI compatibility
- [ ] 7.7 Create GitHub repository with proper settings
- [ ] 7.8 Push initial codebase and verify CI/CD pipeline works
- [ ] 7.9 Test release workflow with a tagged release
- [ ] 7.10 Update package.json repository URLs with actual GitHub repository

## 4.11 E2E Test Suite ✅ COMPLETED

### 4.11.5 E2E Test Framework Improvements 
- 4.11.5.1 Fix E2E tests to follow proper user simulation patterns ✅ COMPLETED 
- 4.11.5.2 Fix empty pinned items bug where scan works but UI doesn't update ✅ COMPLETED
- 4.11.5.3 Convert API-focused tests to user workflow simulation ✅ COMPLETED  
- 4.11.5.4 Update E2E workflow rules to enforce user simulation only ✅ COMPLETED

### 4.11.6 Test Execution & Stability ✅ COMPLETED
- 4.11.6.1 Fix broken navigation helpers in tests ✅ COMPLETED
- 4.11.6.2 Ensure proper test state management and directory configuration ✅ COMPLETED
- 4.11.6.3 Create missing test files and directories ✅ COMPLETED
- 4.11.6.4 Make entire E2E suite GREEN (20/20 tests passing) ✅ COMPLETED

### 4.11.7 Specific Bug Fixes
- Fix E2E test regression: empty pinned items after scan ✅ COMPLETED

## Test Suite Status: 🟢 ALL GREEN! 
**Current Status: 20/20 tests passing (100% success rate)**

### Working Test Categories:
1. **CRUD Operations (5/5 passing)**:
   - App window loads ✅
   - Initial state display ✅  
   - Add pins ✅
   - Delete pins ✅
   - Keyboard shortcuts ✅

2. **Org Scan Operations (15/15 passing)**:
   - Access preferences ✅
   - Scan controls visibility ✅
   - Directory configuration ✅
   - Incremental scan ✅
   - Full scan ✅
   - Scan progress/results ✅
   - File error handling ✅
   - Complete workflow tests ✅
   - User simulation tests ✅
   - Regression tests ✅

### Key Achievements:
- ✅ Fixed broken navigation helpers
- ✅ Created missing test.org file with proper pinned content
- ✅ Converted API-focused tests to proper user simulation
- ✅ Fixed directory configuration timing issues
- ✅ Updated E2E workflow rules to enforce user simulation patterns
- ✅ All critical user workflows now validated

**The original "empty pinned items" bug is completely resolved and all tests validate the fix works correctly.**

## 5.0 Settings Persistence & Configuration Management ✅ COMPLETED

### 5.1 Core Settings Infrastructure ✅ COMPLETED
- [x] 5.1.1 Enable electron-store for persistent settings storage
- [x] 5.1.2 Create AppSettings interface with org directories, theme, autoStart, and hotkeys
- [x] 5.1.3 Implement settings service with getSettings(), updateSettings(), and resetSettings()
- [x] 5.1.4 Add settings IPC handlers: GET_SETTINGS, UPDATE_SETTINGS, RESET_SETTINGS
- [x] 5.1.5 Update preload script to expose settings API to renderer
- [x] 5.1.6 Create settings.json storage in ~/.config/EspressoBar/

### 5.2 OrgService Integration ✅ COMPLETED  
- [x] 5.2.1 Update OrgService to load org directories from persistent settings on app startup
- [x] 5.2.2 Integrate legacy getOrgDirectories/setOrgDirectories APIs with new settings system
- [x] 5.2.3 Ensure org directory changes automatically persist across app restarts
- [x] 5.2.4 Fix electron-store ESM compatibility issues with dynamic import

### 5.3 Comprehensive E2E Testing ✅ COMPLETED
- [x] 5.3.1 Create settings-persistence.spec.ts test suite
- [x] 5.3.2 Test org directory persistence across app restarts
- [x] 5.3.3 Test multiple org directories persistence and modification
- [x] 5.3.4 Test theme and hotkey settings persistence
- [x] 5.3.5 Ensure all 23 E2E tests pass (CRUD + Org Scan + Settings Persistence)

**Settings persistence is now fully functional and thoroughly tested. Users can configure org directories in preferences, and they will persist across app restarts. The implementation uses electron-store for reliable cross-platform settings storage.**

## 6.0 Emacs Integration & Open in Emacs Feature ✅ COMPLETED

### 6.1 emacsclient-based Integration ✅ COMPLETED
- [x] 6.1.1 Create EmacsService for cross-platform emacsclient detection and execution
- [x] 6.1.2 Implement OPEN_IN_EMACS IPC channel with error handling
- [x] 6.1.3 Add emacsclient path detection for macOS, Linux, and Windows
- [x] 6.1.4 Create fallback elisp code generation for when emacsclient fails
- [x] 6.1.5 Update PinDetailModal to use emacsclient instead of org-protocol
- [x] 6.1.6 Add proper error handling and user feedback for integration issues

### 6.2 Integration Testing & Documentation ✅ COMPLETED
- [x] 6.2.1 Create comprehensive integration test script at `tests/test-emacs-integration.js`
- [x] 6.2.2 Test emacsclient availability detection across platforms
- [x] 6.2.3 Test Emacs server connectivity and file opening functionality
- [x] 6.2.4 Update documentation with new emacsclient approach vs org-protocol
- [x] 6.2.5 Create setup guides and troubleshooting documentation
- [x] 6.2.6 Add testing tools section with integration test usage instructions

### 6.3 Implementation Details ✅ COMPLETED
- [x] 6.3.1 EmacsService with platform-specific binary detection
- [x] 6.3.2 Non-blocking file opening with `--no-wait` flag
- [x] 6.3.3 Line number positioning using `+LINE:COLUMN` format
- [x] 6.3.4 Server status checking with `--eval` commands
- [x] 6.3.5 Comprehensive error handling with fallback mechanisms
- [x] 6.3.6 Cross-platform compatibility testing

**The emacsclient-based "Open in Emacs" feature is now fully implemented and replaces the previous org-protocol approach for better reliability and easier setup. Users can test their setup using the provided integration test script.**

## 7.0 Pin Detail View & Rich Content Display ✅ COMPLETED

### 7.1 Pin Detail Modal Implementation ✅ COMPLETED
- [x] 7.1.1 Create PinDetailModal component with modern UI following existing design patterns
- [x] 7.1.2 Implement responsive modal with overflow handling for long content
- [x] 7.1.3 Display pin content (title + detailed content extracted from org files)
- [x] 7.1.4 Show timestamps with proper icons and formatting for different timestamp types
- [x] 7.1.5 Display tags with consistent styling matching existing components
- [x] 7.1.6 Show file information (path and line number) with proper formatting
- [x] 7.1.7 Add "Open in Emacs" button integration with emacsclient service
- [x] 7.1.8 Implement close functionality with proper state management

### 7.2 Enhanced Org Parser for Rich Content ✅ COMPLETED
- [x] 7.2.1 Add comprehensive timestamp parsing functionality supporting:
  - Active timestamps: `<2024-01-15 Mon>` or `<2024-01-15 Mon 10:30>`
  - Inactive timestamps: `[2024-01-15 Mon]`
  - Scheduled: `SCHEDULED: <timestamp>`
  - Deadline: `DEADLINE: <timestamp>`
  - Date ranges: `<date1>--<date2>`
  - Time ranges: `<date 10:00-12:00>`
- [x] 7.2.2 Extract detailed content (everything below headline until next headline)
- [x] 7.2.3 Exclude property drawers from content while preserving formatting
- [x] 7.2.4 Enhanced OrgHeadline interface with detailedContent and orgTimestamps
- [x] 7.2.5 Update convertToPins to include file metadata (filePath, lineNumber)

### 7.3 Type System Extensions ✅ COMPLETED
- [x] 7.3.1 Add OrgTimestamp interface with type, date, time, and isActive fields
- [x] 7.3.2 Extend Pin interface with:
  - `detailedContent?: string` for rich content below headlines
  - `orgTimestamps?: OrgTimestamp[]` for parsed timestamp data
  - `filePath?: string` for emacs integration
  - `lineNumber?: number` for precise file positioning
- [x] 7.3.3 Update TrayPopupProps to include onPinClick handler for modal opening

### 7.4 App Integration & State Management ✅ COMPLETED
- [x] 7.4.1 Update TrayPopup component to use onPinClick handler
- [x] 7.4.2 Integrate PinDetailModal in main App component
- [x] 7.4.3 Add state management for selected pin and modal visibility
- [x] 7.4.4 Connect modal close handlers and escape key functionality
- [x] 7.4.5 Ensure proper data flow from org files to detail display

### 7.5 Comprehensive E2E Testing ✅ COMPLETED
- [x] 7.5.1 Create pin-detail-view.spec.ts with complete user workflow tests
- [x] 7.5.2 Test opening detail view on pin click with proper modal display
- [x] 7.5.3 Validate content display including timestamps, tags, and file info
- [x] 7.5.4 Test close functionality via button click and escape key
- [x] 7.5.5 Verify "Open in Emacs" button visibility and functionality
- [x] 7.5.6 Test graceful handling of minimal content and missing metadata

### 7.6 Test Data & Documentation ✅ COMPLETED
- [x] 7.6.1 Create detailed-test.org with comprehensive test cases
- [x] 7.6.2 Include multiple timestamp types in test data
- [x] 7.6.3 Add detailed content with multiple paragraphs and formatting
- [x] 7.6.4 Test property drawers, tagged/untagged items, pinned/non-pinned items
- [x] 7.6.5 Document implementation details and user experience flow

**Pin detail view implementation provides rich content display with comprehensive org-mode timestamp support and seamless Emacs integration. The feature includes extensive E2E testing and handles all edge cases gracefully.**
