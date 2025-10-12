const express = require('express');
const cors = require('cors');
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors');
const purchaseBillRoutes = require('./routes/purchase_bills');
const saleBillRoutes = require('./routes/sale_bills');
const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 5002;

// ------------------------------------------------------------------
// ⭐ UPDATED CORS CONFIGURATION ⭐
// ------------------------------------------------------------------

// Allow multiple origins including your frontend domain
const allowedOrigins = [
  'https://faridagri.devzytic.com',
  'https://api.devzytic.com',
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

// Health check - accessible at https://api.devzytic.com/
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sales Application API is running.',
    timestamp: new Date().toISOString(),
    database: 'MySQL Hostinger'
  });
});

// API root endpoint - accessible at https://api.devzytic.com/api
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

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ 
    error: "Route Not Found",
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/`);
  console.log(`📍 API Base: http://localhost:${PORT}/api`);
  console.log(`📍 Frontend: https://faridagri.devzytic.com`);
  console.log(`📍 API Domain: https://api.devzytic.com`);
});