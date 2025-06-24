import React from 'react'
import { Settings } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import type { EmptyPopupProps } from '../../shared/types'

const EmptyPopup: React.FC<EmptyPopupProps> = ({
  onShowPreferences
}) => {
  return (
    <div className="w-full h-full flex items-start justify-center p-2">
      <Card 
        className="w-full max-w-sm bg-zinc-800 text-white border-zinc-700 shadow-xl"
        data-testid="empty-popup"
      >
        <CardContent className="p-6 text-center space-y-4">
          {/* Header with preferences button */}
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowPreferences}
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Preferences</span>
            </Button>
          </div>

          {/* Pin emoji */}
          <span className="text-3xl">📌</span>
          
          {/* Empty state text */}
          <div className="space-y-2">
            <p className="text-sm text-white">Nothing pinned yet</p>
            <p className="text-xs text-zinc-400">
              Set up your org directories to see pinned items
            </p>
          </div>
          
          {/* Setup button */}
          <Button
            onClick={onShowPreferences}
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white border-none"
            variant="default"
          >
            Setup Org Directories
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default EmptyPopup 
