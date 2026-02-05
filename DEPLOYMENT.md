# Deployment Commands for Server

## Prerequisites
- Node.js and npm installed
- PM2 installed globally: `npm install -g pm2`
- Build directory exists (run `npm run build`)

## Step-by-Step Deployment Commands

### 1. Navigate to project directory
```bash
cd /path/to/pestisideInventory
# or wherever your project is located
```

### 2. Install dependencies (if not already done)
```bash
npm install
```

### 3. Build the React application (if not already done)
```bash
npm run build
```

### 4. Verify build directory exists
```bash
ls -la build/
# Should show index.html and static/ directory
```

### 5. Create logs directory (if it doesn't exist)
```bash
mkdir -p logs
```

### 6. Start the application with PM2
```bash
pm2 start ecosystem.config.js
```

### 7. Save PM2 configuration to start on server reboot
```bash
pm2 save
pm2 startup
# Follow the instructions shown to enable PM2 on system startup
```

### 8. Check application status
```bash
pm2 status
pm2 logs sales-app
```

### 9. Verify the application is running
```bash
# Check if backend is responding
curl http://localhost:5002/

# Check if API is working
curl http://localhost:5002/api
```

## Useful PM2 Commands

```bash
# View logs
pm2 logs sales-app

# View real-time logs
pm2 logs sales-app --lines 50

# Restart application
pm2 restart sales-app

# Stop application
pm2 stop sales-app

# Delete application from PM2
pm2 delete sales-app

# Monitor application
pm2 monit

# View detailed status
pm2 show sales-app
```

## Nginx Configuration (if using reverse proxy)

If you need to configure Nginx to proxy requests to your application:

```nginx
server {
    listen 80;
    server_name faridagri.devzytic.com;

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
    }
}
```

After configuring Nginx:
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx  # Reload Nginx
```

## Troubleshooting

### Check if port 5002 is in use
```bash
netstat -tulpn | grep 5002
# or
lsof -i :5002
```

### Check PM2 logs for errors
```bash
pm2 logs sales-app --err
```

### Restart if needed
```bash
pm2 restart sales-app
```

### Check if build directory exists and has files
```bash
ls -la build/
ls -la build/static/
```
