const express = require('express');
const cors = require('cors');
const path = require('path');
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors');
const purchaseBillRoutes = require('./routes/purchase_bills');
const saleBillRoutes = require('./routes/sale_bills');
const productRoutes = require('./routes/products');
const previousBillsRoutes = require('./routes/previousBills');


const app = express();
const PORT = process.env.PORT || 5002;
// Always serve frontend - no need for SERVE_FRONTEND env variable
const SERVE_FRONTEND = true;

// ------------------------------------------------------------------
// ⭐ UPDATED CORS CONFIGURATION ⭐
// ------------------------------------------------------------------

// Allow multiple origins including your frontend domain (HTTP only)
const allowedOrigins = [
  'http://faridagri.devzytic.com',
  'http://localhost:3000', // for local development
  'http://localhost:5002'  // for local testing
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Force HTTP protocol in responses (prevent HTTPS redirects)
app.use((req, res, next) => {
  // Set header to indicate HTTP only
  res.setHeader('X-Forwarded-Proto', 'http');
  next();
});

// Add request logging to debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Origin:', req.headers.origin);
  next();
});

// ------------------------------------------------------------------
// ⭐ UPDATED ROUTES WITH /api PREFIX ⭐
// ------------------------------------------------------------------

// Routes - these will be accessible at https://api.devzytic.com/api/...
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase_bills', purchaseBillRoutes);
app.use('/api/sale_bills', saleBillRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', previousBillsRoutes);

// API root endpoint - accessible at /api
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

// Health check endpoint - accessible at /api/health
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Sales Application API is running.',
    timestamp: new Date().toISOString(),
    database: 'MySQL Hostinger'
  });
});

// Serve static files from React app build directory
const buildPath = path.join(__dirname, '..', 'build');

// Serve static files (CSS, JS, images, etc.)
app.use(express.static(buildPath, {
  maxAge: '1d', // Cache static files for 1 day
  etag: true
}));

// Serve React app for all non-API routes (SPA routing)
// This must be AFTER API routes and static files so they take precedence
app.get('*', (req, res, next) => {
  // Skip if it's an API route
  if (req.path.startsWith('/api')) {
    return next(); // Let API 404 handler catch it
  }
  
  // Skip if it's a static file request (should be handled by express.static)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  // Serve index.html for all React routes (dashboard/sale, etc.)
  res.sendFile(path.join(buildPath, 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading application');
    }
  });
});

// 404 Handler for API routes only
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ 
      error: "Route Not Found",
      path: req.path,
      method: req.method
    });
  } else {
    // This shouldn't happen, but just in case
    res.status(404).send('Page not found');
  }
});

// Error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (HTTP only)`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 API Base: http://localhost:${PORT}/api`);
  console.log(`📍 Frontend: http://localhost:${PORT}/`);
  console.log(`📍 Domain: http://faridagri.devzytic.com`);
  console.log(`📍 Serving frontend: YES (always enabled)`);
  console.log(`📍 Protocol: HTTP (no HTTPS)`);
});