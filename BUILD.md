# EspressoBar Build Guide

This guide explains how to build distributable binaries for **EspressoBar** on macOS and Linux.

## Prerequisites

- Node.js 18+ 
- npm 8+
- For macOS builds: macOS 10.14+ 
- For Linux builds: Can be built from macOS (cross-platform)

## Build Commands

### Quick Build Commands

```bash
# Build for macOS (Intel + Apple Silicon)
npm run build:mac

# Build for Linux (x64)
npm run build:linux

# Build for Windows (if needed)
npm run build:win
```

### Development Build (for testing)

```bash
# Build without packaging
npm run build

# Test the built app locally
npm run start
```

## Generated Artifacts

### macOS Distributions 📱

**DMG Files (Recommended for distribution):**
- `espressobar-1.0.0-x64.dmg` (112MB) - Intel Macs
- `espressobar-1.0.0-arm64.dmg` (112MB) - Apple Silicon Macs

**ZIP Files (For manual installation):**
- `EspressoBar-1.0.0-mac.zip` (113MB) - Intel Macs  
- `EspressoBar-1.0.0-arm64-mac.zip` (113MB) - Apple Silicon Macs

### Linux Distributions 🐧

**AppImage (Recommended - Portable):**
- `espressobar-1.0.0-x86_64.AppImage` (129MB) - Runs on any Linux distro

**DEB Package (Debian/Ubuntu):**
- `espressobar-1.0.0-amd64.deb` (79MB) - For apt-based systems

**TAR.GZ Archive:**
- `espressobar-1.0.0.tar.gz` (112MB) - Manual extraction

## Installation Instructions

### macOS Installation

1. **Download the DMG** for your architecture:
   - Intel Macs: `espressobar-1.0.0-x64.dmg`
   - Apple Silicon: `espressobar-1.0.0-arm64.dmg`

2. **Install**:
   ```bash
   # Mount and install
   open espressobar-1.0.0-x64.dmg
   # Drag EspressoBar.app to Applications folder
   ```

3. **First Launch**:
   - Right-click → "Open" (to bypass Gatekeeper warning)
   - Grant necessary permissions for file access

### Linux Installation

#### Option 1: AppImage (Recommended)
```bash
# Download and make executable
chmod +x espressobar-1.0.0-x86_64.AppImage

# Run directly
./espressobar-1.0.0-x86_64.AppImage
```

#### Option 2: DEB Package (Ubuntu/Debian)
```bash
# Install via dpkg
sudo dpkg -i espressobar-1.0.0-amd64.deb

# Fix dependencies if needed
sudo apt-get install -f

# Run
espressobar
```

#### Option 3: TAR.GZ (Manual)
```bash
# Extract
tar -xzf espressobar-1.0.0.tar.gz

# Run
cd espressobar-1.0.0/
./espressobar
```

## Code Signing & Distribution

### Current Status
- ✅ **Builds successfully** on macOS for both platforms
- ✅ **Ad-hoc signing** applied (unsigned for public distribution)
- ❌ **No Apple Developer ID** (would need certificates for store distribution)
- ❌ **No notarization** (disabled in config)

### For Production Release

1. **Get Apple Developer Certificate** ($99/year):
   ```bash
   # After getting certificates, update electron-builder.yml:
   # mac:
   #   identity: "Developer ID Application: Your Name"
   #   notarize: true
   ```

2. **Enable Linux Signing** (optional):
   ```bash
   # For more secure Linux distributions
   # Add GPG signing to electron-builder.yml
   ```

## Build Configuration

Key files for build customization:

- **`electron-builder.yml`** - Main build configuration
- **`package.json`** - Build scripts and metadata

### Key Settings

```yaml
# App identification
appId: com.espressobar.app
productName: EspressoBar

# macOS specific
mac:
  category: public.app-category.productivity
  target: [dmg, zip]
  icon: resources/icon.png

# Linux specific  
linux:
  target: [AppImage, deb, tar.gz]
  category: Utility
```

## Troubleshooting

### Common Build Issues

**1. "Cannot find valid Developer ID"**
- Expected for unsigned builds
- Add certificates or keep `notarize: false`

**2. "Resources not found"**
- Ensure `resources/icon.png` exists
- Check `resources/trayTemplate.png` for tray icon

**3. Linux build fails on macOS**
- Normal - cross-compilation warnings are expected
- Final artifacts should still be functional

### File Sizes

If build artifacts are too large:

1. **Enable ASAR compression**:
   ```yaml
   asar: true
   compression: maximum
   ```

2. **Exclude unnecessary files**:
   ```yaml
   files:
     - '!test-org-files'
     - '!docs'
     - '!*.md'
   ```

## Release Workflow

Recommended GitHub release process:

```bash
# 1. Build all platforms
npm run build:mac
npm run build:linux

# 2. Create GitHub release
gh release create v1.0.0 \
  dist/espressobar-1.0.0-x64.dmg \
  dist/espressobar-1.0.0-arm64.dmg \
  dist/espressobar-1.0.0-x86_64.AppImage \
  dist/espressobar-1.0.0-amd64.deb \
  --title "EspressoBar v1.0.0" \
  --notes "Initial release with org-mode integration"
```

---

## Quick Start Summary

```bash
# Clone and setup
git clone https://github.com/yourusername/espressobar.git
cd espressobar
npm install

# Build for your platform
npm run build:mac     # macOS
npm run build:linux   # Linux  

# Check dist/ folder for binaries
ls -la dist/
```

Your EspressoBar is now ready for distribution! 🚀 
