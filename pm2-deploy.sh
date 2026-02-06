#!/bin/bash

# Simple PM2-only Deployment Script
# No Nginx required - app runs directly on port 5002

set -e

echo "🚀 PM2-Only Deployment for faridagri.devzytic.com"
echo ""

# Navigate to project directory
cd ~/pestisideInventory || cd "$(dirname "$0")"
echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Stop and remove old applications
echo "🛑 Step 1: Stopping old applications..."
pm2 stop farid-agri-api 2>/dev/null || echo "   farid-agri-api not running"
pm2 stop sales-app 2>/dev/null || echo "   sales-app not running"
pm2 delete farid-agri-api 2>/dev/null || echo "   farid-agri-api not found"
pm2 delete sales-app 2>/dev/null || echo "   sales-app not found"
echo "✅ Old applications stopped"
echo ""

# Step 2: Pull latest code
echo "📥 Step 2: Pulling latest code..."
git stash 2>/dev/null || true
git pull || echo "⚠️  Git pull failed, continuing with current code..."
echo "✅ Code updated"
echo ""

# Step 3: Install dependencies
echo "📦 Step 3: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 4: Build React application
echo "🔨 Step 4: Building React application..."
npm run build

if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "❌ Error: Build failed or build directory not found!"
    exit 1
fi
echo "✅ Build completed successfully"
echo ""

# Step 5: Create logs directory
echo "📁 Step 5: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory ready"
echo ""

# Step 6: Verify ecosystem.config.js
echo "🔍 Step 6: Verifying configuration..."
if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ Error: ecosystem.config.js not found!"
    exit 1
fi
echo "✅ Configuration file found"
echo ""

# Step 7: Check if port 5002 is available
echo "🔍 Step 7: Checking port 5002..."
if lsof -i :5002 &>/dev/null; then
    echo "⚠️  Port 5002 is in use. Checking what's using it..."
    lsof -i :5002
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Port 5002 is available"
fi
echo ""

# Step 8: Start application with PM2
echo "▶️  Step 8: Starting application with PM2..."
pm2 start ecosystem.config.js
sleep 3
echo "✅ Application started"
echo ""

# Step 9: Check status
echo "📊 Step 9: Checking application status..."
pm2 status

# Check if app is running
if pm2 list | grep -q "sales-app.*online"; then
    echo "✅ Application is running successfully!"
else
    echo "❌ Application failed to start. Checking logs..."
    pm2 logs sales-app --err --lines 20 --nostream
    echo ""
    echo "Please check the logs above for errors"
    exit 1
fi
echo ""

# Step 10: Save PM2 configuration
echo "💾 Step 10: Saving PM2 configuration..."
pm2 save
echo "✅ PM2 configuration saved"
echo ""

# Step 11: Test the application
echo "🧪 Step 11: Testing application..."
sleep 2
if curl -s http://localhost:5002/ > /dev/null; then
    echo "✅ Application is responding on port 5002"
    echo ""
    echo "📍 Test endpoints:"
    curl -s http://localhost:5002/ | head -c 100
    echo "..."
    echo ""
    curl -s http://localhost:5002/api | head -c 100
    echo "..."
else
    echo "⚠️  Application may not be responding. Check logs: pm2 logs sales-app"
fi
echo ""

# Final summary
echo "═══════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETED!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 Application Status:"
pm2 status | grep sales-app
echo ""
echo "🌐 Your application is running on:"
echo "   http://localhost:5002"
echo "   http://YOUR_SERVER_IP:5002"
echo ""
echo "📝 To access via domain (faridagri.devzytic.com:5002):"
echo "   1. Make sure your domain DNS points to your server IP"
echo "   2. Access via: http://faridagri.devzytic.com:5002"
echo ""
echo "📋 Useful PM2 commands:"
echo "   View logs:    pm2 logs sales-app"
echo "   Restart:      pm2 restart sales-app"
echo "   Stop:         pm2 stop sales-app"
echo "   Status:       pm2 status"
echo "   Monitor:      pm2 monit"
echo ""
echo "🧪 Test your application:"
echo "   curl http://localhost:5002/"
echo "   curl http://localhost:5002/api"
echo ""
