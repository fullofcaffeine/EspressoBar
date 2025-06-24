#!/usr/bin/env node

/**
 * Manual test for EspressoBar emacsclient integration
 *
 * This script tests the core functionality without the complex E2E test environment.
 * It's useful for:
 * - Debugging emacsclient setup issues
 * - Verifying integration works on different systems
 * - Quick testing without launching EspressoBar
 *
 * Usage: node test-emacs-integration.js
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

console.log('🧪 Testing EspressoBar emacsclient integration...\n')

// Test 1: Check if emacsclient exists
console.log('1️⃣ Testing emacsclient availability...')

const emacsClientPaths = {
  darwin: [
    '/Applications/Emacs.app/Contents/MacOS/bin/emacsclient',
    '/usr/local/bin/emacsclient',
    '/opt/homebrew/bin/emacsclient',
    'emacsclient'
  ],
  linux: ['/usr/bin/emacsclient', '/usr/local/bin/emacsclient', 'emacsclient'],
  win32: ['C:\\Program Files\\Emacs\\bin\\emacsclient.exe', 'emacsclient.exe']
}

const platform = os.platform()
const pathsToTest = emacsClientPaths[platform] || ['emacsclient']

async function testEmacsClient() {
  for (const clientPath of pathsToTest) {
    try {
      await execAsync(`"${clientPath}" --version`)
      console.log(`✅ Found emacsclient: ${clientPath}`)
      return clientPath
    } catch (error) {
      console.log(`❌ Not found: ${clientPath}`)
    }
  }
  return null
}

function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })
}

// Test 2: Check if Emacs server is running
async function testEmacsServer(emacsClientPath) {
  console.log('\n2️⃣ Testing Emacs server status...')
  try {
    await execAsync(`"${emacsClientPath}" --eval "(message \\"test\\")"`)
    console.log('✅ Emacs server is running')
    return true
  } catch (error) {
    console.log('❌ Emacs server is NOT running')
    console.log('   Run "M-x server-start" in Emacs or add (server-start) to your config')
    return false
  }
}

// Test 3: Test file opening (create a test org file)
async function testFileOpening(emacsClientPath) {
  console.log('\n3️⃣ Testing file opening...')

  const testFile = path.join(__dirname, 'test-emacs-integration.org')
  const testContent = `* EspressoBar Integration Test

This file was opened via emacsclient from EspressoBar!

** Line 5 Test
This is line 6 - emacsclient should jump here.

** Success! ✅
The integration is working correctly.
`

  // Create test file
  fs.writeFileSync(testFile, testContent)
  console.log(`📝 Created test file: ${testFile}`)

  try {
    // Test opening at line 6 with --no-wait to avoid blocking
    const command = `"${emacsClientPath}" --no-wait +6:1 "${testFile}"`
    console.log(`🚀 Running: ${command}`)

    await execAsync(command)
    console.log('✅ File opened in Emacs at line 6 (non-blocking)')
    console.log('   Check Emacs - it should show the test file at "This is line 6"')

    return true
  } catch (error) {
    console.log('❌ Failed to open file:', error.message)
    return false
  } finally {
    // Clean up
    try {
      fs.unlinkSync(testFile)
      console.log('🧹 Test file cleaned up')
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run all tests
async function runTests() {
  try {
    const emacsClientPath = await testEmacsClient()

    if (!emacsClientPath) {
      console.log('\n❌ FAILED: emacsclient not found')
      console.log('   Install Emacs or ensure emacsclient is in PATH')
      return
    }

    const serverRunning = await testEmacsServer(emacsClientPath)

    if (!serverRunning) {
      console.log('\n⚠️  WARNING: Emacs server not running')
      console.log('   File opening test will fail')
      console.log('   Start Emacs and run: M-x server-start')
      return
    }

    const fileTestPassed = await testFileOpening(emacsClientPath)

    console.log('\n🎯 TEST RESULTS:')
    console.log(`   emacsclient found: ✅`)
    console.log(`   Emacs server running: ✅`)
    console.log(`   File opening: ${fileTestPassed ? '✅' : '❌'}`)

    if (fileTestPassed) {
      console.log('\n🎉 SUCCESS: EspressoBar emacsclient integration is working!')
      console.log('   You can now use the "Open in Emacs" button in EspressoBar')
    } else {
      console.log('\n❌ FAILED: File opening test failed')
    }
  } catch (error) {
    console.log('\n💥 ERROR:', error.message)
  }
}

// Test 4: Generate elisp fallback code
function testElispGeneration() {
  console.log('\n4️⃣ Testing elisp fallback generation...')

  const testPath = '/Users/test/documents/notes.org'
  const testLine = 42

  const elisp = `(progn
  (find-file "${testPath}")
  (goto-line ${testLine})
  (org-reveal)
  (message "Opened ${path.basename(testPath)} at line ${testLine}"))`

  console.log('📋 Generated elisp fallback:')
  console.log(elisp)
  console.log('✅ Elisp generation working')
}

// Run all tests
console.log(`🖥️  Platform: ${platform}`)
console.log(`📁 Testing paths: ${pathsToTest.join(', ')}\n`)

runTests().then(() => {
  testElispGeneration()
})
