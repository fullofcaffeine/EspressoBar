// Debug script to test org parser
const { OrgParserService } = require('./out/main/services/orgParser.js')

async function testParser() {
  const parser = new OrgParserService()
  
  const testFiles = [
    './test-org-files/file-pin-only.org',
    './test-org-files/mixed-pins.org',
    './test-org-files/complex-filetags.org'
  ]
  
  for (const filePath of testFiles) {
    console.log(`\n=== Testing ${filePath} ===`)
    try {
      const result = await parser.parseOrgFile(filePath)
      console.log('File metadata:', {
        fileTitle: result.fileTitle,
        fileTags: result.fileTags,
        isFilePinned: result.isFilePinned
      })
      console.log('Headlines found:', result.headlines.length)
      console.log('Pinned headlines:', result.pinnedHeadlines.length)
      
      const fileMetadata = {
        fileTitle: result.fileTitle,
        fileTags: result.fileTags,
        isFilePinned: result.isFilePinned
      }
      const pins = parser.convertToPins(filePath, result.pinnedHeadlines, fileMetadata)
      console.log('Total pins generated:', pins.length)
      pins.forEach(pin => {
        console.log(`  - ${pin.pinType}: "${pin.content}" (id: ${pin.id})`)
      })
    } catch (error) {
      console.error('Error:', error.message)
    }
  }
}

testParser().catch(console.error) 
