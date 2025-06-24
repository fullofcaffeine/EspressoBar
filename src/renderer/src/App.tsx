import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import TrayPopup from '../components/TrayPopup'
import EmptyPopup from '../components/EmptyPopup'
import PinDetailModal from '../components/PinDetailModal'
import Preferences from '../components/Preferences'
import { ThemeProvider } from './ThemeProvider'
import { usePinStore, initializePinStore, cleanupPinStore } from '../stores/pinStore'
import type { Pin } from '../../shared/types'

const PopupView: React.FC = () => {
  const navigate = useNavigate()
  const { pins, isLoading, error, loadPins, /* removePin, */ clearError } = usePinStore()
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [isPinDetailModalOpen, setIsPinDetailModalOpen] = useState(false)

  // Load pins on component mount (pin store is already initialized globally)
  useEffect(() => {
    loadPins()
  }, [loadPins])

  // Clear any errors when component mounts
  useEffect(() => {
    if (error) {
      console.warn('Pin store error:', error)
      // Auto-clear error after 5 seconds
      const timeout = setTimeout(clearError, 5000)
      return () => clearTimeout(timeout)
    }
    // Return undefined for the case when there's no error
    return undefined
  }, [error, clearError])

  // TEMPORARILY COMMENTED OUT - Remove pin functionality
  // const handleRemovePin = async (id: string) => {
  //   try {
  //     await removePin(id)
  //   } catch (err) {
  //     console.error('Failed to remove pin:', err)
  //   }
  // }

  const handleShowPreferences = () => {
    navigate('/preferences')
  }

  const handlePinClick = (pin: Pin) => {
    console.log('App: handlePinClick called with pin:', pin)
    console.log('App: setting selectedPin and opening modal')
    setSelectedPin(pin)
    setIsPinDetailModalOpen(true)
  }

  const handleClosePinDetailModal = () => {
    setIsPinDetailModalOpen(false)
    setSelectedPin(null)
  }

  // Show loading state
  if (isLoading && pins.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-pulse text-zinc-400">Loading pins...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Error notification */}
      {error && (
        <div className="fixed top-2 left-2 right-2 z-50 bg-red-600 text-white text-xs p-2 rounded">
          Error: {error}
        </div>
      )}

      {pins.length === 0 ? (
        <EmptyPopup onShowPreferences={handleShowPreferences} />
      ) : (
        <TrayPopup
          pins={pins}
          onRemovePin={() => {}} // TEMPORARILY DISABLED - Remove pin functionality
          onShowPreferences={handleShowPreferences}
          onPinClick={handlePinClick}
        />
      )}

      <PinDetailModal
        pin={selectedPin}
        isOpen={isPinDetailModalOpen}
        onClose={handleClosePinDetailModal}
      />
    </>
  )
}

const PreferencesView: React.FC = () => {
  return <Preferences />
}

const App: React.FC = () => {
  // Initialize pin store globally for the entire app
  useEffect(() => {
    initializePinStore()
    console.log('✅ Pin store initialized globally')

    // Expose pin store for testing
    if (process.env.NODE_ENV === 'test' || (window as any).electronAPI?.isTestMode) {
      ;(window as any).usePinStore = usePinStore
      console.log('🧪 Pin store exposed for testing')
    }

    // Cleanup on unmount
    return () => {
      cleanupPinStore()
      console.log('🧹 Pin store cleaned up')
    }
  }, [])

  // Handle ESC key to close window globally - works from any view
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Small delay to allow modals to handle ESC key first
        setTimeout(() => {
          // Check if any dialogs/modals are still open after the delay
          const openDialogs = document.querySelectorAll('[data-state="open"][role="dialog"]')
          const hasOpenModal = openDialogs.length > 0

          if (hasOpenModal) {
            console.log('ESC key pressed but modal is open, letting modal handle it')
            return // Modal is still open, don't close window
          }

          console.log('ESC key pressed, hiding window')
          if (window.electronAPI && window.electronAPI.hideWindow) {
            window.electronAPI.hideWindow().catch((err) => {
              console.error('Failed to hide window:', err)
            })
          } else {
            console.warn('electronAPI.hideWindow not available')
          }
        }, 100) // Small delay to let modal close first
      }
    }

    // Use regular event listener so we can check modal state after it processes ESC
    document.addEventListener('keydown', handleKeyDown, false)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, false)
    }
  }, [])

  return (
    <ThemeProvider defaultTheme="dark">
      <div className="w-full h-screen min-h-full overflow-hidden">
        <Routes>
          <Route path="/" element={<PopupView />} />
          <Route path="/preferences" element={<PreferencesView />} />
        </Routes>
      </div>
    </ThemeProvider>
  )
}

export default App
