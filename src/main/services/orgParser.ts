import { promises as fs } from 'fs'
import { basename } from 'path'
import type { Pin, OrgTimestamp } from '../../shared/types'

export interface OrgHeadline {
  level: number
  todo?: string
  title: string
  tags: string[]
  properties: Record<string, string>
  lineNumber: number
  content: string
  detailedContent?: string
  timestamps?: OrgTimestamp[]
}

export interface ParsedOrgFile {
  filePath: string
  headlines: OrgHeadline[]
  pinnedHeadlines: OrgHeadline[]
  parseTime: number
}

export class OrgParserService {
  
  /**
   * Parse org timestamps from content
   */
  private parseTimestamps(content: string): OrgTimestamp[] {
    const timestamps: OrgTimestamp[] = []
    
    // Patterns for different timestamp types
    const patterns = [
      // Active timestamps: <2024-01-15 Mon> or <2024-01-15 Mon 10:30>
      {
        regex: /<(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?>/g,
        type: 'active' as const
      },
      // Inactive timestamps: [2024-01-15 Mon] or [2024-01-15 Mon 10:30]
      {
        regex: /\[(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?]/g,
        type: 'inactive' as const
      },
      // Scheduled: SCHEDULED: <timestamp>
      {
        regex: /SCHEDULED:\s*<(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?>/g,
        type: 'scheduled' as const
      },
      // Deadline: DEADLINE: <timestamp>
      {
        regex: /DEADLINE:\s*<(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?>/g,
        type: 'deadline' as const
      },
      // Date ranges: <date1>--<date2>
      {
        regex: /<(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2}))?>\s*--\s*<(\d{4}-\d{2}-\d{2})\s+(\w{3})(?:\s+(\d{1,2}:\d{2}))?>/g,
        type: 'range' as const
      }
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.regex.exec(content)) !== null) {
        try {
          const timestamp: OrgTimestamp = {
            type: pattern.type,
            datetime: match[1], // Date part
            originalText: match[0]
          }
          
          // Parse start date
          if (pattern.type === 'range') {
            timestamp.startDate = new Date(`${match[1]}${match[3] ? 'T' + match[3] : ''}`)
            timestamp.endDate = new Date(`${match[4]}${match[6] ? 'T' + match[6] : ''}`)
          } else {
            timestamp.startDate = new Date(`${match[1]}${match[3] ? 'T' + match[3] : ''}`)
            // If it's a time range within same day
            if (match[4]) {
              timestamp.endDate = new Date(`${match[1]}T${match[4]}`)
            }
          }
          
          timestamps.push(timestamp)
        } catch (error) {
          console.warn('Failed to parse timestamp:', match[0], error)
        }
      }
    }
    
    return timestamps
  }

  /**
   * Parse an org file and extract all headlines with their properties
   */
  async parseOrgFile(filePath: string): Promise<ParsedOrgFile> {
    const startTime = Date.now()
    
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      
      const headlines = this.parseHeadlines(lines)
      const pinnedHeadlines = headlines.filter(headline => this.isPinnedHeadline(headline))
      
      const parseTime = Date.now() - startTime
      
      console.log(`📄 Parsed ${basename(filePath)}: ${headlines.length} headlines, ${pinnedHeadlines.length} pinned (${parseTime}ms)`)
      
      return {
        filePath,
        headlines,
        pinnedHeadlines,
        parseTime
      }
    } catch (error) {
      console.error(`❌ Failed to parse org file ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Parse headlines from org file lines
   */
  private parseHeadlines(lines: string[]): OrgHeadline[] {
    const headlines: OrgHeadline[] = []
    let currentHeadline: Partial<OrgHeadline> | null = null
    let currentProperties: Record<string, string> = {}
    let currentDetailedContent: string[] = []
    let inPropertiesBlock = false
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNumber = i + 1
      
      // Check for headline
      const headlineMatch = line.match(/^(\*+)\s*(?:(TODO|NEXT|DONE|WAITING|CANCELED)\s+)?(.*?)(?:\s+:([\w:]+):)?$/)
      
      if (headlineMatch) {
        // Save previous headline if exists
        if (currentHeadline) {
          const fullContent = currentDetailedContent.join('\n').trim()
          const timestamps = this.parseTimestamps(currentHeadline.content! + '\n' + fullContent)
          
          headlines.push({
            level: currentHeadline.level!,
            todo: currentHeadline.todo,
            title: currentHeadline.title!,
            tags: currentHeadline.tags!,
            properties: currentProperties,
            lineNumber: currentHeadline.lineNumber!,
            content: currentHeadline.content!,
            detailedContent: fullContent || undefined,
            timestamps: timestamps.length > 0 ? timestamps : undefined
          })
        }
        
        // Start new headline
        const stars = headlineMatch[1]
        const todoKeyword = headlineMatch[2]
        const titleAndTags = headlineMatch[3]
        const tagString = headlineMatch[4]
        
        const tags = tagString ? tagString.split(':').filter(tag => tag.length > 0) : []
        
        currentHeadline = {
          level: stars.length,
          todo: todoKeyword,
          title: titleAndTags.trim(),
          tags,
          lineNumber,
          content: line
        }
        
        currentProperties = {}
        currentDetailedContent = []
        inPropertiesBlock = false
        continue
      }
      
      // Check for properties drawer
      if (line.trim() === ':PROPERTIES:') {
        inPropertiesBlock = true
        continue
      }
      
      if (line.trim() === ':END:') {
        inPropertiesBlock = false
        continue
      }
      
      // Parse property line
      if (inPropertiesBlock) {
        const propertyMatch = line.match(/^\s*:([^:]+):\s*(.*)$/)
        if (propertyMatch) {
          const key = propertyMatch[1].trim()
          const value = propertyMatch[2].trim()
          currentProperties[key] = value
        }
      } else if (currentHeadline) {
        // Collect content lines that belong to the current headline
        currentDetailedContent.push(line)
      }
    }
    
    // Don't forget the last headline
    if (currentHeadline) {
      const fullContent = currentDetailedContent.join('\n').trim()
      const timestamps = this.parseTimestamps(currentHeadline.content! + '\n' + fullContent)
      
      headlines.push({
        level: currentHeadline.level!,
        todo: currentHeadline.todo,
        title: currentHeadline.title!,
        tags: currentHeadline.tags!,
        properties: currentProperties,
        lineNumber: currentHeadline.lineNumber!,
        content: currentHeadline.content!,
        detailedContent: fullContent || undefined,
        timestamps: timestamps.length > 0 ? timestamps : undefined
      })
    }
    
    return headlines
  }

  /**
   * Check if a headline is pinned (has :pinned: or :PINNED: property)
   */
  private isPinnedHeadline(headline: OrgHeadline): boolean {
    // Check properties for pinned flag
    const hasPropertyPinned = 
      headline.properties.pinned || 
      headline.properties.PINNED ||
      headline.properties.Pinned
    
    // Check tags for pinned tag
    const hasTagPinned = headline.tags.some(tag => 
      tag.toLowerCase() === 'pinned'
    )
    
    return !!(hasPropertyPinned || hasTagPinned)
  }

  /**
   * Convert org headlines to Pin objects
   */
  convertToPins(filePath: string, headlines: OrgHeadline[]): Pin[] {
    const fileStats = require('fs').statSync(filePath)
    
    return headlines.map(headline => {
      const pin: Pin = {
        id: this.generatePinId(filePath, headline.lineNumber),
        content: headline.title,
        timestamp: fileStats.mtimeMs, // Use file modification time
        sourceFile: filePath,
        orgHeadline: headline.content,
        tags: [...headline.tags],
        // Add new detailed content fields
        detailedContent: headline.detailedContent,
        orgTimestamps: headline.timestamps,
        filePath: filePath,
        lineNumber: headline.lineNumber
      }
      
      return pin
    })
  }

  /**
   * Generate a consistent ID for a pin based on file path and line number
   */
  private generatePinId(filePath: string, lineNumber: number): string {
    // Create a consistent ID that won't change unless the file or line changes
    const fileBase = basename(filePath, '.org')
    return `org-${fileBase}-${lineNumber}`
  }

  /**
   * Parse multiple org files and return all pinned items
   */
  async parseMultipleFiles(filePaths: string[]): Promise<Pin[]> {
    const allPins: Pin[] = []
    
    for (const filePath of filePaths) {
      try {
        const parsed = await this.parseOrgFile(filePath)
        const pins = this.convertToPins(filePath, parsed.pinnedHeadlines)
        allPins.push(...pins)
      } catch (error) {
        console.error(`❌ Failed to parse ${filePath}, skipping...`, error)
        // Continue with other files even if one fails
      }
    }
    
    return allPins
  }

  /**
   * Extract preview text from org headline (useful for UI)
   */
  extractPreview(headline: OrgHeadline, maxLength: number = 100): string {
    let preview = headline.title
    
    // Add TODO keyword if present
    if (headline.todo) {
      preview = `${headline.todo} ${preview}`
    }
    
    // Truncate if too long
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength - 3) + '...'
    }
    
    return preview
  }

  /**
   * Get file statistics for parsed org file
   */
  async getFileStats(filePath: string): Promise<{
    size: number
    lastModified: number
    totalLines: number
    totalHeadlines: number
    pinnedHeadlines: number
  }> {
    try {
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      
      const headlines = this.parseHeadlines(lines)
      const pinnedCount = headlines.filter(h => this.isPinnedHeadline(h)).length
      
      return {
        size: stats.size,
        lastModified: stats.mtimeMs,
        totalLines: lines.length,
        totalHeadlines: headlines.length,
        pinnedHeadlines: pinnedCount
      }
    } catch (error) {
      console.error(`❌ Failed to get stats for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Validate org file format
   */
  async validateOrgFile(filePath: string): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []
    
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split('\n')
      
      // Check for basic org structure
      let hasHeadlines = false
      let unclosedProperties = false
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Check for headlines
        if (line.match(/^\*+\s/)) {
          hasHeadlines = true
        }
        
        // Check for unclosed properties blocks
        if (line.trim() === ':PROPERTIES:') {
          unclosedProperties = true
        }
        
        if (line.trim() === ':END:') {
          unclosedProperties = false
        }
      }
      
      if (!hasHeadlines) {
        warnings.push('No headlines found in org file')
      }
      
      if (unclosedProperties) {
        errors.push('Unclosed properties block found')
      }
      
    } catch (error) {
      errors.push(`Cannot read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Find headlines by search term
   */
  async searchHeadlines(filePath: string, searchTerm: string): Promise<OrgHeadline[]> {
    try {
      const parsed = await this.parseOrgFile(filePath)
      const searchLower = searchTerm.toLowerCase()
      
      return parsed.headlines.filter(headline =>
        headline.title.toLowerCase().includes(searchLower) ||
        headline.tags.some(tag => tag.toLowerCase().includes(searchLower))
      )
    } catch (error) {
      console.error(`❌ Failed to search in ${filePath}:`, error)
      return []
    }
  }
} 
