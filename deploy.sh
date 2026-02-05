#!/bin/bash

# Deployment script for Sales Application
# Run this script on your server: bash deploy.sh

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Navigate to project directory
cd "$(dirname "$0")"
echo "📍 Current directory: $(pwd)"

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Build React application
echo "🔨 Building React application..."
npm run build

# Step 3: Verify build exists
if [ ! -d "build" ]; then
    echo "❌ Error: build directory not found!"
    exit 1
fi

echo "✅ Build completed successfully"

# Step 4: Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Step 5: Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2 globally..."
    npm install -g pm2
else
    echo "✅ PM2 is already installed"
fi

# Step 6: Stop any existing PM2 processes
echo "🛑 Stopping existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Step 7: Start application with PM2
echo "▶️  Starting application with PM2..."
pm2 start ecosystem.config.js

# Step 8: Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Step 9: Show status
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    pm2 logs sales-app"
echo "   Restart:      pm2 restart sales-app"
echo "   Stop:         pm2 stop sales-app"
echo "   Status:       pm2 status"
echo ""
echo "🌐 Your application should be running on port 5002"
echo "   Test it: curl http://localhost:5002/"
