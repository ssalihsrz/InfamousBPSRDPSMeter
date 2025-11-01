#!/bin/bash
# Version Consistency Checker
# Ensures all version strings match package.json before building

set -e

echo "🔍 Checking version consistency..."

# Get version from package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo "📦 package.json version: $PACKAGE_VERSION"

# Define all files that should contain the version
declare -A VERSION_CHECKS=(
    ["server.js"]="let VERSION = '$PACKAGE_VERSION'"
    ["public/index.html"]="<title>Infamous BPSR DPS Meter v$PACKAGE_VERSION</title>"
    ["public/index.html"]="<span class=\"app-name\">Infamous BPSR DPS Meter v$PACKAGE_VERSION</span>"
    ["public/index.html"]="<span style=\"color:var(--accent-gold);font-size:11px\">v$PACKAGE_VERSION</span>"
)

# Check for version mismatches
ERRORS=0

echo ""
echo "Checking version strings..."

# Check server.js
if ! grep -q "let VERSION = '$PACKAGE_VERSION'" server.js; then
    echo "❌ server.js VERSION constant doesn't match $PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ server.js"
fi

# Check public/index.html title
if ! grep -q "<title>Infamous BPSR DPS Meter v$PACKAGE_VERSION</title>" public/index.html; then
    echo "❌ public/index.html <title> doesn't match v$PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ public/index.html <title>"
fi

# Check public/index.html title bar
if ! grep -q "Infamous BPSR DPS Meter v$PACKAGE_VERSION</span>" public/index.html; then
    echo "❌ public/index.html title bar doesn't match v$PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ public/index.html title bar"
fi

# Check CSS cache-busting params
if grep -q "\.css?v=$PACKAGE_VERSION" public/index.html && \
   grep -q "\.css?v=$PACKAGE_VERSION" public/settings-popup.html && \
   grep -q "\.css?v=$PACKAGE_VERSION" public/session-manager-popup.html; then
    echo "✓ CSS cache-busting parameters"
else
    echo "❌ CSS cache-busting parameters don't all match v$PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
fi

# Check currentVersion constants in JS files
if grep -q "const currentVersion = '$PACKAGE_VERSION'" public/js/main.js; then
    echo "✓ public/js/main.js currentVersion"
else
    echo "❌ public/js/main.js currentVersion doesn't match $PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "const currentVersion = '$PACKAGE_VERSION'" public/js/settings-popup.js; then
    echo "✓ public/js/settings-popup.js currentVersion"
else
    echo "❌ public/js/settings-popup.js currentVersion doesn't match $PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
fi

# Check console logs
if grep -q "Infamous BPSR DPS Meter v$PACKAGE_VERSION - Initializing" public/js/main.js; then
    echo "✓ public/js/main.js init log"
else
    echo "❌ public/js/main.js init log doesn't match v$PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "Infamous BPSR DPS Meter v$PACKAGE_VERSION - Ready" public/js/main.js; then
    echo "✓ public/js/main.js ready log"
else
    echo "❌ public/js/main.js ready log doesn't match v$PACKAGE_VERSION"
    ERRORS=$((ERRORS + 1))
fi

echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ Found $ERRORS version inconsistencies!"
    echo ""
    echo "Run this command to see all version strings:"
    echo "  grep -r \"v4\\.1\\.\" public/ server.js package.json | grep -v node_modules | grep -v .git"
    echo ""
    echo "Or follow the workflow:"
    echo "  cat .windsurf/workflows/version-bump.md"
    exit 1
else
    echo "✅ All version strings are consistent!"
    exit 0
fi
