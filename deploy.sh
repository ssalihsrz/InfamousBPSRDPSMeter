#!/bin/bash
# Automated Deployment Script for Infamous BPSR DPS Meter
# Usage: ./deploy.sh <version> [skip-tests]
# Example: ./deploy.sh 3.1.52 or ./deploy.sh 3.1.52 skip-tests

set -e  # Exit on any error

VERSION=$1
SKIP_TESTS=$2

if [ -z "$VERSION" ]; then
    echo "❌ Error: Version number required"
    echo "Usage: ./deploy.sh <version> [skip-tests]"
    echo "Example: ./deploy.sh 3.1.52"
    exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 DEPLOYMENT SCRIPT - v$VERSION"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 0: Update versions in code
echo "📝 Step 0: Updating version strings to $VERSION..."
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$VERSION/g" public/index.html
sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$VERSION/g" public/js/main.js
sed -i "s/let VERSION = '[0-9]\+\.[0-9]\+\.[0-9]\+'/let VERSION = '$VERSION'/" server.js
sed -i "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$VERSION/g" README.md
sed -i "s/[0-9]\+\.[0-9]\+\.[0-9]\+\.exe/$VERSION.exe/g" README.md
echo "✅ Version strings updated"
echo ""

# Run tests if not skipped
if [ "$SKIP_TESTS" != "skip-tests" ]; then
    echo "🧪 Running tests..."
    echo "⚠️  Manual testing required - skipping automated tests"
    echo "   Please verify:"
    echo "   - UI is responsive and draggable"
    echo "   - Sessions load correctly"
    echo "   - Zone changes are logged"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to abort..."
else
    echo "⚠️  Tests skipped"
fi
echo ""

# Step 1: Update Git
echo "📦 Step 1: Committing to Git..."
git add -A
git commit -m "v$VERSION - Automated deployment

Version: $VERSION
Build: $(date +'%Y-%m-%d %H:%M:%S')
"
git push origin main
echo "✅ Git updated"
echo ""

# Step 2: Create Git Tag
echo "🏷️  Step 2: Creating Git tag v$VERSION..."
git tag -a "v$VERSION" -m "Release v$VERSION"
git push origin "v$VERSION"
echo "✅ Git tag created"
echo ""

# Step 3: Build Installer
echo "🔨 Step 3: Building installer..."
echo "   Running: bash build-from-wsl.sh"
bash build-from-wsl.sh
echo "✅ Build completed"
echo ""

# Step 4: Copy to F:\DPS
echo "📋 Step 4: Copying installer to F:\DPS..."
INSTALLER_NAME="InfamousBPSRDPSMeter-Setup-$VERSION.exe"
# Detect Windows username dynamically
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
BUILD_DIR="/mnt/c/Users/$WIN_USER/AppData/Local/Temp/BPSR-Meter-Build/dist_electron"

if [ -f "$BUILD_DIR/$INSTALLER_NAME" ]; then
    cp "$BUILD_DIR/$INSTALLER_NAME" "/mnt/f/DPS/$INSTALLER_NAME"
    cp "$BUILD_DIR/latest.yml" "/mnt/f/DPS/latest.yml"
    echo "✅ Copied to F:\DPS\"
else
    echo "❌ Installer not found at $BUILD_DIR/$INSTALLER_NAME"
    exit 1
fi
echo ""

# Step 5: Create GitHub Release
echo "🎉 Step 5: Creating GitHub release..."
gh release create "v$VERSION" \
    --repo ssalihsrz/InfamousBPSRDPSMeter \
    --title "v$VERSION - Release" \
    --notes "## v$VERSION

**Release Date:** $(date +'%Y-%m-%d')

### Changes in this release
- See commit history for details

### Download
\`$INSTALLER_NAME\` (~90MB)

### Installation
1. Run installer as Administrator
2. Install Npcap if prompted
3. Launch from Start Menu

### Previous Releases
See [Releases Page](https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases)"

echo "✅ GitHub release created"
echo ""

# Step 6: Upload Assets
echo "📤 Step 6: Uploading installer to GitHub..."
gh release upload "v$VERSION" \
    "/mnt/f/DPS/$INSTALLER_NAME" \
    "/mnt/f/DPS/latest.yml" \
    --repo ssalihsrz/InfamousBPSRDPSMeter
echo "✅ Assets uploaded"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ DEPLOYMENT COMPLETE - v$VERSION"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   ✅ Version updated to $VERSION"
echo "   ✅ Code committed and pushed"
echo "   ✅ Git tag v$VERSION created"
echo "   ✅ Installer built: $INSTALLER_NAME"
echo "   ✅ Copied to F:\DPS\"
echo "   ✅ GitHub release created"
echo "   ✅ Assets uploaded"
echo ""
echo "🔗 Release URL:"
echo "   https://github.com/ssalihsrz/InfamousBPSRDPSMeter/releases/tag/v$VERSION"
echo ""
echo "🎉 Ready for distribution!"
