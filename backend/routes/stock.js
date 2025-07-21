const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');

// Stock (Aggregated View)
router.get('/', async (req, res) => {
  try {
    const results = await queryWithRetry(`
      SELECT
          p.id,
          p.name,
          p.barcode,
          p.purchase_price,
          p.sell_price,
          p.expiry_date_tracking,
          COALESCE(SUM(se.added_stock), 0) AS stock,
          MAX(se.purchase_date) AS last_purchase_date
      FROM
          products p
      LEFT JOIN
          stock_entries se ON p.id = se.product_id
      GROUP BY
          p.id, p.name, p.barcode, p.purchase_price, p.sell_price, p.expiry_date_tracking
      ORDER BY
          p.name;
    `);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Error fetching aggregated stock:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Add Stock Entry
router.post('/stock-entries', async (req, res) => {
  const {
    product_id,
    added_stock,
    purchase_price,
    sell_price,
    purchase_date,
    expiry_date,
    payment_method,
    credit_due_date,
    transaction_id,
    bank_name,
    vendor_id,
  } = req.body;

  if (!product_id || !added_stock || !purchase_price || !sell_price || !purchase_date || !payment_method) {
    return res.status(400).json({ error: 'Missing essential stock entry fields.' });
  }

  if (added_stock <= 0 || purchase_price < 0 || sell_price < 0) {
    return res.status(400).json({ error: 'Stock, purchase price, and sell price must be positive numbers.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [productRes] = await connection.query('SELECT expiry_date_tracking FROM products WHERE id = ?', [product_id]);
    if (productRes.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Product not found.' });
    }
    const expiryDateTracking = productRes[0].expiry_date_tracking;

    if (expiryDateTracking && !expiry_date) {
      await connection.rollback();
      return res.status(400).json({ error: 'Expiry date is required for this product type.' });
    }
    const finalExpiryDate = expiryDateTracking ? expiry_date : null;

    const isCreditPayment = payment_method === 'credit' || payment_method === 'cash_and_credit';
    if (isCreditPayment && !credit_due_date) {
      await connection.rollback();
      return res.status(400).json({ error: 'Credit due date is required for credit/cash & credit payments.' });
    }
    const finalCreditDueDate = isCreditPayment ? credit_due_date : null;

    const isBankTransfer = payment_method === 'bank_transfer';
    if (isBankTransfer && (!transaction_id || !bank_name)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Transaction ID and Bank Name are required for bank transfer.' });
    }
    const finalTransactionId = isBankTransfer ? transaction_id : null;
    const finalBankName = isBankTransfer ? bank_name : null;

    const finalVendorId = vendor_id ? parseInt(vendor_id) : null;

    const [results] = await connection.query(
      `INSERT INTO stock_entries (
        product_id, added_stock, purchase_price, sell_price, purchase_date, expiry_date,
        payment_method, credit_due_date, transaction_id, bank_name, vendor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        product_id,
        added_stock,
        purchase_price,
        sell_price,
        purchase_date,
        finalExpiryDate,
        payment_method,
        finalCreditDueDate,
        finalTransactionId,
        finalBankName,
        finalVendorId,
      ]
    );

    await connection.commit();
    res.status(201).json({ id: results.insertId, message: 'Stock entry added successfully.' });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error adding stock entry:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry detected.', details: err.message });
    }
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Update Stock Entry
router.put('/stock-entries/:id', async (req, res) => {
  const { id } = req.params;
  const { purchase_price, sell_price, expiry_date } = req.body;
  try {
    const results = await queryWithRetry(
      `UPDATE stock_entries
       SET purchase_price = ?, sell_price = ?, expiry_date = ?
       WHERE id = ?`,
      [parseFloat(purchase_price) || 0, parseFloat(sell_price) || 0, expiry_date || null, id]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Stock entry not found' });
    }
    res.json({ message: 'Stock entry updated successfully' });
  } catch (err) {
    console.error('Database error in /api/stock-entries/:id:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get Recent Stock Entry Prices for a Product
router.get('/stock-entries/recent/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const results = await queryWithRetry(
      `SELECT purchase_price, sell_price
       FROM stock_entries
       WHERE product_id = ?
       ORDER BY purchase_date DESC, created_at DESC
       LIMIT 1`,
      [productId]
    );
    if (results.length === 0) {
      const productResults = await queryWithRetry(
        `SELECT purchase_price, sell_price
         FROM products
         WHERE id = ?`,
        [productId]
      );
      if (productResults.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      return res.json(parseNumericFields(productResults[0]));
    }
    res.json(parseNumericFields(results[0]));
  } catch (err) {
    console.error('Database error in /api/stock-entries/recent/:productId:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;