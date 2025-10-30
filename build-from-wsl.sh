#!/bin/bash
# ========================================================
# BPSR Meter v2.8.0 - Build from WSL
# ========================================================

echo ""
echo "========================================================"
echo " BPSR Meter v2.8.0 - WSL to Windows Build"
echo "========================================================"
echo ""
echo "This script will:"
echo "1. Copy source to Windows temp directory"
echo "2. Install dependencies on Windows"
echo "3. Build Windows installer"
echo "4. Copy installer back to WSL"
echo ""

# Check if running in WSL
if ! grep -qi microsoft /proc/version; then
    echo "[ERROR] This script must be run in WSL!"
    exit 1
fi

# Find Windows username
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
if [ -z "$WIN_USER" ]; then
    echo "[ERROR] Could not detect Windows username"
    exit 1
fi

echo "Detected Windows user: $WIN_USER"
echo ""

# Set paths
WSL_SOURCE="/development/BPSR-Meter"
WIN_TEMP="/mnt/c/Users/$WIN_USER/AppData/Local/Temp/BPSR-Meter-Build"
WIN_TEMP_WIN="C:\\Users\\$WIN_USER\\AppData\\Local\\Temp\\BPSR-Meter-Build"

echo "[1/5] Cleaning previous build..."
rm -rf "$WIN_TEMP"
mkdir -p "$WIN_TEMP"

echo "[2/5] Copying source to Windows..."
rsync -a --exclude='node_modules' --exclude='dist_electron' --exclude='dist' --exclude='.git' "$WSL_SOURCE/" "$WIN_TEMP/"
echo "✓ Source copied"
echo ""

echo "[3/5] Installing dependencies on Windows..."
cd "$WIN_TEMP"
cmd.exe /c "cd $WIN_TEMP_WIN && pnpm install"
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

echo "[4/5] Building Windows installer..."
cmd.exe /c "cd $WIN_TEMP_WIN && pnpm dist"
if [ $? -ne 0 ]; then
    echo "[ERROR] Build failed"
    exit 1
fi
echo "✓ Build completed"
echo ""

echo "[5/5] Copying installer..."
# Find installer dynamically (version-independent, no spaces in filename)
INSTALLER=$(find "$WIN_TEMP/dist_electron" -name "InfamousBPSRDPSMeter-Setup-*.exe" -type f | head -n 1)
if [ -f "$INSTALLER" ]; then
    BASENAME=$(basename "$INSTALLER")
    
    # Copy to /development
    cp "$INSTALLER" "/development/$BASENAME"
    echo "✓ Copied to: /development/$BASENAME"
    
    # Copy to F:/DPS
    if [ -d "/mnt/f/DPS" ]; then
        cp "$INSTALLER" "/mnt/f/DPS/$BASENAME"
        echo "✓ Copied to: F:/DPS/$BASENAME"
        
        # Also copy latest.yml and .blockmap for auto-updater
        BLOCKMAP="${INSTALLER}.blockmap"
        LATEST_YML="$WIN_TEMP/dist_electron/latest.yml"
        
        if [ -f "$BLOCKMAP" ]; then
            cp "$BLOCKMAP" "/mnt/f/DPS/$(basename "$BLOCKMAP")"
            echo "✓ Copied: $(basename "$BLOCKMAP")"
        fi
        
        if [ -f "$LATEST_YML" ]; then
            cp "$LATEST_YML" "/mnt/f/DPS/latest.yml"
            echo "✓ Copied: latest.yml"
        fi
    else
        echo "⚠ Warning: F:/DPS directory not found, skipping"
    fi
    
else
    echo "[ERROR] Installer not found at: $DIST_DIR"
    echo "Available files:"
    ls -la "$DIST_DIR" 2>/dev/null || echo "  Directory not found"
    exit 1
fi

echo ""
echo "Done!"
