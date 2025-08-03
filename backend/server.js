// const express = require('express');
// const cors = require('cors');
// const bodyParser = require('body-parser');

// const app = express();
// app.use(cors());
// app.use(bodyParser.json());

// // Import routes
// const authRoutes = require('./routes/auth');
// const productRoutes = require('./routes/products');
// const customerRoutes = require('./routes/customers');
// const stockRoutes = require('./routes/stock');
// const salesRoutes = require('./routes/sales');
// const vendorRoutes = require('./routes/vendors');
// const reportRoutes = require('./routes/reports');
// const creditRoutes = require('./routes/credit');
// const stockPurchaseRoutes = require('./routes/stock-purchases');

// // Use routes
// app.use('/api', authRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/customers', customerRoutes);
// app.use('/api/stock', stockRoutes);
// app.use('/api', salesRoutes);
// app.use('/api/vendors', vendorRoutes);
// app.use('/api', reportRoutes);
// app.use('/api', creditRoutes);
// app.use('/api/stock-purchases', stockPurchaseRoutes);

// // List all routes for debugging
// app.get('/api/routes', (req, res) => {
//   const routes = app._router.stack
//     .filter((r) => r.route)
//     .map((r) => ({ method: r.route.stack[0].method, path: r.route.path }));
//   res.json(routes);
// });

// // Start Server
// const PORT = 5001;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

// Initialize Express
const app = express();

// =============================================
// 1. SECURITY MIDDLEWARE
// =============================================
app.use(helmet());
app.use(cors({
  origin: [
    'https://faridagri.devzytic.com',
    'http://localhost:3000' // For local development
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Rate limiting (100 requests per 15 minutes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// =============================================
// 2. APPLICATION MIDDLEWARE
// =============================================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // HTTP request logger

// =============================================
// 3. SUBDOMAIN-SPECIFIC CONFIGURATION
// =============================================
app.use((req, res, next) => {
  req.subdomain = req.headers.host.split('.')[0];
  next();
});

// =============================================
// 4. API ROUTES
// =============================================
const apiRoutes = express.Router();

// Auth Routes
apiRoutes.use('/auth', require('./routes/auth'));
apiRoutes.use('/products', require('./routes/products'));
apiRoutes.use('/customers', require('./routes/customers'));
apiRoutes.use('/stock', require('./routes/stock'));
apiRoutes.use('/sales', require('./routes/sales'));
apiRoutes.use('/vendors', require('./routes/vendors'));
apiRoutes.use('/reports', require('./routes/reports'));
apiRoutes.use('/credit', require('./routes/credit'));
apiRoutes.use('/stock-purchases', require('./routes/stock-purchases'));

app.use('/api', apiRoutes);

// =============================================
// 5. FRONTEND ROUTES (CRUCIAL FOR REACT)
// =============================================
// Correctly serves static files from the 'build' folder,
// which is one level up from the 'backend' directory.
const buildPath = path.join(__dirname, '..', 'build');
app.use(express.static(buildPath));

// For Single Page Applications, this catch-all route ensures that any
// request not handled by the API is served the 'index.html' file.
app.get('*', (req, res) => {
  res.sendFile(path.resolve(buildPath, 'index.html'));
});

// =============================================
// 6. ERROR HANDLING
// =============================================
// 404 Handler (this is now redundant due to the '*' route, but kept for clarity)
// app.use((req, res, next) => {
//   res.status(404).json({
//     status: 'error',
//     message: 'Resource not found'
//   });
// });

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// =============================================
// 7. SERVER INITIALIZATION
// =============================================
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.NODE_ENV === 'production') {
  const https = require('https');
  const fs = require('fs');
  
  const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/devzytic.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/devzytic.com/fullchain.pem')
  };
  
  https.createServer(options, app).listen(PORT, HOST, () => {
    console.log(`Secure server running on https://${HOST}:${PORT}`);
  });
} else {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
