import React from 'react'
import { Settings, GripVertical, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'
import { Separator } from './ui/separator'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import {
  CSS,
} from '@dnd-kit/utilities'
import type { TrayPopupProps, Pin as PinType } from '../../shared/types'

// Sortable Pin Item Component
interface SortablePinProps {
  pin: PinType
  onPinClick: (pin: PinType, event: React.MouseEvent) => void
  onRemovePin: (id: string) => void
  formatTimestamp: (timestamp: number) => string
}

const SortablePin: React.FC<SortablePinProps> = ({ pin, onPinClick, onRemovePin, formatTimestamp }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pin.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex justify-between items-center py-2 px-2 hover:bg-zinc-700 rounded-md cursor-pointer group transition-colors"
      onClick={(event) => onPinClick(pin, event)}
      data-testid="pin-item"
    >
      {/* Drag Handle - Only visible on hover */}
      <div
        className="hidden group-hover:block cursor-grab active:cursor-grabbing mr-2 flex-shrink-0"
        {...attributes}
        {...listeners}
        data-testid="drag-handle"
      >
        <GripVertical className="h-4 w-4 text-zinc-400" />
      </div>

      {/* Pin Content */}
      <span 
        className="truncate text-sm text-white flex-grow"
        data-testid="pin-content"
      >
        {pin.content}
      </span>

      {/* Timestamp and Actions */}
      <div className="flex items-center gap-2 ml-3">
        <span
          className="opacity-60 whitespace-nowrap text-xs text-zinc-400"
          data-testid="pin-timestamp"
        >
          {formatTimestamp(pin.timestamp)}
        </span>
        
        {/* Delete Button - Only visible on hover */}
        <button
          className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-5 w-5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/20 transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation() // Prevent pin click
            onRemovePin(pin.id)
          }}
          data-testid="delete-pin"
          title="Delete pin"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

const TrayPopup: React.FC<TrayPopupProps> = ({
  pins,
  onRemovePin,
  onShowPreferences,
  onPinClick,
  onReorderPins
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
        window.electronAPI
          .openInEmacs(pin.filePath, pin.lineNumber)
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

  // Set up drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = pins.findIndex((pin) => pin.id === active.id)
    const newIndex = pins.findIndex((pin) => pin.id === over.id)

    // Calculate new order using arrayMove
    const newPins = arrayMove(pins, oldIndex, newIndex)
    const newPinIds = newPins.map((pin) => pin.id)

    // Call the reorder callback
    onReorderPins(newPinIds)
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pins.map((pin) => pin.id)}
                strategy={verticalListSortingStrategy}
              >
                {pins.map((pin, index) => (
                  <React.Fragment key={pin.id}>
                    <SortablePin
                      pin={pin}
                      onPinClick={handlePinClick}
                      onRemovePin={onRemovePin}
                      formatTimestamp={formatTimestamp}
                    />
                    {index < pins.length - 1 && <Separator className="my-1 bg-zinc-700" />}
                  </React.Fragment>
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TrayPopup
