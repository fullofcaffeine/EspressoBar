import { BrowserWindow } from 'electron'
import { FileCacheService } from './fileCache'
import { OrgScannerService } from './orgScanner'
import { OrgParserService } from './orgParser'
import type { Pin } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/types'

export interface OrgServiceOptions {
  scanIntervalMs?: number
  maxFileSizeMB?: number
  directories?: string[]
}

export interface ScanResult {
  totalFiles: number
  processedFiles: number
  pinnedItems: number
  errors: string[]
  scanTime: number
}

export class OrgService {
  private fileCache: FileCacheService
  private scanner: OrgScannerService
  private parser: OrgParserService
  private mainWindow: BrowserWindow | null = null

  private scanInterval: NodeJS.Timeout | null = null
  private orgDirectories: string[] = []
  private isScanning: boolean = false
  private lastScanResult: ScanResult | null = null

  // Configuration
  private scanIntervalMs: number
  private maxFileSizeMB: number
  private lastPins: Pin[] = [] // Store the last scanned pins
  private getPinOrderCallback: (() => string[]) | null = null // Callback to get persistent pin order

  constructor(options: OrgServiceOptions = {}) {
    this.scanIntervalMs = options.scanIntervalMs || 30000 // 30 seconds default
    this.maxFileSizeMB = options.maxFileSizeMB || 10 // 10MB default
    this.orgDirectories = options.directories || []

    // Initialize services
    this.fileCache = new FileCacheService()
    this.scanner = new OrgScannerService(this.fileCache)
    this.parser = new OrgParserService()
  }

  /**
   * Initialize the org service
   */
  async initialize(mainWindow: BrowserWindow | null = null, getPinOrderCallback?: () => string[]): Promise<void> {
    this.mainWindow = mainWindow
    this.getPinOrderCallback = getPinOrderCallback || null

    try {
      await this.fileCache.initialize()
      console.log('✅ Org service initialized')

      // Start periodic scanning if directories are configured
      if (this.orgDirectories.length > 0) {
        this.startPeriodicScanning()
      }
    } catch (error) {
      console.error('❌ Failed to initialize org service:', error)
      throw error
    }
  }

  /**
   * Set directories to scan for org files
   */
  async setOrgDirectories(directories: string[]): Promise<void> {
    // Validate directories first
    const validation = await this.scanner.validateDirectories(directories)

    if (validation.invalid.length > 0) {
      console.warn('⚠️ Some directories are invalid:', validation.invalid)
    }

    this.orgDirectories = validation.valid
    console.log(`📁 Org directories set: ${this.orgDirectories.length} valid directories`)

    // Restart periodic scanning with new directories
    this.stopPeriodicScanning()
    if (this.orgDirectories.length > 0) {
      this.startPeriodicScanning()

      // Trigger immediate scan
      this.triggerScan()
    }
  }

  /**
   * Get current org directories
   */
  getOrgDirectories(): string[] {
    return [...this.orgDirectories]
  }

  /**
   * Start periodic background scanning
   */
  private startPeriodicScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
    }

    this.scanInterval = setInterval(() => {
      if (!this.isScanning) {
        this.performScan()
      }
    }, this.scanIntervalMs)

    console.log(`⏰ Periodic scanning started (every ${this.scanIntervalMs}ms)`)
  }

  /**
   * Stop periodic scanning
   */
  private stopPeriodicScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval)
      this.scanInterval = null
      console.log('⏹️ Periodic scanning stopped')
    }
  }

  /**
   * Trigger immediate scan
   */
  async triggerScan(): Promise<ScanResult> {
    if (this.isScanning) {
      console.log('🔄 Scan already in progress, skipping...')
      return this.lastScanResult || this.createEmptyScanResult()
    }

    return this.performScan()
  }

  /**
   * Trigger incremental scan (only modified files since last scan)
   */
  async triggerIncrementalScan(): Promise<ScanResult> {
    if (this.isScanning) {
      console.log('🔄 Incremental scan already in progress, skipping...')
      return this.lastScanResult || this.createEmptyScanResult()
    }

    console.log('🔄 Starting incremental scan...')
    return this.performScan(false)
  }

  /**
   * Trigger full clean scan (all files, ignoring cache)
   */
  async triggerFullScan(): Promise<ScanResult> {
    if (this.isScanning) {
      console.log('🔄 Full scan already in progress, skipping...')
      return this.lastScanResult || this.createEmptyScanResult()
    }

    console.log('🧹 Starting full clean scan...')
    return this.performScan(true)
  }

  /**
   * Perform the actual scan and parsing
   */
  private async performScan(force: boolean = false): Promise<ScanResult> {
    if (this.orgDirectories.length === 0) {
      console.log('📁 No org directories configured, skipping scan')
      return this.createEmptyScanResult()
    }

    this.isScanning = true
    const startTime = Date.now()
    const errors: string[] = []

    try {
      const scanType = force ? 'full clean scan' : 'incremental scan'
      console.log(`🔍 Starting org files ${scanType}...`)

      // If force is true, clear cache to ensure all files are re-parsed
      if (force) {
        console.log('🧹 Force scan: clearing cache...')
        await this.fileCache.clearCache()
      }

      // Notify UI that scan is starting
      this.notifyProgress(0, 0, `Starting ${scanType}...`, false)

      // 1. Scan directories for org files
      const allOrgFiles = await this.scanner.scanDirectories(this.orgDirectories)
      const filteredFiles = this.scanner.filterBySize(allOrgFiles, this.maxFileSizeMB)
      const sortedFiles = this.scanner.sortByModificationDate(filteredFiles)

      console.log(
        `📊 Found ${sortedFiles.length} org files (${allOrgFiles.length - filteredFiles.length} filtered by size)`
      )

      // 2. Determine which files need parsing
      const filesToParse = force
        ? sortedFiles // Force scan: parse all files
        : await this.scanner.getFilesToParse(sortedFiles) // Incremental: only changed files

      if (filesToParse.length === 0) {
        console.log('✅ No files need parsing, using cached data')
      } else {
        console.log(`📝 Parsing ${filesToParse.length} modified files...`)
      }

      // 3. Parse files that need updating
      this.scanner.startProgress(filesToParse.length)
      const allPins: Pin[] = []

      for (let i = 0; i < filesToParse.length; i++) {
        const orgFile = filesToParse[i]

        try {
          // Update progress
          this.scanner.updateProgress(i + 1, orgFile.filePath)
          this.notifyProgress(i + 1, filesToParse.length, orgFile.fileName, false)

          // Parse the file
          const parsed = await this.parser.parseOrgFile(orgFile.filePath)
          const pins = this.parser.convertToPins(orgFile.filePath, parsed.pinnedHeadlines)

          // Update cache - preserve all metadata for "Open in Emacs" functionality
          const cacheEntry = pins.map((pin) => ({
            id: pin.id,
            content: pin.content,
            lineNumber: pin.lineNumber || parseInt(pin.id.split('-').slice(-1)[0]) || 0,
            timestamp: pin.timestamp,
            filePath: pin.filePath,
            sourceFile: pin.sourceFile,
            orgHeadline: pin.orgHeadline,
            tags: pin.tags,
            detailedContent: pin.detailedContent,
            orgTimestamps: pin.orgTimestamps
          }))

          await this.fileCache.updateCache(orgFile.filePath, cacheEntry)
          allPins.push(...pins)
        } catch (error) {
          const errorMsg = `Failed to parse ${orgFile.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.error(`❌ ${errorMsg}`)
        }
      }

      // 4. Get cached pins from files that didn't need parsing
      const cachedFiles = sortedFiles.filter(
        (file) => !filesToParse.some((f) => f.filePath === file.filePath)
      )

      for (const cachedFile of cachedFiles) {
        const cachedPins = this.fileCache.getCachedPins(cachedFile.filePath)
        if (cachedPins) {
          // Convert cached pins back to Pin objects - preserve all metadata
          const pins: Pin[] = cachedPins.map((cached) => ({
            id: cached.id,
            content: cached.content,
            timestamp: cached.timestamp,
            sourceFile: cached.sourceFile || cachedFile.filePath,
            tags: cached.tags || [],
            // Essential for "Open in Emacs" functionality
            filePath: cached.filePath || cachedFile.filePath,
            lineNumber: cached.lineNumber,
            orgHeadline: cached.orgHeadline,
            detailedContent: cached.detailedContent,
            orgTimestamps: cached.orgTimestamps
          }))
          allPins.push(...pins)
        }
      }

      // 5. Sort all pins by file modification date (DESC)
      allPins.sort((a, b) => b.timestamp - a.timestamp)

      // 6. Save cache and notify UI
      await this.fileCache.saveCache()

      const scanResult: ScanResult = {
        totalFiles: sortedFiles.length,
        processedFiles: filesToParse.length,
        pinnedItems: allPins.length,
        errors,
        scanTime: Date.now() - startTime
      }

      this.lastScanResult = scanResult
      this.scanner.completeProgress()

      // Notify UI with final results
      this.notifyProgress(filesToParse.length, filesToParse.length, '', true)
      this.notifyPinsUpdated(allPins)

      console.log(
        `✅ Scan complete: ${scanResult.totalFiles} files, ${scanResult.processedFiles} parsed, ${scanResult.pinnedItems} pins found (${scanResult.scanTime}ms)`
      )

      return scanResult
    } catch (error) {
      const errorMsg = `Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      console.error(`❌ ${errorMsg}`)

      const scanResult: ScanResult = {
        totalFiles: 0,
        processedFiles: 0,
        pinnedItems: 0,
        errors,
        scanTime: Date.now() - startTime
      }

      this.lastScanResult = scanResult
      return scanResult
    } finally {
      this.isScanning = false
    }
  }

  /**
   * Get current scan progress
   */
  getScanProgress() {
    return {
      isScanning: this.isScanning,
      ...this.scanner.getScanProgress()
    }
  }

  /**
   * Get last scan result
   */
  getLastResult(): ScanResult | null {
    return this.lastScanResult
  }

  /**
   * Get service statistics
   */
  async getStats() {
    const cacheStats = this.fileCache.getStats()
    const scanStats =
      this.orgDirectories.length > 0 ? await this.scanner.getScanStats(this.orgDirectories) : null

    return {
      directories: this.orgDirectories,
      scanInterval: this.scanIntervalMs,
      isScanning: this.isScanning,
      lastScan: this.lastScanResult,
      cache: cacheStats,
      scan: scanStats
    }
  }

  /**
   * Clean up and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down org service...')

    this.stopPeriodicScanning()

    // Save cache one final time
    await this.fileCache.saveCache()

    // Clean up stale cache entries
    await this.fileCache.cleanupCache()

    console.log('✅ Org service shutdown complete')
  }

  /**
   * Create empty scan result
   */
  private createEmptyScanResult(): ScanResult {
    return {
      totalFiles: 0,
      processedFiles: 0,
      pinnedItems: 0,
      errors: [],
      scanTime: 0
    }
  }

  /**
   * Notify UI of scan progress
   */
  private notifyProgress(
    processed: number,
    total: number,
    currentFile: string,
    isComplete: boolean
  ): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('org-scan-progress', {
        processed,
        total,
        currentFile,
        isComplete
      })
    }
  }

  /**
   * Notify UI that pins have been updated
   */
  private notifyPinsUpdated(pins: Pin[]): void {
    // Store the pins for later retrieval
    this.lastPins = [...pins]

    // Apply stored order before sending to UI
    let orderedPins = pins
    if (this.getPinOrderCallback) {
      const storedOrder = this.getPinOrderCallback()
      if (storedOrder.length > 0) {
        orderedPins = this.applyStoredOrder([...pins], storedOrder)
        console.log(`📋 Applied stored pin order for UI update: ${orderedPins.length} pins`)
      }
    }

    if (this.mainWindow) {
      this.mainWindow.webContents.send(IPC_CHANNELS.PINS_UPDATED, orderedPins)
    }
  }

  /**
   * Get the current pins from the last scan
   */
  getCurrentPins(): Pin[] {
    // If we have a pin order callback, apply the stored order
    if (this.getPinOrderCallback) {
      const storedOrder = this.getPinOrderCallback()
      if (storedOrder.length > 0) {
        return this.applyStoredOrder([...this.lastPins], storedOrder)
      }
    }
    return [...this.lastPins]
  }

  /**
   * Reorder pins based on provided pin IDs array
   */
  reorderPins(pinIds: string[]): void {
    console.log('🔄 Reordering pins:', pinIds)

    // Create a map for efficient lookup
    const pinMap = new Map(this.lastPins.map(pin => [pin.id, pin]))
    
    // Build the new ordered array
    const reorderedPins: Pin[] = []
    
    // First, add pins in the order specified by pinIds
    for (const id of pinIds) {
      const pin = pinMap.get(id)
      if (pin) {
        reorderedPins.push(pin)
        pinMap.delete(id) // Remove from map to avoid duplicates
      }
    }
    
    // Then add any remaining pins that weren't in the pinIds array
    // (this handles the case where new pins were added after the reorder)
    for (const pin of pinMap.values()) {
      reorderedPins.push(pin)
    }
    
    // Update the stored pins
    this.lastPins = reorderedPins
    
    console.log(`✅ Pins reordered: ${reorderedPins.length} pins in new order`)
  }

  /**
   * Apply stored pin order to a pins array
   */
  private applyStoredOrder(pins: Pin[], storedOrder: string[]): Pin[] {
    if (storedOrder.length === 0) {
      return pins
    }

    // Create a map for efficient lookup
    const pinMap = new Map(pins.map(pin => [pin.id, pin]))
    const orderedPins: Pin[] = []
    
    // First, add pins in the stored order
    for (const id of storedOrder) {
      const pin = pinMap.get(id)
      if (pin) {
        orderedPins.push(pin)
        pinMap.delete(id) // Remove from map to avoid duplicates
      }
    }
    
    // Then add any new pins that weren't in the stored order
    // (these appear at the end by default, or at the top if they're from incremental scans)
    for (const pin of pinMap.values()) {
      orderedPins.push(pin)
    }
    
    return orderedPins
  }
}
