import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface FileCacheEntry {
  filePath: string
  lastModified: number
  lastParsed: number
  contentHash?: string
  pins: Array<{
    id: string
    content: string
    lineNumber: number
    timestamp: number
    filePath?: string
    sourceFile?: string
    orgHeadline?: string
    tags?: string[]
    detailedContent?: string
    orgTimestamps?: any[]
  }>
}

export interface FileCache {
  version: number
  lastUpdated: number
  entries: Record<string, FileCacheEntry>
}

export class FileCacheService {
  private cache: FileCache
  private cacheFilePath: string
  private isDirty: boolean = false

  constructor() {
    // Store cache in app data directory
    this.cacheFilePath = join(app.getPath('userData'), 'org-file-cache.json')
    this.cache = {
      version: 1,
      lastUpdated: Date.now(),
      entries: {}
    }
  }

  /**
   * Initialize the cache by loading from disk
   */
  async initialize(): Promise<void> {
    try {
      await this.loadCache()
      console.log(`✅ File cache initialized with ${Object.keys(this.cache.entries).length} entries`)
    } catch (error) {
      console.log('📁 No existing cache found, starting with empty cache')
      this.cache = {
        version: 1,
        lastUpdated: Date.now(),
        entries: {}
      }
    }
  }

  /**
   * Check if a file needs to be parsed (doesn't exist in cache or has been modified)
   */
  async needsParsing(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath)
      const entry = this.cache.entries[filePath]

      if (!entry) {
        return true // File not in cache, needs parsing
      }

      // Check if file has been modified since last parse
      return stats.mtimeMs > entry.lastModified
    } catch (error) {
      // File doesn't exist or can't be accessed
      return false
    }
  }

  /**
   * Get cached pins for a file if they're still valid
   */
  getCachedPins(filePath: string): FileCacheEntry['pins'] | null {
    const entry = this.cache.entries[filePath]
    if (!entry) {
      return null
    }

    // Return cached pins if they exist
    return entry.pins || []
  }

  /**
   * Update cache entry for a file
   */
  async updateCache(
    filePath: string, 
    pins: FileCacheEntry['pins'], 
    contentHash?: string
  ): Promise<void> {
    try {
      const stats = await fs.stat(filePath)
      
      this.cache.entries[filePath] = {
        filePath,
        lastModified: stats.mtimeMs,
        lastParsed: Date.now(),
        contentHash,
        pins
      }

      this.isDirty = true
      console.log(`📝 Cache updated for ${filePath} with ${pins.length} pins`)
    } catch (error) {
      console.error(`❌ Failed to update cache for ${filePath}:`, error)
    }
  }

  /**
   * Remove file from cache (file deleted or no longer tracked)
   */
  removeFromCache(filePath: string): void {
    if (this.cache.entries[filePath]) {
      delete this.cache.entries[filePath]
      this.isDirty = true
      console.log(`🗑️ Removed ${filePath} from cache`)
    }
  }

  /**
   * Get all cached files
   */
  getCachedFiles(): string[] {
    return Object.keys(this.cache.entries)
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalFiles: number; totalPins: number; lastUpdated: number } {
    const totalFiles = Object.keys(this.cache.entries).length
    const totalPins = Object.values(this.cache.entries).reduce(
      (sum, entry) => sum + entry.pins.length, 
      0
    )

    return {
      totalFiles,
      totalPins,
      lastUpdated: this.cache.lastUpdated
    }
  }

  /**
   * Save cache to disk if it has been modified
   */
  async saveCache(): Promise<void> {
    if (!this.isDirty) {
      return
    }

    try {
      this.cache.lastUpdated = Date.now()
      await fs.writeFile(
        this.cacheFilePath, 
        JSON.stringify(this.cache, null, 2), 
        'utf8'
      )
      this.isDirty = false
      console.log(`💾 File cache saved to ${this.cacheFilePath}`)
    } catch (error) {
      console.error('❌ Failed to save file cache:', error)
    }
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8')
      const loadedCache = JSON.parse(data) as FileCache

      // Validate cache structure
      if (loadedCache.version && loadedCache.entries) {
        this.cache = loadedCache
        console.log(`📂 Loaded file cache from ${this.cacheFilePath}`)
      } else {
        throw new Error('Invalid cache format')
      }
    } catch (error) {
      console.log('⚠️ Could not load cache, starting fresh')
      throw error
    }
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<void> {
    this.cache = {
      version: 1,
      lastUpdated: Date.now(),
      entries: {}
    }
    this.isDirty = true
    await this.saveCache()
    console.log('🧹 File cache cleared')
  }

  /**
   * Clean up cache entries for files that no longer exist
   */
  async cleanupCache(): Promise<void> {
    const filesToRemove: string[] = []

    for (const filePath of Object.keys(this.cache.entries)) {
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist anymore
        filesToRemove.push(filePath)
      }
    }

    if (filesToRemove.length > 0) {
      filesToRemove.forEach(filePath => {
        delete this.cache.entries[filePath]
      })
      this.isDirty = true
      console.log(`🧹 Cleaned up ${filesToRemove.length} stale cache entries`)
    }
  }
} 
