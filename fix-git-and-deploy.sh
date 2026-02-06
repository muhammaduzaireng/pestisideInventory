#!/bin/bash

# Fix git conflicts and deploy
# Run this on your server: bash fix-git-and-deploy.sh

set -e

echo "🔧 Fixing git conflicts..."

# Stash local changes to package.json and package-lock.json
echo "📦 Stashing local changes..."
git stash

# Pull latest code
echo "⬇️  Pulling latest code..."
git pull

# If you want to keep your local changes, uncomment the next line:
# git stash pop

echo "✅ Git conflicts resolved!"
echo ""
echo "🚀 Now running deployment..."

# Navigate to project directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build React application
echo "🔨 Building React application..."
npm run build

# Verify build exists
if [ ! -d "build" ]; then
    echo "❌ Error: build directory not found!"
    exit 1
fi

echo "✅ Build completed successfully"

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📥 Installing PM2 globally..."
    npm install -g pm2
else
    echo "✅ PM2 is already installed"
fi

# Stop any existing PM2 processes
echo "🛑 Stopping existing PM2 processes..."
pm2 delete all 2>/dev/null || true

# Start application with PM2
echo "▶️  Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Show status
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
