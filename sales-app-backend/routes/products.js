const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/products - Fetch all products
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        product_id,
        vendor_id,
        name,
        stock,
        default_price,
        unit
      FROM products
      ORDER BY product_id ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

module.exports = router;