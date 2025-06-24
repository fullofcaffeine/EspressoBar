import React, { useState, useEffect } from 'react'
import { X, ArrowLeft, Plus, FolderOpen, RotateCcw, Zap, Activity } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { useTheme } from '../src/ThemeProvider'
import { usePinStore } from '../stores/pinStore'
import type { ScanResult } from '../../shared/types'

type TabId = 'org-files' | 'hotkeys' | 'advanced'

interface PreferencesProps {
  onBack?: () => void
}

const Preferences: React.FC<PreferencesProps> = ({ onBack }) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('org-files')
  const { theme, setTheme } = useTheme()
  const { refreshPins } = usePinStore()
  const [orgDirectories, setOrgDirectories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  // Load org directories on mount
  useEffect(() => {
    loadOrgDirectories()
  }, [])

  const loadOrgDirectories = async () => {
    try {
      if (window.electronAPI?.getOrgDirectories) {
        const directories = await window.electronAPI.getOrgDirectories()
        setOrgDirectories(directories)
      }
    } catch (error) {
      console.error('Failed to load org directories:', error)
    }
  }

  const handleAddDirectory = async () => {
    try {
      setIsLoading(true)
      if (window.electronAPI?.pickOrgDirectory) {
        const selectedPath = await window.electronAPI.pickOrgDirectory()
        if (selectedPath && !orgDirectories.includes(selectedPath)) {
          const newDirectories = [...orgDirectories, selectedPath]
          setOrgDirectories(newDirectories)
          
          if (window.electronAPI?.setOrgDirectories) {
            await window.electronAPI.setOrgDirectories(newDirectories)
          }
        }
      }
    } catch (error) {
      console.error('Failed to add org directory:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveDirectory = async (dirPath: string) => {
    try {
      const newDirectories = orgDirectories.filter(dir => dir !== dirPath)
      setOrgDirectories(newDirectories)
      
      if (window.electronAPI?.setOrgDirectories) {
        await window.electronAPI.setOrgDirectories(newDirectories)
      }
    } catch (error) {
      console.error('Failed to remove org directory:', error)
    }
  }

  const handleIncrementalScan = async () => {
    if (isScanning) return
    
    try {
      setIsScanning(true)
      console.log('🔄 Starting incremental scan...')
      
      if (window.electronAPI?.triggerIncrementalScan) {
        const result = await window.electronAPI.triggerIncrementalScan()
        setLastScanResult(result)
        console.log('✅ Incremental scan completed:', result)
        
        // Refresh pins in the store to ensure UI is updated
        await refreshPins()
        console.log('🔄 Pin store refreshed after incremental scan')
      }
    } catch (error) {
      console.error('Failed to trigger incremental scan:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleFullScan = async () => {
    if (isScanning) return
    
    try {
      setIsScanning(true)
      console.log('🧹 Starting full clean scan...')
      
      if (window.electronAPI?.triggerFullScan) {
        const result = await window.electronAPI.triggerFullScan()
        setLastScanResult(result)
        console.log('✅ Full scan completed:', result)
        
        // Refresh pins in the store to ensure UI is updated
        await refreshPins()
        console.log('🔄 Pin store refreshed after full scan')
      }
    } catch (error) {
      console.error('Failed to trigger full scan:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate('/')
    }
  }

  const renderOrgFilesTab = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2 text-white">Org Directories</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Select directories to scan recursively for org files with pinned items
        </p>
        
        {orgDirectories.length > 0 ? (
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-700">
                {orgDirectories.map((dir, index) => (
                  <div key={index} className="flex justify-between items-center px-3 py-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderOpen className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                      <span className="truncate text-sm text-white" title={dir}>
                        {dir}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-zinc-800"
                      onClick={() => handleRemoveDirectory(dir)}
                      title="Remove directory"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900 border-zinc-700">
            <CardContent className="p-4 text-center">
              <FolderOpen className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">No org directories configured</p>
              <p className="text-xs text-zinc-500 mt-1">
                Add directories to start scanning for pinned items
              </p>
            </CardContent>
          </Card>
        )}
        
        <Button 
          variant="outline" 
          className="mt-2 bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
          onClick={handleAddDirectory}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4 mr-2" />
          {isLoading ? 'Selecting...' : 'Add Directory'}
        </Button>
      </div>

      <Separator className="bg-zinc-700" />

      <div>
        <h3 className="text-sm font-medium mb-2 text-white">Scan Controls</h3>
        <p className="text-xs text-zinc-400 mb-3">
          Manually trigger scans to find pinned items in your org files
        </p>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
              onClick={handleIncrementalScan}
              disabled={isScanning || orgDirectories.length === 0}
              data-testid="incremental-scan-button"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isScanning ? 'Scanning...' : 'Quick Scan'}
            </Button>
            
            <Button 
              variant="outline" 
              className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
              onClick={handleFullScan}
              disabled={isScanning || orgDirectories.length === 0}
              data-testid="full-scan-button"
            >
              <Zap className="h-4 w-4 mr-2" />
              {isScanning ? 'Scanning...' : 'Full Scan'}
            </Button>
          </div>
          
          <div className="text-xs text-zinc-500">
            <div className="flex justify-between">
              <span>Quick Scan: Only modified files</span>
              <span>Full Scan: All files (ignores cache)</span>
            </div>
          </div>
        </div>

        {/* Scan Status */}
        {(isScanning || lastScanResult) && (
          <Card className="mt-3 bg-zinc-900 border-zinc-700">
            <CardContent className="p-3">
              {isScanning ? (
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-400 animate-pulse" />
                  <span className="text-sm text-white">Scanning in progress...</span>
                </div>
              ) : lastScanResult ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white">Last scan completed</span>
                    <span className="text-zinc-400">{lastScanResult.scanTime}ms</span>
                  </div>
                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Files processed:</span>
                      <span>{lastScanResult.processedFiles}/{lastScanResult.totalFiles}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pinned items found:</span>
                      <span>{lastScanResult.pinnedItems}</span>
                    </div>
                    {lastScanResult.errors.length > 0 && (
                      <div className="text-red-400">
                        {lastScanResult.errors.length} error(s) occurred
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )

  const renderHotkeysTab = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2 text-white">Global shortcuts</h3>
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white">Toggle popup</span>
              <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌥Space</kbd>
            </div>
            {/* TEMPORARILY COMMENTED OUT - Save capture functionality */}
            {/* <Separator className="bg-zinc-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-white">Quick capture</span>
              <kbd className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300">⌥⌘Space</kbd>
            </div> */}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderAdvancedTab = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2 text-white">Application settings</h3>
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-3 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white">Auto-start</span>
              <Switch className="data-[state=unchecked]:bg-zinc-600" />
            </div>
            <Separator className="bg-zinc-700" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-white">Hide on blur</span>
              <Switch defaultChecked className="data-[state=checked]:bg-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-white">Theme</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((themeOption) => (
            <Button
              key={themeOption}
              onClick={() => setTheme(themeOption)}
              variant={theme === themeOption ? "default" : "outline"}
              size="sm"
              className={theme === themeOption 
                ? "bg-indigo-600 hover:bg-indigo-500 text-white border-none" 
                : "bg-zinc-700 hover:bg-zinc-600 text-white border-zinc-600"
              }
            >
              {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <Card className="w-full max-w-xl bg-zinc-800 text-white border-zinc-700 shadow-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={handleBack}
            title="Back to main screen"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="text-white">Preferences</CardTitle>
            <CardDescription className="text-zinc-400">Configure your application settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900 border-zinc-700">
            <TabsTrigger 
              value="org-files" 
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400"
            >
              Org Files
            </TabsTrigger>
            <TabsTrigger 
              value="hotkeys"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400"
            >
              Hotkeys
            </TabsTrigger>
            <TabsTrigger 
              value="advanced"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-zinc-400"
            >
              Advanced
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="org-files" className="mt-4">
            {renderOrgFilesTab()}
          </TabsContent>
          
          <TabsContent value="hotkeys" className="mt-4">
            {renderHotkeysTab()}
          </TabsContent>
          
          <TabsContent value="advanced" className="mt-4">
            {renderAdvancedTab()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default Preferences 
