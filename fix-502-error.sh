#!/bin/bash

# Fix 502 Bad Gateway Error
# This script checks and fixes common 502 issues

echo "🔍 Diagnosing 502 Bad Gateway Error..."
echo ""

# Step 1: Check if PM2 app is running
echo "📊 Step 1: Checking PM2 status..."
pm2 status

if ! pm2 list | grep -q "sales-app.*online"; then
    echo "❌ sales-app is not running!"
    echo ""
    echo "▶️  Starting the app..."
    cd ~/pestisideInventory
    pm2 start sales-app-backend/server.js --name sales-app
    pm2 save
    sleep 2
    echo "✅ App started"
else
    echo "✅ sales-app is running"
fi
echo ""

# Step 2: Check if app is responding on port 5002
echo "🧪 Step 2: Testing backend on port 5002..."
if curl -s http://localhost:5002/api/health > /dev/null; then
    echo "✅ Backend is responding on port 5002"
    curl -s http://localhost:5002/api/health | head -c 100
    echo "..."
else
    echo "❌ Backend is NOT responding on port 5002"
    echo "   Check PM2 logs: pm2 logs sales-app"
fi
echo ""

# Step 3: Check what's using port 5002
echo "🔍 Step 3: Checking port 5002..."
if lsof -i :5002 &>/dev/null; then
    echo "✅ Port 5002 is in use:"
    lsof -i :5002
else
    echo "❌ Nothing is listening on port 5002"
    echo "   The app might not have started correctly"
fi
echo ""

# Step 4: Check Nginx configuration
echo "📝 Step 4: Checking Nginx configuration..."
if [ -f "/etc/nginx/conf.d/faridagri.devzytic.com.conf" ]; then
    CONFIG_FILE="/etc/nginx/conf.d/faridagri.devzytic.com.conf"
elif [ -f "/etc/nginx/sites-available/faridagri.devzytic.com" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/faridagri.devzytic.com"
else
    echo "⚠️  Nginx config file not found"
    CONFIG_FILE=""
fi

if [ -n "$CONFIG_FILE" ]; then
    echo "📍 Config file: $CONFIG_FILE"
    echo ""
    echo "Current proxy_pass setting:"
    grep -A 2 "proxy_pass" $CONFIG_FILE || echo "   proxy_pass not found!"
    echo ""
    
    # Check if it's pointing to the right port
    if grep -q "proxy_pass http://localhost:5002" $CONFIG_FILE; then
        echo "✅ Nginx is configured to proxy to port 5002"
    else
        echo "❌ Nginx is NOT configured to proxy to port 5002"
        echo "   It should have: proxy_pass http://localhost:5002;"
    fi
fi
echo ""

# Step 5: Test Nginx configuration
echo "🧪 Step 5: Testing Nginx configuration..."
if sudo nginx -t 2>&1; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
fi
echo ""

# Step 6: Check Nginx status
echo "📊 Step 6: Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is NOT running"
    echo "   Start it with: sudo systemctl start nginx"
fi
echo ""

# Step 7: Recommendations
echo "═══════════════════════════════════════════════════════════"
echo "💡 RECOMMENDATIONS:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Make sure PM2 app is running:"
echo "   pm2 status"
echo "   pm2 logs sales-app"
echo ""
echo "2. Test backend directly:"
echo "   curl http://localhost:5002/api/health"
echo ""
echo "3. Check Nginx config:"
echo "   sudo cat $CONFIG_FILE"
echo ""
echo "4. Reload Nginx after fixing:"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "5. If using HTTPS, make sure Nginx HTTPS config proxies to:"
echo "   proxy_pass http://localhost:5002;"
echo ""
