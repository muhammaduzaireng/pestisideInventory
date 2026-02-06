#!/bin/bash

# Domain Configuration Script for faridagri.devzytic.com
# This script helps configure Nginx to point your domain to the application

set -e

echo "🌐 Configuring domain: faridagri.devzytic.com"
echo ""

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed."
    echo ""
    echo "📦 Installing Nginx..."
    
    # Detect OS and install
    if [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        sudo yum install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
    elif [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        sudo apt-get update
        sudo apt-get install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
    else
        echo "❌ Could not detect OS. Please install Nginx manually."
        exit 1
    fi
    echo "✅ Nginx installed"
else
    echo "✅ Nginx is already installed"
fi

echo ""
echo "📝 Creating Nginx configuration..."

# Create Nginx config file
sudo tee /etc/nginx/sites-available/faridagri.devzytic.com > /dev/null <<EOF
server {
    listen 80;
    server_name faridagri.devzytic.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/faridagri.devzytic.com.access.log;
    error_log /var/log/nginx/faridagri.devzytic.com.error.log;
}
EOF

echo "✅ Configuration file created"

# Create symlink to enable the site
echo ""
echo "🔗 Enabling site..."
if [ -L /etc/nginx/sites-enabled/faridagri.devzytic.com ]; then
    echo "⚠️  Symlink already exists, removing old one..."
    sudo rm /etc/nginx/sites-enabled/faridagri.devzytic.com
fi

sudo ln -s /etc/nginx/sites-available/faridagri.devzytic.com /etc/nginx/sites-enabled/

echo "✅ Site enabled"

# Test Nginx configuration
echo ""
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    
    # Reload Nginx
    echo ""
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
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
    echo "   sudo systemctl status nginx"
    echo ""
    echo "📝 View Nginx logs:"
    echo "   sudo tail -f /var/log/nginx/faridagri.devzytic.com.access.log"
    echo "   sudo tail -f /var/log/nginx/faridagri.devzytic.com.error.log"
else
    echo "❌ Nginx configuration test failed!"
    echo "Please check the configuration file:"
    echo "   sudo nano /etc/nginx/sites-available/faridagri.devzytic.com"
    exit 1
fi
