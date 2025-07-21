const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'build')));

// API Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const stockRoutes = require('./routes/stock');
const salesRoutes = require('./routes/sales');
const vendorRoutes = require('./routes/vendors');
const reportRoutes = require('./routes/reports');
const creditRoutes = require('./routes/credit');
const stockPurchaseRoutes = require('./routes/stock-purchases');

app.use('/api', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api', salesRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api', reportRoutes);
app.use('/api', creditRoutes);
app.use('/api/stock-purchases', stockPurchaseRoutes);

// Debug: List all registered routes
app.get('/api/routes', (req, res) => {
  const routes = app._router.stack
    .filter((r) => r.route)
    .map((r) => ({
      method: r.route.stack[0].method.toUpperCase(),
      path: r.route.path,
    }));
  res.json(routes);
});

// Catch-all route to serve frontend (for SPA routing like React)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
