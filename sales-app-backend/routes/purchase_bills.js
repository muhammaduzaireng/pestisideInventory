const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/purchase_bills - Fetch all purchase bills with products and payments
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        pb.bill_id,
        pb.invoice_no,
        pb.vendor_id,
        v.name AS vendor_name,
        pb.date,
        pb.total_amount,
        pb.paid_amount,
        pb.balance,
        pb.payment_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'productId', pbp.product_id,
              'name', p.name,
              'qty', pbp.quantity,
              'price', pbp.price
            )
          )
          FROM purchase_bill_products pbp
          JOIN products p ON pbp.product_id = p.product_id
          WHERE pbp.bill_id = pb.bill_id
        ), '[]') AS products,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'amount', pbpay.amount,
              'source', pbpay.source,
              'date', pbpay.date,
              'prNumber', pbpay.pr_number
            )
          )
          FROM purchase_bill_payments pbpay
          WHERE pbpay.bill_id = pb.bill_id
        ), '[]') AS payments
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      ORDER BY pb.date DESC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching purchase bills:', err);
    res.status(500).json({ error: 'Failed to fetch purchase bills' });
  }
});

// POST /api/purchase_bills - Create a new purchase bill
router.post('/', async (req, res) => {
  const { invoiceNo, vendorId, date, paymentType, products, payment } = req.body;

  // Validation
  if (!invoiceNo || !vendorId || !date || !paymentType || !products || products.length === 0) {
    return res.status(400).json({ error: 'Invoice number, vendor, date, payment type, and at least one product are required.' });
  }

  try {
    // Start a transaction
    await query('BEGIN');

    // Insert purchase bill
    const billQuery = `
      INSERT INTO purchase_bills (invoice_no, vendor_id, date, total_amount, paid_amount, payment_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const totalAmount = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
    const paidAmount = payment && payment.amount > 0 ? payment.amount : 0;
    const billResult = await query(billQuery, [
      invoiceNo,
      vendorId,
      date,
      totalAmount,
      paidAmount,
      paymentType
    ]);

    const billId = billResult.rows[0].bill_id;

    // Insert products and update stock
    for (const product of products) {
      const productQuery = `
        INSERT INTO purchase_bill_products (bill_id, product_id, quantity, price)
        VALUES ($1, $2, $3, $4);
      `;
      await query(productQuery, [billId, product.productId, product.quantity, product.price]);

      // Update stock in products table
      await query(`
        UPDATE products
        SET stock = stock + $1
        WHERE product_id = $2
      `, [product.quantity, product.productId]);
    }

    // Insert initial payment if provided
    if (payment && payment.amount > 0) {
      const paymentQuery = `
        INSERT INTO purchase_bill_payments (bill_id, amount, source, date, pr_number)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await query(paymentQuery, [
        billId,
        payment.amount,
        payment.source,
        payment.date,
        payment.prNumber || null
      ]);
    }

    // Commit transaction
    await query('COMMIT');

    // Fetch the full bill with products and payments
    const fetchBill = await query(`
      SELECT 
        pb.bill_id,
        pb.invoice_no,
        pb.vendor_id,
        v.name AS vendor_name,
        pb.date,
        pb.total_amount,
        pb.paid_amount,
        pb.balance,
        pb.payment_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'productId', pbp.product_id,
              'name', p.name,
              'qty', pbp.quantity,
              'price', pbp.price
            )
          )
          FROM purchase_bill_products pbp
          JOIN products p ON pbp.product_id = p.product_id
          WHERE pbp.bill_id = pb.bill_id
        ), '[]') AS products,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'amount', pbpay.amount,
              'source', pbpay.source,
              'date', pbpay.date,
              'prNumber', pbpay.pr_number
            )
          )
          FROM purchase_bill_payments pbpay
          WHERE pbpay.bill_id = pb.bill_id
        ), '[]') AS payments
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      WHERE pb.bill_id = $1
    `, [billId]);

    res.status(201).json(fetchBill.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error creating purchase bill:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Invoice number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create purchase bill' });
  }
});

// POST /api/purchase_bills/:bill_id/payments - Add a payment to a purchase bill
router.post('/:bill_id/payments', async (req, res) => {
  const { bill_id } = req.params;
  const { amount, source, date, prNumber } = req.body;

  if (!amount || amount <= 0 || !source || !date) {
    return res.status(400).json({ error: 'Amount, source, and date are required.' });
  }

  try {
    // Check current balance
    const billQuery = `
      SELECT balance
      FROM purchase_bills
      WHERE bill_id = $1
    `;
    const billResult = await query(billQuery, [bill_id]);
    if (billResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase bill not found.' });
    }
    const balance = billResult.rows[0].balance;

    if (amount > balance) {
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance.' });
    }

    // Start transaction
    await query('BEGIN');

    // Insert payment
    const paymentQuery = `
      INSERT INTO purchase_bill_payments (bill_id, amount, source, date, pr_number)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    await query(paymentQuery, [bill_id, amount, source, date, prNumber || null]);

    // Update bill's paid_amount
    const updateBillQuery = `
      UPDATE purchase_bills
      SET paid_amount = paid_amount + $1
      WHERE bill_id = $2
      RETURNING *;
    `;
    await query(updateBillQuery, [amount, bill_id]);

    // Commit transaction
    await query('COMMIT');

    // Fetch updated bill
    const fetchBill = await query(`
      SELECT 
        pb.bill_id,
        pb.invoice_no,
        pb.vendor_id,
        v.name AS vendor_name,
        pb.date,
        pb.total_amount,
        pb.paid_amount,
        pb.balance,
        pb.payment_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'productId', pbp.product_id,
              'name', p.name,
              'qty', pbp.quantity,
              'price', pbp.price
            )
          )
          FROM purchase_bill_products pbp
          JOIN products p ON pbp.product_id = p.product_id
          WHERE pbp.bill_id = pb.bill_id
        ), '[]') AS products,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'amount', pbpay.amount,
              'source', pbpay.source,
              'date', pbpay.date,
              'prNumber', pbpay.pr_number
            )
          )
          FROM purchase_bill_payments pbpay
          WHERE pbpay.bill_id = pb.bill_id
        ), '[]') AS payments
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      WHERE pb.bill_id = $1
    `, [bill_id]);

    res.status(200).json(fetchBill.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error adding payment:', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// GET /api/purchase_bills/vendors - Fetch all vendors for dropdown
router.get('/vendors', async (req, res) => {
  try {
    const result = await query(`
      SELECT vendor_id AS id, name
      FROM vendors
      ORDER BY name ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET /api/purchase_bills/products - Fetch all products for dropdown
router.get('/products', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        product_id AS id,
        name,
        stock,
        default_price,
        unit,
        vendor_id
      FROM products
      ORDER BY name ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/purchase_bills/payment_sources - Fetch payment sources
router.get('/payment_sources', async (req, res) => {
  try {
    res.status(200).json(['Cash', 'Bank Transfer', 'Cheque']);
  } catch (err) {
    console.error('Error fetching payment sources:', err);
    res.status(500).json({ error: 'Failed to fetch payment sources' });
  }
});

module.exports = router;