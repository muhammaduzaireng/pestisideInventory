const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');

// Get Credit Payments
router.get('/credit-payments/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  const { type = 'sale' } = req.query;

  let connection;
  try {
    connection = await pool.getConnection();
    console.log(`Fetching credit payments for invoice ${invoiceId}, type: ${type}`);

    const rows = await queryWithRetry(
      `SELECT id, payment_date, amount_paid
       FROM credit_payments
       WHERE invoice_id = ? AND invoice_type = ?`,
      [invoiceId, type]
    );

    const parsedRows = rows.map((row) => ({
      ...row,
      amount_paid: parseFloat(row.amount_paid) || 0,
      payment_date: row.payment_date,
    }));

    res.status(200).json(parsedRows);
  } catch (err) {
    console.error('Error fetching credit payments:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Pay Credit for Sale Invoice
router.post('/sell-records/pay-credit', async (req, res) => {
  const { record_id, payment_amount, payment_date, new_credit_due_date } = req.body;

  if (typeof payment_amount !== 'number' || payment_amount <= 0) {
    return res.status(400).json({ error: 'Valid payment_amount (number > 0) is required.' });
  }
  if (!payment_date) {
    return res.status(400).json({ error: 'Payment date is required.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [invoiceResult] = await connection.query(
      `SELECT total_bill_amount, amount_paid, credit_amount FROM sale_invoices WHERE id = ?`,
      [record_id]
    );

    if (invoiceResult.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const currentInvoice = parseNumericFields(invoiceResult[0]);
    const { total_bill_amount, amount_paid: existingAmountPaid, credit_amount: existingCreditAmount } = currentInvoice;

    if (payment_amount > existingCreditAmount) {
      await connection.rollback();
      return res.status(400).json({
        error: `Payment amount exceeds remaining credit of $${existingCreditAmount.toFixed(2)}.`,
      });
    }

    const newAmountPaid = existingAmountPaid + payment_amount;
    const newCreditAmount = existingCreditAmount - payment_amount;

    let updateQuery = `
      UPDATE sale_invoices
      SET amount_paid = ?,
          credit_amount = ?
    `;
    const queryParams = [newAmountPaid, newCreditAmount];

    if (newCreditAmount > 0 && new_credit_due_date) {
      updateQuery += `, credit_due_date = ?`;
      queryParams.push(new_credit_due_date);
    } else if (newCreditAmount <= 0) {
      updateQuery += `, credit_due_date = NULL`;
    }

    updateQuery += ` WHERE id = ?`;
    queryParams.push(record_id);

    await connection.query(updateQuery, queryParams);

    await connection.query(
      `INSERT INTO credit_payments (invoice_id, payment_date, amount_paid, invoice_type) VALUES (?, ?, ?, 'sale')`,
      [record_id, payment_date, payment_amount]
    );

    await connection.commit();
    res.status(200).json({ message: 'Credit payment recorded successfully.', newCreditAmount });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback error in /api/sell-records/pay-credit:', rollbackErr);
      }
      connection.release();
    }
    console.error('Error paying credit for sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// DEPRECATED: Credit Records (Legacy)
router.get('/credit-records', async (req, res) => {
  console.warn('WARNING: /api/credit-records is deprecated. Use /api/credit-records/sale-invoices instead.');
  const { customer_id, customer_name, start_date, end_date, sort } = req.query;
  try {
    let query = `
      SELECT sales.*, customers.name AS customer_name, products.name AS product_name
      FROM sales
      JOIN customers ON sales.customer_id = customers.id
      JOIN products ON sales.product_id = products.id
      WHERE sales.payment_type = 'cash_and_credit'
    `;
    const params = [];
    if (customer_id) {
      query += ' AND sales.customer_id = ?';
      params.push(customer_id);
    }
    if (customer_name) {
      query += ' AND customers.name LIKE ?';
      params.push(`%${customer_name}%`);
    }
    if (start_date) {
      query += ' AND sales.sale_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND sales.sale_date <= ?';
      params.push(end_date);
    }
    if (sort) {
      query += ` ORDER BY ${sort}`;
    } else {
      query += ' ORDER BY sales.sale_date';
    }

    const results = await queryWithRetry(query, params);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error in /api/credit-records:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// DEPRECATED: Add Credit Payment (Legacy)
router.post('/credit-payment', async (req, res) => {
  console.warn('WARNING: /api/credit-payment is deprecated. Use /api/sell-records/pay-credit instead.');
  const { sale_id, amount_paid, next_due_date } = req.body;
  try {
    const [saleResult] = await pool.query('SELECT credit_amount FROM sales WHERE id = ?', [sale_id]);
    const sale = parseNumericFields(saleResult[0]);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const updatedCreditAmount = sale.credit_amount - amount_paid;

    await queryWithRetry(
      'UPDATE sales SET credit_amount = ?, credit_due_date = ? WHERE id = ?',
      [updatedCreditAmount, next_due_date || null, sale_id]
    );

    res.json({ success: true, updatedCreditAmount });
  } catch (err) {
    console.error('Database error in /api/credit-payment:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// DEPRECATED: Get Credit Payments (Legacy)
router.get('/credit-payments', async (req, res) => {
  console.warn('WARNING: /api/credit-payments is deprecated. Use /api/credit-payments/:invoiceId instead.');
  const { customer_id, start_date, end_date } = req.query;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  let query = `
    SELECT cp.*, s.id AS sale_id, s.product_id, s.sale_date, s.total_price, s.customer_id
    FROM credit_payments cp
    JOIN sales s ON cp.sale_id = s.id
    WHERE s.customer_id = ?
  `;
  const params = [customer_id];
  if (start_date) {
    query += ' AND cp.payment_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND cp.payment_date <= ?';
    params.push(end_date);
  }
  query += ' ORDER BY cp.payment_date DESC';

  try {
    const results = await queryWithRetry(query, params);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error in /api/credit-payments:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Fetch all customers for credit records
router.get('/credit-records/customers', async (req, res) => {
  try {
    console.log('Fetching customers for credit records');
    const customers = await queryWithRetry('SELECT id, name, phone FROM customers ORDER BY name ASC', []);
    res.json(customers);
  } catch (err) {
    console.error('Error fetching credit record customers:', err);
    res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
  }
});

// Fetch sale invoices for credit records with filters
router.get('/credit-records/sale-invoices', async (req, res) => {
  const { customer_id, start_date, end_date } = req.query;

  const parsedCustomerId = parseInt(customer_id, 10);
  if (isNaN(parsedCustomerId)) {
    return res.status(400).json({ error: 'Invalid Customer ID' });
  }

  try {
    let query = `
      SELECT
          si.id, si.invoice_number, si.customer_id, si.sale_date,
          si.total_bill_amount, si.amount_paid, si.credit_amount,
          si.payment_type, si.credit_due_date,
          c.name AS customer_name, c.phone AS customer_phone
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.customer_id = ?
    `;
    const params = [parsedCustomerId];

    if (start_date && end_date) {
      query += ' AND si.sale_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      query += ' AND si.sale_date >= ?';
      params.push(start_date);
    } else if (end_date) {
      query += ' AND si.sale_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY si.sale_date DESC';

    console.log('Executing credit-records/sale-invoices query:', query, 'with params:', params);
    const invoices = await queryWithRetry(query, params);
    const parsedInvoices = invoices.map(parseNumericFields);
    res.json(parsedInvoices);
  } catch (err) {
    console.error('Error fetching credit record sale invoices:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;