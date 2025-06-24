# Open in Emacs Feature - Technical Reference

> **For basic setup, see the main [README](../README.md). This document covers technical implementation details.**

## Implementation Overview

EspressoBar's "Open in Emacs" feature uses `emacsclient` for direct file opening - replacing the previous org-protocol approach for better reliability and cross-platform support.

## Technical Details

### Command Format

EspressoBar uses this emacsclient command format:

```bash
# Open file at specific line  
emacsclient --no-wait +42:1 /path/to/file.org

# Open file without line specification
emacsclient /path/to/file.org
```

**Key flags:**
- `--no-wait`: Returns immediately without blocking the UI
- `+LINE:COLUMN`: Positions cursor at specific line (column 1)

### Cross-Platform Binary Detection

EspressoBar automatically finds emacsclient in these locations:

**macOS:**
- `/Applications/Emacs.app/Contents/MacOS/bin/emacsclient`
- `/usr/local/bin/emacsclient` (Homebrew Intel)
- `/opt/homebrew/bin/emacsclient` (Homebrew Apple Silicon)

**Linux:**
- `/usr/bin/emacsclient`
- `/usr/local/bin/emacsclient`
- `/snap/bin/emacsclient`

**Windows:**
- `C:\Program Files\Emacs\bin\emacsclient.exe`
- `emacsclient.exe` (if in PATH)

### Error Handling

The integration includes comprehensive error handling:

1. **Binary Detection**: Tests multiple common paths per platform
2. **Server Validation**: Verifies server is accepting connections
3. **Execution Monitoring**: Tracks exit codes and error output
4. **Graceful Fallback**: Provides elisp alternative when needed

### Fallback Mechanism

If emacsclient fails, EspressoBar automatically copies elisp code to clipboard:

```elisp
(progn
  (find-file "/path/to/your/file.org")
  (goto-line 42)
  (org-reveal)
  (message "Opened file.org at line 42"))
```

**Usage:**
1. Paste in Emacs scratch buffer (`C-y`)
2. Evaluate expression (`C-x C-e`)
3. File opens at specified line

## Testing and Debugging

### Integration Test Script

Use the comprehensive test script for debugging:

```bash
node tests/test-emacs-integration.js
```

**Test Coverage:**
- ✅ emacsclient binary detection across platforms
- ✅ Emacs server availability and connectivity  
- ✅ File opening functionality with line positioning
- ✅ Elisp fallback code generation

**Sample Output:**
```
🧪 Testing EspressoBar emacsclient integration...
1️⃣ Testing emacsclient availability...
✅ Found emacsclient: /opt/homebrew/bin/emacsclient

2️⃣ Testing Emacs server status...
✅ Emacs server is running

3️⃣ Testing file opening...
🚀 Running: "/opt/homebrew/bin/emacsclient" --no-wait +6:1 "/path/to/test.org"
✅ File opened in Emacs at line 6 (non-blocking)

🎉 SUCCESS: EspressoBar emacsclient integration is working!
```

### Manual Debugging

**Test emacsclient directly:**
```bash
# Check if available
which emacsclient
emacsclient --version

# Test server connection
emacsclient --eval "(message \"test\")"

# Test file opening
emacsclient --no-wait +1:1 /path/to/test-file.org
```

**Check Emacs server status:**
```elisp
;; In Emacs
(server-running-p)          ; Should return non-nil
(server-start)              ; Start if not running
```

## Implementation Files

- `src/main/services/emacsService.ts` - Core emacsclient integration
- `src/renderer/components/PinDetailModal.tsx` - UI with "Open in Emacs" button
- `tests/test-emacs-integration.js` - Integration test script
- `src/preload/index.ts` - IPC bridge for emacsclient calls

## Advanced Configuration

### Custom Emacs Server

For custom server setups:

```elisp
;; Custom server with specific name
(setq server-name "espressobar-server")
(server-start)
```

### Doom Emacs Integration

Enhance integration in Doom config:

```elisp
;; In config.el
(after! server
  (server-start))

;; Optional: Auto-reveal folded org content
(after! org
  (setq org-startup-folded 'content))
```

## Migration from org-protocol

EspressoBar v2.0+ uses emacsclient instead of org-protocol. Benefits:

✅ **No URL scheme registration required**
✅ **Works across all platforms consistently**  
✅ **More reliable - direct binary execution**
✅ **Better error handling and debugging**
✅ **Simpler setup - just ensure server is running**

If you have old org-protocol setup, it can be safely removed.
