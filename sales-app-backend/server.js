const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

// Routes
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors');
const purchaseBillRoutes = require('./routes/purchase_bills');
const saleBillRoutes = require('./routes/sale_bills');
const productRoutes = require('./routes/products');
const previousBillsRoutes = require('./routes/previousBills');

const app = express();
const PORT = process.env.PORT || 5002;

// Get all network interfaces
function getAllNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        ips.push({
          interface: devName,
          address: alias.address,
          mac: alias.mac
        });
      }
    }
  }
  return ips;
}

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5002',
      'http://faridagri.devzytic.com',
      /\.devzytic\.com$/, // Allow all devzytic.com subdomains
    ];
    
    // Add your network IPs dynamically
    const networkIPs = getAllNetworkIPs();
    networkIPs.forEach(ip => {
      allowedOrigins.push(`http://${ip.address}:3000`);
      allowedOrigins.push(`http://${ip.address}:5002`);
    });
    
    // Check if origin is allowed
    if (allowedOrigins.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    })) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from React app build directory
app.use(express.static(path.join(__dirname, '../build')));

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase_bills', purchaseBillRoutes);
app.use('/api/sale_bills', saleBillRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', previousBillsRoutes);

// API root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Sales API Root',
    endpoints: {
      customers: '/api/customers',
      vendors: '/api/vendors',
      products: '/api/products',
      purchase_bills: '/api/purchase_bills',
      sale_bills: '/api/sale_bills'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check with more info
app.get('/api/health', (req, res) => {
  const networkIPs = getAllNetworkIPs();
  res.json({
    status: 'healthy',
    message: 'Sales Application API is running.',
    timestamp: new Date().toISOString(),
    server: {
      port: PORT,
      hostname: os.hostname(),
      platform: os.platform()
    },
    network: networkIPs,
    database: 'MySQL Hostinger'
  });
});

// Network diagnostics endpoint
app.get('/api/network', (req, res) => {
  const networkIPs = getAllNetworkIPs();
  const publicIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  res.json({
    local_ips: networkIPs,
    public_ip: publicIP,
    client_ip: req.ip,
    access_urls: networkIPs.map(ip => `http://${ip.address}:${PORT}`),
    client_headers: req.headers
  });
});

// Serve React app (catch-all handler must be after API routes)
// Use app.use() instead of app.get('*') for Express 5 compatibility
app.use((req, res) => {
  // Skip API routes - they should have been handled already
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: 'Route Not Found',
      path: req.path,
      method: req.method
    });
  }
  
  // Skip static file requests
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$/)) {
    return res.status(404).send('File not found');
  }
  
  // Serve index.html for all React routes
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Error handling (must be last)
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start server with ALL interfaces
const HOST = '0.0.0.0'; // Bind to ALL network interfaces
const networkIPs = getAllNetworkIPs();

app.listen(PORT, HOST, () => {
  console.clear();
  console.log('='.repeat(70));
  console.log('🚀 SALES APPLICATION SERVER STARTED');
  console.log('='.repeat(70));
  
  console.log(`\n📊 SERVER INFORMATION:`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Host: ${HOST}`);
  console.log(`   Time: ${new Date().toLocaleString()}`);
  
  console.log(`\n🔌 NETWORK INTERFACES:`);
  networkIPs.forEach((ip, index) => {
    console.log(`   ${index + 1}. ${ip.interface}: ${ip.address} (${ip.mac})`);
  });
  
  console.log(`\n🔗 ACCESS URLs:`);
  console.log(`   1. Localhost:    http://localhost:${PORT}`);
  networkIPs.forEach((ip, index) => {
    console.log(`   ${index + 2}. Network (${ip.interface}): http://${ip.address}:${PORT}`);
  });
  
  console.log(`\n🌐 DOMAIN ACCESS:`);
  console.log(`   • http://faridagri.devzytic.com`);
  
  console.log(`\n🌐 API ENDPOINTS:`);
  console.log(`   • Health:     http://localhost:${PORT}/api/health`);
  console.log(`   • Network:    http://localhost:${PORT}/api/network`);
  console.log(`   • API Root:   http://localhost:${PORT}/api`);
  console.log(`   • Customers:  http://localhost:${PORT}/api/customers`);
  console.log(`   • Products:   http://localhost:${PORT}/api/products`);
  
  console.log('\n💡 QUICK START:');
  console.log('   • Test server: curl http://localhost:5002/api/health');
  console.log('   • Frontend: http://localhost:5002/');
  console.log('   • Dashboard: http://localhost:5002/dashboard/sale');
  
  console.log('='.repeat(70));
});
