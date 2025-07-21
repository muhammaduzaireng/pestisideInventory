const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const customerRoutes = require('./routes/customers');
const stockRoutes = require('./routes/stock');
const salesRoutes = require('./routes/sales');
const vendorRoutes = require('./routes/vendors');
const reportRoutes = require('./routes/reports');
const creditRoutes = require('./routes/credit');
const stockPurchaseRoutes = require('./routes/stock-purchases');

// Use routes
app.use('/api', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api', salesRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api', reportRoutes);
app.use('/api', creditRoutes);
app.use('/api/stock-purchases', stockPurchaseRoutes);

// List all routes for debugging
app.get('/api/routes', (req, res) => {
  const routes = app._router.stack
    .filter((r) => r.route)
    .map((r) => ({ method: r.route.stack[0].method, path: r.route.path }));
  res.json(routes);
});

// Start Server
app.listen(5001, '0.0.0.0', () => {
  console.log('Server running on port 5001');
});


