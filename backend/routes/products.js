const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');

// Get all products
router.get('/', async (req, res) => {
  try {
    const results = await queryWithRetry(
      'SELECT p.*, v.name AS vendorName FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id'
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
    const results = await queryWithRetry('SELECT *, expiry_date_tracking FROM products WHERE id = ?', [productId]);
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
  const { name, barcode, vendor_id } = req.body;

  if (!name || !barcode) {
    return res.status(400).json({ error: 'Name and barcode are required' });
  }

  try {
    const results = await queryWithRetry(
      'INSERT INTO products (name, barcode, vendor_id, purchase_price, sell_price, expiry_date_tracking) VALUES (?, ?, ?, ?, ?, ?)',
      [name, barcode, vendor_id || null, null, null, false]
    );
    res.json({ id: results.insertId, name, barcode, vendor_id: vendor_id || null, purchase_price: null, sell_price: null, expiry_date_tracking: false });
  } catch (err) {
    console.error('Database error in /api/products POST:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update product prices
router.put('/:id/prices', async (req, res) => {
  const { id } = req.params;
  const { purchase_price, sell_price } = req.body;
  if (purchase_price === undefined && sell_price === undefined) {
    return res.status(400).json({ error: 'At least one price must be provided' });
  }
  try {
    let updateFields = [];
    let params = [];
    if (purchase_price !== undefined) {
      updateFields.push('purchase_price = ?');
      params.push(purchase_price);
    }
    if (sell_price !== undefined) {
      updateFields.push('sell_price = ?');
      params.push(sell_price);
    }
    params.push(id);
    await queryWithRetry(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Default product prices updated.' });
  } catch (err) {
    console.error('Database error in /api/products/:id/prices:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// DEPRECATED: Add stock to a product
router.post('/:id/add-stock', async (req, res) => {
  console.warn(`WARNING: /api/products/:id/add-stock is deprecated. Use /api/stock-entries instead.`);
  const { id } = req.params;
  const { added_stock, purchase_price, sell_price, purchase_date } = req.body;

  if (!added_stock || !purchase_price || !sell_price || !purchase_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    await queryWithRetry(
      'UPDATE products SET stock = stock + ?, purchase_price = ?, sell_price = ?, last_purchase_date = ? WHERE id = ?',
      [added_stock, purchase_price, sell_price, purchase_date, id]
    );
    res.json({ success: true, message: 'Product stock and prices updated (deprecated route).' });
  } catch (err) {
    console.error('Database error in /api/products/:id/add-stock:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;