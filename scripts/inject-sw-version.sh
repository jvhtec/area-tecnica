#!/bin/bash
# Post-build script to inject build timestamp into service worker
# This ensures iOS detects the service worker as changed on each deployment

set -e

# Get the build timestamp
BUILD_TIMESTAMP=$(date +%s)

# File path
SW_FILE="dist/sw.js"

if [ -f "$SW_FILE" ]; then
  echo "Injecting build timestamp into service worker: $BUILD_TIMESTAMP"
  
  # Replace __BUILD_TIMESTAMP__ with actual timestamp
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/__BUILD_TIMESTAMP__/$BUILD_TIMESTAMP/g" "$SW_FILE"
  else
    # Linux
    sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TIMESTAMP/g" "$SW_FILE"
  fi
  
  echo "✓ Service worker version injected successfully"
else
  echo "⚠ Warning: Service worker file not found at $SW_FILE"
  exit 1
fi
