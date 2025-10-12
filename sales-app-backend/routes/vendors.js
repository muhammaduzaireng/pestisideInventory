const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------
// GET /api/vendors - Fetch all vendors with their products as objects (including full product details)
// ----------------------------------------------------
router.get('/', async (req, res) => {
  try {
    // First get all vendors
    const vendors = await db.query(`
      SELECT 
        vendor_id, 
        name, 
        phone, 
        address, 
        created_at
      FROM vendors 
      ORDER BY vendor_id ASC
    `);

    // Then get products for each vendor and combine them
    const vendorsWithProducts = await Promise.all(
      vendors.map(async (vendor) => {
        const products = await db.query(`
          SELECT 
            product_id,
            name,
            stock,
            default_price,
            unit
          FROM products 
          WHERE vendor_id = ?
        `, [vendor.vendor_id]);

        return {
          ...vendor,
          products: products
        };
      })
    );

    res.status(200).json(vendorsWithProducts);
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
    const result = await db.run(
      'INSERT INTO vendors (name, phone, address) VALUES (?, ?, ?)',
      [name, contact, address]
    );
    
    // Fetch the newly created vendor
    const newVendor = await db.get(
      'SELECT * FROM vendors WHERE vendor_id = ?',
      [result.id]
    );
    
    res.status(201).json(newVendor);
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
    const result = await db.run(
      'INSERT INTO products (vendor_id, name, stock, default_price, unit) VALUES (?, ?, ?, ?, ?)',
      [vendor_id, name, stock, default_price, unit || 'Unit']
    );
    
    // Fetch the newly created product
    const newProduct = await db.get(
      'SELECT * FROM products WHERE product_id = ?',
      [result.id]
    );
    
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error adding product:', err);
    if (err.code === 'ER_DUP_ENTRY') { // MySQL duplicate entry error code
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
    const result = await db.run(
      'DELETE FROM products WHERE vendor_id = ? AND name = ?',
      [vendor_id, name]
    );
    
    // Check if any row was actually deleted
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ----------------------------------------------------
// GET /api/vendors/:id - Get a single vendor with products
// ----------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const vendorId = req.params.id;
    
    const vendor = await db.get(`
      SELECT 
        vendor_id, 
        name, 
        phone, 
        address, 
        created_at
      FROM vendors 
      WHERE vendor_id = ?
    `, [vendorId]);

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const products = await db.query(`
      SELECT 
        product_id,
        name,
        stock,
        default_price,
        unit
      FROM products 
      WHERE vendor_id = ?
    `, [vendorId]);

    res.json({
      ...vendor,
      products: products
    });
  } catch (err) {
    console.error('Error fetching vendor:', err);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// ----------------------------------------------------
// PUT /api/vendors/:id - Update a vendor
// ----------------------------------------------------
router.put('/:id', async (req, res) => {
  const vendorId = req.params.id;
  const { name, contact, address } = req.body;
  
  if (!name || !contact || !address) {
    return res.status(400).json({ error: 'Name, contact (phone), and address are required fields.' });
  }
  
  try {
    const result = await db.run(
      'UPDATE vendors SET name = ?, phone = ?, address = ? WHERE vendor_id = ?',
      [name, contact, address, vendorId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    // Fetch the updated vendor
    const updatedVendor = await db.get(
      'SELECT * FROM vendors WHERE vendor_id = ?',
      [vendorId]
    );
    
    res.json(updatedVendor);
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// ----------------------------------------------------
// DELETE /api/vendors/:id - Delete a vendor
// ----------------------------------------------------
router.delete('/:id', async (req, res) => {
  const vendorId = req.params.id;
  
  try {
    // Check if vendor has products
    const products = await db.query(
      'SELECT COUNT(*) as product_count FROM products WHERE vendor_id = ?',
      [vendorId]
    );
    
    if (products[0].product_count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete vendor with existing products. Please delete or transfer products first.' 
      });
    }
    
    const result = await db.run(
      'DELETE FROM vendors WHERE vendor_id = ?',
      [vendorId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

module.exports = router;