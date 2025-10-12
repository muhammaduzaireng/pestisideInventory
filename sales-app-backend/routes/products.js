const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/products - Fetch all products
router.get('/', async (req, res) => {
  try {
    const products = await db.query(`
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
    res.status(200).json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Get a single product
router.get('/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await db.get(`
      SELECT 
        product_id,
        vendor_id,
        name,
        stock,
        default_price,
        unit
      FROM products
      WHERE product_id = ?
    `, [productId]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/products - Create a new product
router.post('/', async (req, res) => {
  const { vendor_id, name, stock, default_price, unit } = req.body;

  // Validation
  if (!vendor_id || !name || stock === undefined || default_price === undefined) {
    return res.status(400).json({ error: 'Vendor ID, name, stock, and default price are required.' });
  }

  try {
    const result = await db.run(`
      INSERT INTO products (vendor_id, name, stock, default_price, unit)
      VALUES (?, ?, ?, ?, ?)
    `, [vendor_id, name, stock, default_price, unit || 'Unit']);

    // Fetch the newly created product
    const newProduct = await db.get(`
      SELECT * FROM products WHERE product_id = ?
    `, [result.id]);

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Error creating product:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Product name already exists for this vendor.' });
    }
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update a product
router.put('/:id', async (req, res) => {
  const productId = req.params.id;
  const { vendor_id, name, stock, default_price, unit } = req.body;

  // Validation
  if (!vendor_id || !name || stock === undefined || default_price === undefined) {
    return res.status(400).json({ error: 'Vendor ID, name, stock, and default price are required.' });
  }

  try {
    const result = await db.run(`
      UPDATE products 
      SET vendor_id = ?, name = ?, stock = ?, default_price = ?, unit = ?
      WHERE product_id = ?
    `, [vendor_id, name, stock, default_price, unit || 'Unit', productId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Fetch the updated product
    const updatedProduct = await db.get(`
      SELECT * FROM products WHERE product_id = ?
    `, [productId]);

    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error('Error updating product:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Product name already exists for this vendor.' });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Delete a product
router.delete('/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    // Check if product is used in any sale bills
    const saleBillUsage = await db.query(`
      SELECT COUNT(*) as count FROM sale_bill_products WHERE product_id = ?
    `, [productId]);

    // Check if product is used in any purchase bills
    const purchaseBillUsage = await db.query(`
      SELECT COUNT(*) as count FROM purchase_bill_products WHERE product_id = ?
    `, [productId]);

    if (saleBillUsage[0].count > 0 || purchaseBillUsage[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product that is used in sale or purchase bills.' 
      });
    }

    const result = await db.run(`
      DELETE FROM products WHERE product_id = ?
    `, [productId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET /api/products/vendor/:vendor_id - Get products by vendor
router.get('/vendor/:vendor_id', async (req, res) => {
  try {
    const vendorId = req.params.vendor_id;
    const products = await db.query(`
      SELECT 
        product_id,
        vendor_id,
        name,
        stock,
        default_price,
        unit
      FROM products
      WHERE vendor_id = ?
      ORDER BY name ASC
    `, [vendorId]);

    res.status(200).json(products);
  } catch (err) {
    console.error('Error fetching vendor products:', err);
    res.status(500).json({ error: 'Failed to fetch vendor products' });
  }
});

module.exports = router;