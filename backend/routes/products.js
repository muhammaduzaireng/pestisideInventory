const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');

// Get all products
router.get('/', async (req, res) => {
  try {
    const results = await queryWithRetry(
      // The query now selects only the necessary fields
      'SELECT p.id, p.name, p.vendor_id, v.name AS vendorName, p.stock FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id'
    );
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error in /api/products:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get product details
router.get('/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const results = await queryWithRetry('SELECT * FROM products WHERE id = ?', [productId]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(parseNumericFields(results[0]));
  } catch (err) {
    console.error('Database error in /api/products/:id:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add product
router.post('/', async (req, res) => {
  const { name, vendor_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // The INSERT statement has been simplified
    const results = await queryWithRetry(
      'INSERT INTO products (name, vendor_id, stock) VALUES (?, ?, ?)',
      [name, vendor_id || null, 0] // Initialize stock to 0
    );
    res.json({ id: results.insertId, name, vendor_id: vendor_id || null, stock: 0 });
  } catch (err) {
    console.error('Database error in /api/products POST:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update product (new, simplified route)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, vendor_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    await queryWithRetry(`UPDATE products SET name = ?, vendor_id = ? WHERE id = ?`, [name, vendor_id || null, id]);
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    console.error('Database error in /api/products/:id:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// DEPRECATED: Old route for adding stock
router.post('/:id/add-stock', async (req, res) => {
  console.warn(`WARNING: /api/products/:id/add-stock is deprecated. Use /api/stock-entries instead.`);
  const { id } = req.params;
  const { added_stock } = req.body;

  if (!added_stock) {
    return res.status(400).json({ error: 'Added stock is required' });
  }
  try {
    await queryWithRetry(
      'UPDATE products SET stock = stock + ? WHERE id = ?',
      [added_stock, id]
    );
    res.json({ success: true, message: 'Product stock updated (deprecated route).' });
  } catch (err) {
    console.error('Database error in /api/products/:id/add-stock:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Remove the old /:id/prices route as it's no longer needed
// The previous PUT route for prices has been removed.

module.exports = router;
