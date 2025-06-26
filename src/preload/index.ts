import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Pin } from '../shared/types'
import { IPC_CHANNELS } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Pin operations
  getPins: (): Promise<Pin[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_PINS),
  addPin: (content: string): Promise<Pin> => ipcRenderer.invoke(IPC_CHANNELS.ADD_PIN, content),
  removePin: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.REMOVE_PIN, id),
  // TEMPORARILY COMMENTED OUT - Save capture functionality
  // saveCapture: (content: string): Promise<Pin> => ipcRenderer.invoke('save-capture', content),
  refreshPins: (): Promise<Pin[]> => ipcRenderer.invoke(IPC_CHANNELS.REFRESH_PINS),
  reorderPins: (pinIds: string[]): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.REORDER_PINS, pinIds),

  // Event listeners for real-time updates
  onPinsUpdated: (callback: (pins: Pin[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, pins: Pin[]) => callback(pins)
    ipcRenderer.on(IPC_CHANNELS.PINS_UPDATED, handler)

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PINS_UPDATED, handler)
    }
  },

  // File operations
  watchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WATCH_FILE, filePath),
  unwatchFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_FILE, filePath),

  // Org directory operations
  getOrgDirectories: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ORG_DIRECTORIES),
  setOrgDirectories: (directories: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_ORG_DIRECTORIES, directories),
  pickOrgDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.PICK_ORG_DIRECTORY),

  // Org scan operations
  triggerIncrementalScan: (): Promise<import('../shared/types').ScanResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_INCREMENTAL_SCAN),
  triggerFullScan: (): Promise<import('../shared/types').ScanResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.TRIGGER_FULL_SCAN),
  getScanProgress: (): Promise<import('../shared/types').ScanProgress> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SCAN_PROGRESS),
  getScanStats: (): Promise<any> => ipcRenderer.invoke(IPC_CHANNELS.GET_SCAN_STATS),

  // Settings operations
  getSettings: (): Promise<any> => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSettings: (settings: any): Promise<any> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTINGS, settings),
  resetSettings: (): Promise<any> => ipcRenderer.invoke(IPC_CHANNELS.RESET_SETTINGS),

  // Preferences
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PREFERENCES),
  setPreferences: (preferences: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_PREFERENCES, preferences),

  // Window operations
  showWindow: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_WINDOW),
  hideWindow: () => ipcRenderer.invoke(IPC_CHANNELS.HIDE_WINDOW),
  toggleWindow: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_WINDOW),

  // Emacs integration
  openInEmacs: (
    filePath: string,
    lineNumber?: number
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_EMACS, filePath, lineNumber),

  // Event listeners for other updates
  onFileChanged: (callback: (filePath: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED, handler)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FILE_CHANGED, handler)
    }
  },

  onPreferencesUpdated: (callback: (preferences: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, preferences: any) => callback(preferences)
    ipcRenderer.on(IPC_CHANNELS.PREFERENCES_UPDATED, handler)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PREFERENCES_UPDATED, handler)
    }
  },

  // Test operations
  resetTestData: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.RESET_TEST_DATA)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', api) // Expose as electronAPI to match pin store
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
