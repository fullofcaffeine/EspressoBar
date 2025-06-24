import React from 'react'
import { ExternalLink, Clock, Calendar, FileText } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Separator } from './ui/separator'
import type { Pin, OrgTimestamp } from '../../shared/types'

interface PinDetailModalProps {
  pin: Pin | null
  isOpen: boolean
  onClose: () => void
}

const PinDetailModal: React.FC<PinDetailModalProps> = ({
  pin,
  isOpen,
  onClose
}) => {
  console.log('PinDetailModal: rendered with pin:', pin, 'isOpen:', isOpen)
  if (!pin) return null

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTimestampIcon = (type: OrgTimestamp['type']) => {
    switch (type) {
      case 'scheduled':
        return <Calendar className="h-4 w-4 text-blue-400" />
      case 'deadline':
        return <Clock className="h-4 w-4 text-red-400" />
      case 'active':
        return <Calendar className="h-4 w-4 text-green-400" />
      case 'inactive':
        return <Calendar className="h-4 w-4 text-gray-400" />
      case 'range':
        return <Calendar className="h-4 w-4 text-purple-400" />
      default:
        return <Calendar className="h-4 w-4 text-gray-400" />
    }
  }

  const handleOpenInEmacs = async () => {
    if (!pin.filePath) {
      console.warn('No file path available for this pin')
      return
    }

    try {
      console.log(`🚀 Opening ${pin.filePath}${pin.lineNumber ? ` at line ${pin.lineNumber}` : ''} in Emacs...`)
      
      // Use emacsclient directly through IPC
      const result = await window.electronAPI.openInEmacs(pin.filePath, pin.lineNumber)
      
      if (result.success) {
        console.log('✅ Successfully opened file in Emacs')
      } else {
        console.error('❌ Failed to open file in Emacs:', result.error)
        
        // Fallback: copy elisp code to clipboard
        const elisp = generateElispCode()
        navigator.clipboard.writeText(elisp).then(() => {
          console.log('📋 Emacsclient failed, elisp code copied to clipboard as fallback')
          alert(`Failed to open in Emacs: ${result.error}\n\nElisp code copied to clipboard as fallback.`)
        }).catch(clipboardError => {
          console.error('❌ Failed to copy to clipboard:', clipboardError)
          alert(`Failed to open in Emacs: ${result.error}\n\nPlease ensure Emacs is running with server-start.`)
        })
      }
    } catch (error) {
      console.error('❌ Error calling openInEmacs:', error)
      
      // Fallback: copy elisp code to clipboard
      const elisp = generateElispCode()
      navigator.clipboard.writeText(elisp).then(() => {
        console.log('📋 IPC error, elisp code copied to clipboard as fallback')
        alert('Error communicating with Emacs. Elisp code copied to clipboard as fallback.')
      })
    }
  }

  const generateElispCode = () => {
    if (!pin.filePath) {
      return `(message "No file path available for this pin")`
    }
    
    if (pin.lineNumber && pin.lineNumber > 0) {
      return `(progn
  (find-file "${pin.filePath}")
  (goto-line ${pin.lineNumber})
  (org-reveal)
  (message "Opened ${pin.filePath.split('/').pop()} at line ${pin.lineNumber}"))`
    } else {
      return `(progn
  (find-file "${pin.filePath}")
  (org-reveal)
  (message "Opened ${pin.filePath.split('/').pop()}"))`
    }
  }

  const displayContent = pin.detailedContent || pin.content || 'No content available'
  const hasTimestamps = pin.orgTimestamps && pin.orgTimestamps.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] bg-zinc-800 text-white border-zinc-700"
        data-testid="pin-detail-modal"
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pin Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          {/* Main Content */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-2">Content</h3>
            <div 
              className="bg-zinc-900 rounded-md p-3 text-sm whitespace-pre-wrap"
              data-testid="pin-detail-content"
            >
              {displayContent}
            </div>
          </div>

          {/* Timestamps */}
          {hasTimestamps && (
            <>
              <Separator className="bg-zinc-700" />
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Timestamps</h3>
                <div className="space-y-2">
                  {pin.orgTimestamps!.map((timestamp, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 text-sm bg-zinc-900 rounded-md p-2"
                    >
                      {getTimestampIcon(timestamp.type)}
                      <span className="capitalize text-zinc-300 min-w-[80px]">
                        {timestamp.type}:
                      </span>
                      <span className="text-white">
                        {timestamp.startDate ? formatDate(timestamp.startDate) : timestamp.datetime}
                      </span>
                      {timestamp.endDate && (
                        <span className="text-zinc-400">
                          → {formatDate(timestamp.endDate)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {pin.tags && pin.tags.length > 0 && (
            <>
              <Separator className="bg-zinc-700" />
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {pin.tags.map((tag, index) => (
                    <span 
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* File Information */}
          {pin.filePath && (
            <>
              <Separator className="bg-zinc-700" />
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Source</h3>
                <div className="bg-zinc-900 rounded-md p-2 text-sm">
                  <div className="text-zinc-400">File:</div>
                  <div className="text-white font-mono text-xs break-all">
                    {pin.filePath}
                  </div>
                  {pin.lineNumber && (
                    <>
                      <div className="text-zinc-400 mt-1">Line:</div>
                      <div className="text-white">
                        {pin.lineNumber}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
          <div className="text-xs text-zinc-400">
            Created: {new Date(pin.timestamp).toLocaleDateString()}
          </div>
          
          <div className="flex gap-2">
            {pin.filePath && (
              <Button
                onClick={handleOpenInEmacs}
                className="bg-green-600 hover:bg-green-500 text-white"
                size="sm"
                data-testid="open-in-emacs-btn"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in Emacs
              </Button>
            )}
            
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-none" 
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PinDetailModal 
