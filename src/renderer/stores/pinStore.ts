import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Pin, PinStore } from '../../shared/types'

export const usePinStore = create<PinStore>()(
  devtools(
    (set) => ({
      pins: [],
      isLoading: false,
      error: null,

      loadPins: async () => {
        try {
          set({ isLoading: true, error: null })

          if (!window.electronAPI) {
            throw new Error('Electron API not available')
          }

          const pins = await window.electronAPI.getPins()
          set({ pins, isLoading: false })
        } catch (error) {
          console.error('Failed to load pins:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to load pins',
            isLoading: false
          })
        }
      },

      addPin: async (content: string) => {
        try {
          set({ error: null })

          if (!window.electronAPI) {
            throw new Error('Electron API not available')
          }

          const newPin = await window.electronAPI.addPin(content)

          // Update local state optimistically
          set((state) => ({
            pins: [newPin, ...state.pins]
          }))
        } catch (error) {
          console.error('Failed to add pin:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to add pin'
          })
          throw error // Re-throw so UI can handle it
        }
      },

      // TEMPORARILY COMMENTED OUT - Save capture functionality
      // saveCapture: async (content: string) => {
      //   try {
      //     set({ error: null })
      //
      //     if (!window.electronAPI) {
      //       throw new Error('Electron API not available')
      //     }

      //     const newPin = await window.electronAPI.saveCapture(content)
      //
      //     // Update local state optimistically
      //     set(state => ({
      //       pins: [newPin, ...state.pins]
      //     }))
      //   } catch (error) {
      //     console.error('Failed to save capture:', error)
      //     set({
      //       error: error instanceof Error ? error.message : 'Failed to save capture'
      //     })
      //     throw error // Re-throw so UI can handle it
      //   }
      // },

      // TEMPORARILY COMMENTED OUT - Remove pin functionality
      // removePin: async (id: string) => {
      //   try {
      //     set({ error: null })
      //
      //     if (!window.electronAPI) {
      //       throw new Error('Electron API not available')
      //     }

      //     await window.electronAPI.removePin(id)
      //
      //     // Update local state optimistically
      //     set(state => ({
      //       pins: state.pins.filter(pin => pin.id !== id)
      //     }))
      //   } catch (error) {
      //     console.error('Failed to remove pin:', error)
      //     set({
      //       error: error instanceof Error ? error.message : 'Failed to remove pin'
      //     })
      //     throw error // Re-throw so UI can handle it
      //   }
      // },

      refreshPins: async () => {
        try {
          set({ error: null })

          if (!window.electronAPI) {
            throw new Error('Electron API not available')
          }

          const pins = await window.electronAPI.refreshPins()
          set({ pins })
        } catch (error) {
          console.error('Failed to refresh pins:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to refresh pins'
          })
        }
      },

      reorderPins: async (pinIds: string[]) => {
        try {
          set({ error: null })

          if (!window.electronAPI) {
            throw new Error('Electron API not available')
          }

          await window.electronAPI.reorderPins(pinIds)

          // Update local state optimistically by reordering pins
          set((state) => {
            const pinMap = new Map(state.pins.map(pin => [pin.id, pin]))
            const reorderedPins = pinIds.map(id => pinMap.get(id)!).filter(Boolean)
            return { pins: reorderedPins }
          })
        } catch (error) {
          console.error('Failed to reorder pins:', error)
          set({
            error: error instanceof Error ? error.message : 'Failed to reorder pins'
          })
          throw error // Re-throw so UI can handle it
        }
      },

      clearError: () => {
        set({ error: null })
      }
    }),
    {
      name: 'pin-store' // Name for devtools
    }
  )
)

// Set up IPC event listeners when store is created
let unsubscribe: (() => void) | null = null

// Initialize listeners
export const initializePinStore = () => {
  if (window.electronAPI && !unsubscribe) {
    // Listen for pins updated from main process (e.g., file changes)
    unsubscribe = window.electronAPI.onPinsUpdated((pins: Pin[]) => {
      usePinStore.setState({ pins })
    })
  }
}

// Cleanup listeners
export const cleanupPinStore = () => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
}
