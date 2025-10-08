const express = require('express');
const router = express.Router();
const { query } = require('../db');

// ----------------------------------------------------
// GET /api/vendors - Fetch all vendors with their products as objects (including full product details)
// ----------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        v.vendor_id, 
        v.name, 
        v.phone, 
        v.address, 
        v.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.product_id,
              'name', p.name,
              'stock', p.stock,
              'default_price', p.default_price,
              'unit', p.unit
            )
          ) FILTER (WHERE p.product_id IS NOT NULL),
          '[]'
        ) AS products
      FROM vendors v
      LEFT JOIN products p ON v.vendor_id = p.vendor_id
      GROUP BY v.vendor_id
      ORDER BY v.vendor_id ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// ----------------------------------------------------
// POST /api/vendors - Create a new vendor
// ----------------------------------------------------
router.post('/', async (req, res) => {
  const { name, contact, address } = req.body;
  if (!name || !contact || !address) {
    return res.status(400).json({ error: 'Name, contact (phone), and address are required fields.' });
  }
  try {
    const insertQuery = `
      INSERT INTO vendors (name, phone, address) 
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await query(insertQuery, [name, contact, address]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// ----------------------------------------------------
// POST /api/vendors/:vendor_id/products - Add a product to a vendor (requires stock and price)
// ----------------------------------------------------
router.post('/:vendor_id/products', async (req, res) => {
  const { vendor_id } = req.params;
  const { name, stock, default_price, unit } = req.body;
  // Note: unit is optional, but stock and default_price are mandatory based on schema
  if (!name || stock === undefined || default_price === undefined) { 
    return res.status(400).json({ error: 'Product name, stock, and default price are required.' });
  }
  try {
    const insertQuery = `
      INSERT INTO products (vendor_id, name, stock, default_price, unit) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(insertQuery, [
      vendor_id,
      name,
      stock,
      default_price,
      unit || 'Unit'
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding product:', err);
    if (err.code === '23505') { // PostgreSQL unique violation code
      return res.status(409).json({ error: 'Product name already exists for this vendor.' });
    }
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ----------------------------------------------------
// DELETE /api/vendors/:vendor_id/products - Remove a product from a vendor (by name)
// ----------------------------------------------------
router.delete('/:vendor_id/products', async (req, res) => {
  const { vendor_id } = req.params;
  const { name } = req.body; // Product name to delete
  
  if (!name) {
    return res.status(400).json({ error: 'Product name is required.' });
  }
  try {
    const deleteQuery = `
      DELETE FROM products 
      WHERE vendor_id = $1 AND name = $2
      RETURNING *;
    `;
    const result = await query(deleteQuery, [vendor_id, name]);
    
    // Check if any row was actually deleted
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
