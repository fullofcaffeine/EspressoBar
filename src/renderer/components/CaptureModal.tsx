import React, { useState, useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Textarea } from './ui/textarea'
// TEMPORARILY COMMENTED OUT - Save capture functionality
// import type { CaptureModalProps } from '../../shared/types'

interface CaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (content: string) => Promise<void>
  defaultDestination?: string
}

const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  defaultDestination = 'inbox.org'
}) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await onCapture(content.trim())
      onClose()
    } catch (error) {
      console.error('Failed to capture:', error)
      // TODO: Show error notification
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="w-full max-w-md bg-zinc-800 text-white border-zinc-700"
        data-testid="capture-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            Capture → {defaultDestination}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[120px] resize-none bg-zinc-900 text-white border-zinc-600 placeholder:text-zinc-400 focus:border-indigo-600 focus:ring-indigo-600"
            placeholder="What's on your mind?"
            required
          />

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600 hover:border-zinc-500"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white border-none"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CaptureModal 
