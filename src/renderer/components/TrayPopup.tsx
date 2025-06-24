import React from 'react'
import { Settings } from 'lucide-react'
// import { Trash2 } from 'lucide-react' // TEMPORARILY COMMENTED OUT - Remove pin functionality
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'
import { Separator } from './ui/separator'
import type { TrayPopupProps, Pin as PinType } from '../../shared/types'

const TrayPopup: React.FC<TrayPopupProps> = ({
  pins,
  onRemovePin: _onRemovePin, // TEMPORARILY PREFIXED WITH _ TO AVOID UNUSED WARNING - Remove pin functionality
  onShowPreferences,
  onPinClick
}) => {
  // Debug logging
  console.log('TrayPopup rendering with pins:', pins)
  
  // Format as "HH:MM" like in mock-ups (no relative time)
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const handlePinClick = (pin: PinType, event: React.MouseEvent) => {
    console.log('TrayPopup: handlePinClick called with pin:', pin)
    
    // Check for command/ctrl click to open detail view
    if (event.metaKey || event.ctrlKey) {
      console.log('TrayPopup: Command/Ctrl click detected, opening detail view')
      onPinClick(pin)
    } else {
      // Single click opens in Emacs
      console.log('TrayPopup: Single click detected, opening in Emacs')
      if (pin.filePath && window.electronAPI) {
        window.electronAPI.openInEmacs(pin.filePath, pin.lineNumber)
          .then((result) => {
            if (!result.success) {
              console.error('Failed to open in Emacs:', result.error)
            }
          })
          .catch((error) => {
            console.error('Error opening in Emacs:', error)
          })
      } else {
        console.warn('Pin missing filePath or electronAPI not available:', pin)
      }
    }
  }

  return (
    <div className="w-full h-full flex items-start justify-center p-2">
      <Card className="w-full max-w-sm bg-zinc-800 text-white border-zinc-700 shadow-xl">
        <CardHeader className="pb-2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📌</span>
              <span className="text-sm font-semibold">Pinned ({pins.length})</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-700"
              onClick={onShowPreferences}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 p-3 pb-4">
          <div className="max-h-80 overflow-y-auto">
            {pins.map((pin, index) => (
              <React.Fragment key={pin.id}>
                <div 
                  className="flex justify-between items-center py-2 px-2 hover:bg-zinc-700 rounded-md cursor-pointer group transition-colors"
                  onClick={(event) => handlePinClick(pin, event)}
                  data-testid="pin-item"
                >
                  <span className="truncate text-sm text-white">{pin.content}</span>
                  <div className="flex items-center gap-2 ml-3">
                    <span 
                      className="opacity-60 whitespace-nowrap text-xs text-zinc-400"
                      data-testid="pin-timestamp"
                    >
                      {formatTimestamp(pin.timestamp)}
                    </span>
                    {/* TEMPORARILY COMMENTED OUT - Remove pin functionality */}
                    {/* <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-white hover:bg-zinc-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemovePin(pin.id)
                      }}
                      data-testid="delete-pin"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button> */}
                  </div>
                </div>
                {index < pins.length - 1 && <Separator className="my-1 bg-zinc-700" />}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TrayPopup 
