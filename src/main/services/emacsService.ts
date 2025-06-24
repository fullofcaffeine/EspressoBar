import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

export interface OpenInEmacsResult {
  success: boolean
  error?: string
}

export class EmacsService {
  private emacsClientPaths: string[] = []

  constructor() {
    this.initializeEmacsClientPaths()
  }

  /**
   * Initialize common emacsclient paths for different platforms
   */
  private initializeEmacsClientPaths(): void {
    const platform = os.platform()

    switch (platform) {
      case 'darwin': // macOS
        this.emacsClientPaths = [
          '/Applications/Emacs.app/Contents/MacOS/bin/emacsclient',
          '/usr/local/bin/emacsclient',
          '/opt/homebrew/bin/emacsclient',
          '/usr/bin/emacsclient',
          'emacsclient' // PATH lookup
        ]
        break

      case 'linux':
        this.emacsClientPaths = [
          '/usr/bin/emacsclient',
          '/usr/local/bin/emacsclient',
          '/snap/bin/emacsclient',
          'emacsclient' // PATH lookup
        ]
        break

      case 'win32': // Windows
        this.emacsClientPaths = [
          'C:\\Program Files\\Emacs\\bin\\emacsclient.exe',
          'C:\\emacs\\bin\\emacsclient.exe',
          'emacsclient.exe' // PATH lookup
        ]
        break

      default:
        this.emacsClientPaths = ['emacsclient']
    }
  }

  /**
   * Find the first working emacsclient binary
   */
  private async findEmacsClient(): Promise<string | null> {
    for (const clientPath of this.emacsClientPaths) {
      try {
        // Test if emacsclient exists and can be executed
        await execAsync(`"${clientPath}" --version`)
        console.log(`✅ Found emacsclient at: ${clientPath}`)
        return clientPath
      } catch (error) {
        // Continue to next path
        continue
      }
    }

    console.log('❌ No working emacsclient found in common locations')
    return null
  }

  /**
   * Check if Emacs server is running
   */
  private async isEmacsServerRunning(emacsClientPath: string): Promise<boolean> {
    try {
      // Try to connect to the server with a quick eval
      await execAsync(`"${emacsClientPath}" --eval "(message \\"server-test\\")"`)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Open file in Emacs at specific line using emacsclient
   */
  async openInEmacs(filePath: string, lineNumber?: number): Promise<OpenInEmacsResult> {
    console.log(
      `📝 Attempting to open ${filePath}${lineNumber ? ` at line ${lineNumber}` : ''} in Emacs...`
    )

    try {
      // Step 1: Find emacsclient
      const emacsClientPath = await this.findEmacsClient()
      if (!emacsClientPath) {
        return {
          success: false,
          error:
            'emacsclient not found. Please ensure Emacs is installed and emacsclient is available in PATH.'
        }
      }

      // Step 2: Check if Emacs server is running
      const isServerRunning = await this.isEmacsServerRunning(emacsClientPath)
      if (!isServerRunning) {
        // Try to start the server
        console.log('🔄 Emacs server not running, attempting to start it...')
        try {
          await execAsync(`"${emacsClientPath}" --eval "(server-start)"`)
          // Give it a moment to start
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          return {
            success: false,
            error:
              'Emacs server is not running. Please start Emacs and run M-x server-start, or add (server-start) to your init file.'
          }
        }
      }

      // Step 3: Build the command
      let command: string[]
      if (lineNumber && lineNumber > 0) {
        // Open file at specific line: emacsclient --no-wait +LINE:1 /path/to/file
        command = [emacsClientPath, '--no-wait', `+${lineNumber}:1`, filePath]
      } else {
        // Open file without line specification
        command = [emacsClientPath, '--no-wait', filePath]
      }

      // Step 4: Execute emacsclient
      console.log(`🚀 Executing: ${command.join(' ')}`)

      return new Promise((resolve) => {
        const child = spawn(command[0], command.slice(1), {
          detached: true,
          stdio: 'ignore'
        })

        child.on('error', (error) => {
          console.error('❌ emacsclient execution failed:', error)
          resolve({
            success: false,
            error: `Failed to execute emacsclient: ${error.message}`
          })
        })

        child.on('exit', (code) => {
          if (code === 0) {
            console.log('✅ Successfully opened file in Emacs')
            resolve({ success: true })
          } else {
            console.error(`❌ emacsclient exited with code ${code}`)
            resolve({
              success: false,
              error: `emacsclient exited with code ${code}. Check if Emacs server is running.`
            })
          }
        })

        // Detach the process so it doesn't block Electron
        child.unref()
      })
    } catch (error) {
      console.error('❌ Error opening file in Emacs:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Generate elisp code as fallback (for manual execution)
   */
  generateElispCode(filePath: string, lineNumber?: number): string {
    if (lineNumber && lineNumber > 0) {
      return `(progn
  (find-file "${filePath}")
  (goto-line ${lineNumber})
  (org-reveal)
  (message "Opened ${path.basename(filePath)} at line ${lineNumber}"))`
    } else {
      return `(progn
  (find-file "${filePath}")
  (org-reveal)
  (message "Opened ${path.basename(filePath)}"))`
    }
  }

  /**
   * Get installation instructions for the current platform
   */
  getInstallationInstructions(): string {
    const platform = os.platform()

    switch (platform) {
      case 'darwin':
        return `To install Emacs on macOS:
1. Homebrew: brew install emacs
2. Emacs for Mac OS X: https://emacsformacosx.com
3. Doom Emacs: Make sure emacsclient is in PATH`

      case 'linux':
        return `To install Emacs on Linux:
1. Ubuntu/Debian: sudo apt install emacs
2. CentOS/RHEL: sudo yum install emacs
3. Arch: sudo pacman -S emacs`

      case 'win32':
        return `To install Emacs on Windows:
1. Download from: https://www.gnu.org/software/emacs/download.html
2. Chocolatey: choco install emacs
3. Ensure emacsclient.exe is in PATH`

      default:
        return 'Please install Emacs and ensure emacsclient is available in PATH'
    }
  }
}
