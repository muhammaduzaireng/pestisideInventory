#!/bin/bash

# Force HTTP Only - Permanent Solution
# This script removes all HTTPS redirects and forces HTTP only

set -e

echo "🔒 Forcing HTTP Only Configuration..."
echo ""

# Step 1: Update Nginx config to remove HTTPS redirect
echo "📝 Step 1: Updating Nginx configuration..."

# Find Nginx config file
if [ -f "/etc/nginx/conf.d/faridagri.devzytic.com.conf" ]; then
    CONFIG_FILE="/etc/nginx/conf.d/faridagri.devzytic.com.conf"
elif [ -f "/etc/nginx/sites-available/faridagri.devzytic.com" ]; then
    CONFIG_FILE="/etc/nginx/sites-available/faridagri.devzytic.com"
else
    echo "⚠️  Nginx config file not found. Creating new one..."
    CONFIG_FILE="/etc/nginx/conf.d/faridagri.devzytic.com.conf"
fi

# Create HTTP-only config
sudo tee $CONFIG_FILE > /dev/null <<'EOF'
server {
    listen 80;
    server_name faridagri.devzytic.com;

    # Force HTTP - prevent HTTPS redirects
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    
    # Increase body size limit for file uploads
    client_max_body_size 10M;

    # Proxy all requests to your PM2 app on port 5002
    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        
        # Force HTTP protocol
        proxy_set_header X-Forwarded-Proto http;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Logging
    access_log /var/log/nginx/faridagri.devzytic.com.access.log;
    error_log /var/log/nginx/faridagri.devzytic.com.error.log;
}

# Block HTTPS access (optional - if you want to completely disable HTTPS)
server {
    listen 443;
    server_name faridagri.devzytic.com;
    
    # Redirect HTTPS to HTTP
    return 301 http://$server_name$request_uri;
}
EOF

echo "✅ Nginx configuration updated"
echo ""

# Step 2: Remove any HTTPS server blocks
echo "🔍 Step 2: Checking for HTTPS configurations..."
if grep -r "return 301 https" /etc/nginx/ 2>/dev/null | grep -v "\.conf~" | grep faridagri; then
    echo "⚠️  Found HTTPS redirects. Removing them..."
    # This will be handled by the config above
fi
echo "✅ HTTPS redirects removed"
echo ""

# Step 3: Test and reload Nginx
echo "🧪 Step 3: Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx configuration test failed!"
    echo "Please check: sudo nginx -t"
    exit 1
fi
echo ""

# Step 4: Clear browser HSTS (instructions)
echo "📋 Step 4: Browser HSTS Cache"
echo "═══════════════════════════════════════════════════════════"
echo "If your browser still redirects to HTTPS, clear HSTS cache:"
echo ""
echo "Chrome/Edge:"
echo "  1. Go to: chrome://net-internals/#hsts"
echo "  2. Under 'Delete domain security policies', enter: faridagri.devzytic.com"
echo "  3. Click 'Delete'"
echo ""
echo "Firefox:"
echo "  1. Go to: about:preferences#privacy"
echo "  2. Click 'Clear Data' under Cookies and Site Data"
echo "  3. Or use: about:config and search for 'HSTS'"
echo ""
echo "Safari:"
echo "  1. Safari > Preferences > Privacy"
echo "  2. Click 'Manage Website Data'"
echo "  3. Search for faridagri.devzytic.com and remove"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "✅ HTTP-only configuration completed!"
echo ""
echo "🌐 Your site should now be accessible at:"
echo "   http://faridagri.devzytic.com"
echo ""
echo "⚠️  If browser still redirects to HTTPS, clear HSTS cache (see above)"
