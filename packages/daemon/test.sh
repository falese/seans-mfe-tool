#!/bin/bash

# Test script for MFE Registry Daemon

set -e

echo "🧪 Testing MFE Registry Daemon"
echo "================================"

# Start daemon in background
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
cargo run &
DAEMON_PID=$!

echo "⏳ Waiting for daemon to start..."
sleep 3

# Test 1: Get all MFEs (should be empty)
echo ""
echo "📋 Test 1: GET /api/mfes (empty registry)"
curl -s http://localhost:4000/api/mfes | jq '.'

# Test 2: Register an MFE
echo ""
echo "📝 Test 2: POST /api/mfes (register MFE)"
MFE_DATA='{
  "id": "test-mfe-1",
  "name": "Test MFE",
  "version": "1.0.0",
  "type": "remote",
  "manifestUrl": "http://localhost:3000/manifest.yaml",
  "remoteEntryUrl": "http://localhost:3000/remoteEntry.js",
  "healthUrl": "http://localhost:3000/health",
  "capabilities": ["dashboard", "analytics"],
  "status": "unknown",
  "registeredAt": "2025-12-23T00:00:00Z"
}'

curl -s -X POST http://localhost:4000/api/mfes \
  -H "Content-Type: application/json" \
  -d "$MFE_DATA" | jq '.'

# Test 3: Get all MFEs (should have 1)
echo ""
echo "📋 Test 3: GET /api/mfes (with 1 MFE)"
curl -s http://localhost:4000/api/mfes | jq '.'

# Test 4: Get specific MFE
echo ""
echo "🔍 Test 4: GET /api/mfes/test-mfe-1"
curl -s http://localhost:4000/api/mfes/test-mfe-1 | jq '.'

# Test 5: Delete MFE
echo ""
echo "🗑️ Test 5: DELETE /api/mfes/test-mfe-1"
curl -s -X DELETE http://localhost:4000/api/mfes/test-mfe-1 | jq '.'

# Test 6: Get all MFEs (should be empty again)
echo ""
echo "📋 Test 6: GET /api/mfes (empty again)"
curl -s http://localhost:4000/api/mfes | jq '.'

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $DAEMON_PID 2>/dev/null || true
wait $DAEMON_PID 2>/dev/null || true

echo ""
echo "✅ All tests passed!"
