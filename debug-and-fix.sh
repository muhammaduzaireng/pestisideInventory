#!/bin/bash

# Debug and Fix Script for sales-app

echo "🔍 Debugging sales-app error..."
echo ""

# Check error logs
echo "📋 Error Logs:"
pm2 logs sales-app --err --lines 50 --nostream

echo ""
echo "📋 All Logs (last 50 lines):"
pm2 logs sales-app --lines 50 --nostream

echo ""
echo "📋 Log Files:"
if [ -f "logs/app-error.log" ]; then
    echo "=== Error Log ==="
    tail -50 logs/app-error.log
fi

if [ -f "logs/app-out.log" ]; then
    echo ""
    echo "=== Output Log ==="
    tail -50 logs/app-out.log
fi

echo ""
echo "📊 PM2 Info:"
pm2 show sales-app

echo ""
echo "🔍 Checking common issues..."

# Check if build exists
echo ""
echo "1. Checking build directory:"
if [ -d "build" ] && [ -f "build/index.html" ]; then
    echo "   ✅ Build directory exists"
    ls -la build/ | head -5
else
    echo "   ❌ Build directory missing!"
    echo "   Run: npm run build"
fi

# Check if server.js exists
echo ""
echo "2. Checking server file:"
if [ -f "sales-app-backend/server.js" ]; then
    echo "   ✅ server.js exists"
else
    echo "   ❌ server.js missing!"
fi

# Check if port is in use
echo ""
echo "3. Checking port 5002:"
if lsof -i :5002 &>/dev/null; then
    echo "   ⚠️  Port 5002 is in use:"
    lsof -i :5002
    echo ""
    echo "   farid-agri-api might be using port 5002"
    echo "   Check: pm2 show farid-agri-api"
else
    echo "   ✅ Port 5002 is available"
fi

# Try running manually
echo ""
echo "4. Testing manual run:"
cd ~/pestisideInventory
echo "   Attempting to run server.js manually..."
timeout 5 node sales-app-backend/server.js 2>&1 || echo "   Server startup output shown above"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "💡 Suggested fixes:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "If port 5002 is in use by farid-agri-api:"
echo "   Option 1: Stop farid-agri-api"
echo "      pm2 stop farid-agri-api"
echo ""
echo "   Option 2: Change sales-app port to 5003"
echo "      Edit ecosystem.config.js: PORT: 5003"
echo ""
echo "If build is missing:"
echo "   npm run build"
echo ""
echo "If dependencies are missing:"
echo "   npm install"
echo ""
