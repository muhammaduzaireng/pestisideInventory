// sales-app-backend/server.js

const express = require('express');
const cors = require('cors');
const customerRoutes = require('./routes/customers');
const vendorRoutes = require('./routes/vendors'); // ⬅️ IMPORTED VENDOR ROUTES
const purchaseBillRoutes = require('./routes/purchase_bills');
const saleBillRoutes = require('./routes/sale_bills');
const productRoutes = require('./routes/products');


const app = express();
const PORT = process.env.PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes); // ⬅️ INTEGRATED VENDOR ROUTES
app.use('/api/purchase_bills', purchaseBillRoutes);
app.use('/api/sale_bills', saleBillRoutes);
app.use('/api/products', productRoutes);


// Simple health check
app.get('/', (req, res) => {
    res.send('Sales Application API is running.');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
