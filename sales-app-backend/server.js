// // sales-app-backend/server.js

// const express = require('express');
// const cors = require('cors');
// const customerRoutes = require('./routes/customers');
// const vendorRoutes = require('./routes/vendors'); // ⬅️ IMPORTED VENDOR ROUTES
// const purchaseBillRoutes = require('./routes/purchase_bills');
// const saleBillRoutes = require('./routes/sale_bills');
// const productRoutes = require('./routes/products');


// const app = express();
// const PORT = process.env.PORT || 5002;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Routes
// app.use('/api/customers', customerRoutes);
// app.use('/api/vendors', vendorRoutes); // ⬅️ INTEGRATED VENDOR ROUTES
// app.use('/api/purchase_bills', purchaseBillRoutes);
// app.use('/api/sale_bills', saleBillRoutes);
// app.use('/api/products', productRoutes);


// // Simple health check
// app.get('/', (req, res) => {
//     res.send('Sales Application API is running.');
// });

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });


// sales-app-backend/server.js

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
// ⭐ CHANGES START HERE: FIXING CORS POLICY ⭐
// ------------------------------------------------------------------

// 1. Define the exact origin of your frontend application
// This fixes the "Access-Control-Allow-Origin" error
const allowedOrigin = 'https://faridagri.devzytic.com'; 

const corsOptions = {
    // Set the allowed origin
    origin: allowedOrigin,
    // Add the specific methods your API uses
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    // Allow credentials (like cookies or auth headers) if your app uses them
    credentials: true, 
    // Recommended to add a status code for successful OPTIONS preflight
    optionsSuccessStatus: 200 
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// ------------------------------------------------------------------
// ⭐ CHANGES END HERE ⭐
// ------------------------------------------------------------------


// Routes
app.use('/api/customers', customerRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchase_bills', purchaseBillRoutes);
app.use('/api/sale_bills', saleBillRoutes);
app.use('/api/products', productRoutes);


// Simple health check
app.get('/', (req, res) => {
    res.send('Sales Application API is running.');
});

// ------------------------------------------------------------------
// ⭐ ADDED: Basic 404/Error Handling Middleware ⭐
// ------------------------------------------------------------------

// Handles requests that didn't match any route above
app.use((req, res, next) => {
    // The previous 404 might have been caused by missing the /api prefix,
    // but your routes use the prefix /api/customers etc.
    // We will keep the route structure as is, but add a fallback.
    res.status(404).send("Error 404: Route Not Found.");
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});