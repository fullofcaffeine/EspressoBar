/**
 * Shared TypeScript interfaces and types for EspressoBar
 * Used across main, preload, and renderer processes
 */

export interface OrgTimestamp {
  type: 'active' | 'inactive' | 'scheduled' | 'deadline' | 'range'
  datetime: string
  originalText: string
  startDate?: Date
  endDate?: Date
}

export interface Pin {
  id: string
  content: string
  sourceFile?: string
  timestamp: number
  orgHeadline?: string
  tags?: string[]
  // Extended for detail view
  detailedContent?: string
  orgTimestamps?: OrgTimestamp[]
  filePath?: string
  lineNumber?: number
  // Pin ordering - lower numbers appear first, undefined uses parsing order
  sortOrder?: number
}

export interface OrgHeadline {
  content: string
  level: number
  properties: Record<string, string>
  tags: string[]
  todo?: string
  lineNumber: number
  sourceFile: string
}

export interface ScanProgress {
  isScanning: boolean
  totalFiles: number
  processedFiles: number
  currentFile: string
  isComplete: boolean
}

export interface ScanResult {
  totalFiles: number
  processedFiles: number
  pinnedItems: number
  errors: string[]
  scanTime: number
}

export interface AppPreferences {
  orgFiles: string[]
  globalHotkey: string
  autoStart: boolean
  theme: 'light' | 'dark' | 'system'
  captureInboxFile?: string
  windowBehavior: {
    hideOnBlur: boolean
    rememberPosition: boolean
  }
}

export interface IPCPayload<T = any> {
  id: string
  data?: T
  error?: string
}

// IPC channel names for type safety
export const IPC_CHANNELS = {
  // Pin operations
  GET_PINS: 'get-pins',
  ADD_PIN: 'add-pin',
  REMOVE_PIN: 'remove-pin',
  // SAVE_CAPTURE: 'save-capture', // TEMPORARILY COMMENTED OUT - Save capture functionality

  // File operations
  REFRESH_PINS: 'refresh-pins',
  WATCH_FILE: 'watch-file',
  UNWATCH_FILE: 'unwatch-file',

  // Org directory operations
  GET_ORG_DIRECTORIES: 'get-org-directories',
  SET_ORG_DIRECTORIES: 'set-org-directories',
  PICK_ORG_DIRECTORY: 'pick-org-directory',

  // Org scan operations
  TRIGGER_INCREMENTAL_SCAN: 'trigger-incremental-scan',
  TRIGGER_FULL_SCAN: 'trigger-full-scan',
  GET_SCAN_PROGRESS: 'get-scan-progress',
  GET_SCAN_STATS: 'get-scan-stats',

  // Pin ordering operations  
  REORDER_PINS: 'reorder-pins',

  // Settings operations
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTINGS: 'update-settings',
  RESET_SETTINGS: 'reset-settings',

  // Preferences
  GET_PREFERENCES: 'get-preferences',
  SET_PREFERENCES: 'set-preferences',

  // Window operations
  SHOW_WINDOW: 'show-window',
  HIDE_WINDOW: 'hide-window',
  TOGGLE_WINDOW: 'toggle-window',

  // Emacs integration
  OPEN_IN_EMACS: 'open-in-emacs',

  // Events (from main to renderer)
  PINS_UPDATED: 'pins-updated',
  FILE_CHANGED: 'file-changed',
  PREFERENCES_UPDATED: 'preferences-updated',

  // Test operations
  RESET_TEST_DATA: 'reset-test-data'
} as const

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// Component props types
export interface TrayPopupProps {
  pins: Pin[]
  onRemovePin: (id: string) => void
  onShowPreferences: () => void
  onPinClick: (pin: Pin) => void
  onReorderPins: (pinIds: string[]) => void
}

// TEMPORARILY COMMENTED OUT - Save capture functionality
// export interface CaptureModalProps {
//   isOpen: boolean
//   onClose: () => void
//   onCapture: (content: string) => Promise<void>
//   defaultDestination?: string
// }

export interface EmptyPopupProps {
  onShowPreferences: () => void
}

// Store types
export interface PinStore {
  pins: Pin[]
  isLoading: boolean
  error: string | null

  // Actions
  loadPins: () => Promise<void>
  addPin: (content: string) => Promise<void>
  // saveCapture: (content: string) => Promise<void> // TEMPORARILY COMMENTED OUT - Save capture functionality
  removePin: (id: string) => Promise<void>
  refreshPins: () => Promise<void>
  reorderPins: (pinIds: string[]) => Promise<void>
  clearError: () => void
}

export interface PreferencesStore {
  preferences: AppPreferences
  isLoading: boolean
  error: string | null

  // Actions
  loadPreferences: () => Promise<void>
  updatePreferences: (preferences: Partial<AppPreferences>) => Promise<void>
  addOrgFile: (filePath: string) => Promise<void>
  removeOrgFile: (filePath: string) => Promise<void>
  clearError: () => void
}

// Electron API interface for renderer process
export interface ElectronAPI {
  // Pin operations
  getPins: () => Promise<Pin[]>
  addPin: (content: string) => Promise<Pin>
  removePin: (id: string) => Promise<void>
  // saveCapture: (content: string) => Promise<Pin> // TEMPORARILY COMMENTED OUT - Save capture functionality
  refreshPins: () => Promise<Pin[]>

  // Event listeners for real-time updates
  onPinsUpdated: (callback: (pins: Pin[]) => void) => () => void

  // File operations
  watchFile: (filePath: string) => Promise<void>
  unwatchFile: (filePath: string) => Promise<void>

  // Org directory operations
  getOrgDirectories: () => Promise<string[]>
  setOrgDirectories: (directories: string[]) => Promise<void>
  pickOrgDirectory: () => Promise<string | null>

  // Org scan operations
  triggerIncrementalScan: () => Promise<ScanResult>
  triggerFullScan: () => Promise<ScanResult>
  getScanProgress: () => Promise<ScanProgress>
  getScanStats: () => Promise<any>

  // Pin ordering operations
  reorderPins: (pinIds: string[]) => Promise<void>

  // Settings operations
  getSettings: () => Promise<any>
  updateSettings: (settings: any) => Promise<void>
  resetSettings: () => Promise<void>

  // Preferences
  getPreferences: () => Promise<any>
  setPreferences: (preferences: any) => Promise<void>

  // Window operations
  showWindow: () => Promise<void>
  hideWindow: () => Promise<void>
  toggleWindow: () => Promise<void>

  // Emacs integration
  openInEmacs: (
    filePath: string,
    lineNumber?: number
  ) => Promise<{ success: boolean; error?: string }>

  // Event listeners for other updates
  onFileChanged: (callback: (filePath: string) => void) => () => void
  onPreferencesUpdated: (callback: (preferences: any) => void) => () => void

  // Test operations
  resetTestData: () => Promise<void>
}

// Global window interface extension
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
