#!/bin/bash

# Build and Deploy Script - Builds frontend and starts backend automatically
# Usage: bash build-and-deploy.sh

set -e

echo "🚀 Building Frontend and Starting Backend..."
echo ""

# Navigate to project directory
cd ~/pestisideInventory || cd "$(dirname "$0")"
echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Build React frontend
echo "🔨 Step 1: Building React frontend..."
npm run build

if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "❌ Error: Build failed or build directory not found!"
    exit 1
fi
echo "✅ Frontend build completed"
echo ""

# Step 2: Create logs directory
echo "📁 Step 2: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory ready"
echo ""

# Step 3: Stop old instance if running
echo "🛑 Step 3: Stopping old instance..."
pm2 delete sales-app 2>/dev/null || echo "   No old instance to stop"
echo "✅ Old instance stopped"
echo ""

# Step 4: Start backend with PM2 (backend serves frontend)
echo "▶️  Step 4: Starting backend with PM2..."
pm2 start ecosystem.config.js
sleep 2
echo "✅ Backend started"
echo ""

# Step 5: Save PM2 configuration
echo "💾 Step 5: Saving PM2 configuration..."
pm2 save
echo "✅ PM2 configuration saved"
echo ""

# Step 6: Check status
echo "📊 Step 6: Application Status:"
pm2 status | grep sales-app || pm2 status
echo ""

# Step 7: Test
echo "🧪 Step 7: Testing application..."
sleep 2
if curl -s http://localhost:5002/ > /dev/null; then
    echo "✅ Application is running successfully!"
    echo ""
    echo "📍 Your application is available at:"
    echo "   http://localhost:5002"
    echo "   http://faridagri.devzytic.com (if Nginx configured)"
else
    echo "⚠️  Application may not be responding. Check logs:"
    echo "   pm2 logs sales-app"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ BUILD AND DEPLOY COMPLETED!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    pm2 logs sales-app"
echo "   Restart:      pm2 restart sales-app"
echo "   Status:       pm2 status"
echo ""
