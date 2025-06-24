import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'
import { FileCacheService } from './fileCache'

export interface ScanProgress {
  totalFiles: number
  processedFiles: number
  currentFile: string
  isComplete: boolean
}

export interface OrgFile {
  filePath: string
  fileName: string
  lastModified: number
  size: number
}

export class OrgScannerService {
  private fileCache: FileCacheService
  private scanProgress: ScanProgress = {
    totalFiles: 0,
    processedFiles: 0,
    currentFile: '',
    isComplete: true
  }

  constructor(fileCache: FileCacheService) {
    this.fileCache = fileCache
  }

  /**
   * Recursively scan directories for org files
   */
  async scanDirectories(directories: string[]): Promise<OrgFile[]> {
    console.log(`📁 Starting scan of ${directories.length} directories...`)
    
    const allOrgFiles: OrgFile[] = []
    
    for (const directory of directories) {
      try {
        const orgFiles = await this.scanDirectory(directory)
        allOrgFiles.push(...orgFiles)
      } catch (error) {
        console.error(`❌ Failed to scan directory ${directory}:`, error)
        // Continue with other directories even if one fails
      }
    }

    console.log(`✅ Scan complete. Found ${allOrgFiles.length} org files`)
    return allOrgFiles
  }

  /**
   * Recursively scan a single directory for org files
   */
  private async scanDirectory(directory: string): Promise<OrgFile[]> {
    const orgFiles: OrgFile[] = []

    try {
      // Check if directory exists and is accessible
      const stats = await fs.stat(directory)
      if (!stats.isDirectory()) {
        console.warn(`⚠️ Path is not a directory: ${directory}`)
        return orgFiles
      }

      const entries = await fs.readdir(directory, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(directory, entry.name)

        if (entry.isDirectory()) {
          // Skip hidden directories and common non-relevant directories
          if (this.shouldSkipDirectory(entry.name)) {
            continue
          }

          // Recursively scan subdirectory
          const subOrgFiles = await this.scanDirectory(fullPath)
          orgFiles.push(...subOrgFiles)
        } else if (entry.isFile()) {
          // Check if it's an org file
          if (this.isOrgFile(entry.name)) {
            try {
              const fileStats = await fs.stat(fullPath)
              orgFiles.push({
                filePath: fullPath,
                fileName: entry.name,
                lastModified: fileStats.mtimeMs,
                size: fileStats.size
              })
            } catch (error) {
              console.warn(`⚠️ Could not stat org file ${fullPath}:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning directory ${directory}:`, error)
      throw error
    }

    return orgFiles
  }

  /**
   * Check if a filename is an org file
   */
  private isOrgFile(fileName: string): boolean {
    const ext = extname(fileName).toLowerCase()
    return ext === '.org'
  }

  /**
   * Check if a directory should be skipped during scanning
   */
  private shouldSkipDirectory(dirName: string): boolean {
    // Skip hidden directories
    if (dirName.startsWith('.')) {
      return true
    }

    // Skip common non-relevant directories
    const skipDirs = [
      'node_modules',
      'build',
      'dist',
      'target',
      '__pycache__',
      '.git',
      '.svn',
      '.hg',
      'vendor',
      'tmp',
      'temp'
    ]

    return skipDirs.includes(dirName.toLowerCase())
  }

  /**
   * Get files that need parsing (new or modified since last scan)
   */
  async getFilesToParse(orgFiles: OrgFile[]): Promise<OrgFile[]> {
    const filesToParse: OrgFile[] = []

    for (const orgFile of orgFiles) {
      const needsParsing = await this.fileCache.needsParsing(orgFile.filePath)
      if (needsParsing) {
        filesToParse.push(orgFile)
      }
    }

    console.log(`📊 Found ${filesToParse.length} files that need parsing out of ${orgFiles.length} total`)
    return filesToParse
  }

  /**
   * Get scan progress information
   */
  getScanProgress(): ScanProgress {
    return { ...this.scanProgress }
  }

  /**
   * Start progress tracking for a scan
   */
  startProgress(totalFiles: number): void {
    this.scanProgress = {
      totalFiles,
      processedFiles: 0,
      currentFile: '',
      isComplete: false
    }
  }

  /**
   * Update progress during scanning
   */
  updateProgress(processedFiles: number, currentFile: string): void {
    this.scanProgress.processedFiles = processedFiles
    this.scanProgress.currentFile = basename(currentFile)
  }

  /**
   * Mark scan as complete
   */
  completeProgress(): void {
    this.scanProgress.isComplete = true
    this.scanProgress.currentFile = ''
  }

  /**
   * Sort org files by modification date (DESC)
   */
  sortByModificationDate(orgFiles: OrgFile[]): OrgFile[] {
    return [...orgFiles].sort((a, b) => b.lastModified - a.lastModified)
  }

  /**
   * Filter org files by size (skip very large files that might cause performance issues)
   */
  filterBySize(orgFiles: OrgFile[], maxSizeMB: number = 10): OrgFile[] {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    const filtered = orgFiles.filter(file => file.size <= maxSizeBytes)
    
    const skipped = orgFiles.length - filtered.length
    if (skipped > 0) {
      console.warn(`⚠️ Skipped ${skipped} org files larger than ${maxSizeMB}MB`)
    }

    return filtered
  }

  /**
   * Get scan statistics
   */
  async getScanStats(directories: string[]): Promise<{
    totalDirectories: number
    totalFiles: number
    totalSize: number
    largestFile: { path: string; size: number } | null
    cacheStats: { totalFiles: number; totalPins: number; lastUpdated: number }
  }> {
    const orgFiles = await this.scanDirectories(directories)
    
    let totalSize = 0
    let largestFile: { path: string; size: number } | null = null

    for (const file of orgFiles) {
      totalSize += file.size
      if (!largestFile || file.size > largestFile.size) {
        largestFile = { path: file.filePath, size: file.size }
      }
    }

    return {
      totalDirectories: directories.length,
      totalFiles: orgFiles.length,
      totalSize,
      largestFile,
      cacheStats: this.fileCache.getStats()
    }
  }

  /**
   * Validate that directories exist and are accessible
   */
  async validateDirectories(directories: string[]): Promise<{
    valid: string[]
    invalid: Array<{ path: string; error: string }>
  }> {
    const valid: string[] = []
    const invalid: Array<{ path: string; error: string }> = []

    for (const directory of directories) {
      try {
        const stats = await fs.stat(directory)
        if (stats.isDirectory()) {
          // Check if we can read the directory
          await fs.access(directory, fs.constants.R_OK)
          valid.push(directory)
        } else {
          invalid.push({ path: directory, error: 'Not a directory' })
        }
      } catch (error) {
        invalid.push({ 
          path: directory, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return { valid, invalid }
  }
} 
