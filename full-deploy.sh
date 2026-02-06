#!/bin/bash

# Full Deployment Script - Remove old site and deploy new one
# Run: bash full-deploy.sh

set -e

echo "🚀 Starting full deployment for faridagri.devzytic.com"
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

# Step 2: Check if port 5002 is free
echo "🔍 Step 2: Checking port 5002..."
if lsof -i :5002 &>/dev/null; then
    echo "⚠️  Port 5002 is in use. Checking what's using it..."
    lsof -i :5002
    echo "   Please stop the application using port 5002 or change the port in ecosystem.config.js"
    exit 1
else
    echo "✅ Port 5002 is available"
fi
echo ""

# Step 3: Pull latest code
echo "📥 Step 3: Pulling latest code..."
git stash 2>/dev/null || true
git pull || echo "⚠️  Git pull failed, continuing with current code..."
echo "✅ Code updated"
echo ""

# Step 4: Install dependencies
echo "📦 Step 4: Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Step 5: Build React application
echo "🔨 Step 5: Building React application..."
npm run build

if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "❌ Error: Build failed or build directory not found!"
    exit 1
fi
echo "✅ Build completed successfully"
echo ""

# Step 6: Create logs directory
echo "📁 Step 6: Creating logs directory..."
mkdir -p logs
echo "✅ Logs directory ready"
echo ""

# Step 7: Verify ecosystem.config.js
echo "🔍 Step 7: Verifying configuration..."
if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ Error: ecosystem.config.js not found!"
    exit 1
fi

# Remove any comments from env section (fix for JSON parsing)
sed -i 's|SERVE_FRONTEND: .*true.*//.*|SERVE_FRONTEND: '\''true'\''|' ecosystem.config.js 2>/dev/null || true
echo "✅ Configuration verified"
echo ""

# Step 8: Start application with PM2
echo "▶️  Step 8: Starting application with PM2..."
pm2 start ecosystem.config.js
sleep 2
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
else
    echo "⚠️  Application may not be responding. Check logs: pm2 logs sales-app"
fi
echo ""

# Step 12: Configure Nginx
echo "🌐 Step 12: Configuring Nginx..."
if command -v nginx &> /dev/null; then
    # Create Nginx config
    sudo tee /etc/nginx/sites-available/faridagri.devzytic.com > /dev/null <<'NGINX_EOF'
server {
    listen 80;
    server_name faridagri.devzytic.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/faridagri.devzytic.com.access.log;
    error_log /var/log/nginx/faridagri.devzytic.com.error.log;
}
NGINX_EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/faridagri.devzytic.com /etc/nginx/sites-enabled/
    
    # Test and reload Nginx
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx
        echo "✅ Nginx configured and reloaded"
    else
        echo "⚠️  Nginx configuration test failed. Please check manually:"
        echo "   sudo nginx -t"
    fi
else
    echo "⚠️  Nginx not installed. Install it to configure the domain:"
    echo "   sudo yum install nginx  # CentOS/RHEL"
    echo "   sudo apt-get install nginx  # Ubuntu/Debian"
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
echo "   Local: http://localhost:5002"
echo "   Domain: http://faridagri.devzytic.com (if Nginx configured)"
echo ""
echo "📋 Useful commands:"
echo "   View logs:    pm2 logs sales-app"
echo "   Restart:      pm2 restart sales-app"
echo "   Stop:         pm2 stop sales-app"
echo "   Status:       pm2 status"
echo ""
echo "🧪 Test your application:"
echo "   curl http://localhost:5002/"
echo "   curl http://localhost:5002/api"
echo ""
