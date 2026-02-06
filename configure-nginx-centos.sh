#!/bin/bash

# Nginx Configuration for CentOS/RHEL
# This script configures Nginx for faridagri.devzytic.com on CentOS/RHEL systems

set -e

echo "🌐 Configuring Nginx for faridagri.devzytic.com"
echo ""

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    yum install -y nginx
    systemctl enable nginx
    systemctl start nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx is already installed"
fi

echo ""
echo "📝 Creating Nginx configuration..."

# On CentOS/RHEL, use /etc/nginx/conf.d/ instead of sites-available
CONFIG_FILE="/etc/nginx/conf.d/faridagri.devzytic.com.conf"

# Create the configuration file
cat > /tmp/nginx_config.conf <<'EOF'
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
EOF

# Copy to the correct location
cp /tmp/nginx_config.conf $CONFIG_FILE
rm /tmp/nginx_config.conf

echo "✅ Configuration file created at: $CONFIG_FILE"

# Test Nginx configuration
echo ""
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload Nginx
    echo ""
    echo "🔄 Reloading Nginx..."
    systemctl reload nginx
    echo "✅ Nginx reloaded"
    
    echo ""
    echo "✅ Domain configuration completed!"
    echo ""
    echo "🌐 Your application should now be accessible at:"
    echo "   http://faridagri.devzytic.com"
    echo ""
    echo "📋 To verify:"
    echo "   curl http://faridagri.devzytic.com"
    echo "   curl http://faridagri.devzytic.com/api"
    echo ""
    echo "📊 Check Nginx status:"
    echo "   systemctl status nginx"
else
    echo "❌ Nginx configuration test failed!"
    echo "Please check the configuration file:"
    echo "   cat $CONFIG_FILE"
    exit 1
fi
