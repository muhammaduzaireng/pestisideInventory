const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/purchase_bills - Fetch all purchase bills with products and payments
router.get('/', async (req, res) => {
  try {
    // First get all purchase bills with vendor info
    const bills = await db.query(`
      SELECT 
        pb.bill_id,
        pb.invoice_no,
        pb.vendor_id,
        v.name AS vendor_name,
        pb.date,
        pb.total_amount,
        pb.paid_amount,
        pb.balance,
        pb.payment_type
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      ORDER BY pb.date DESC
    `);

    // Then get products and payments for each bill
    const billsWithDetails = await Promise.all(
      bills.map(async (bill) => {
        // Get products for this bill
        const products = await db.query(`
          SELECT 
            pbp.product_id as productId,
            p.name,
            pbp.quantity as qty,
            pbp.price
          FROM purchase_bill_products pbp
          JOIN products p ON pbp.product_id = p.product_id
          WHERE pbp.bill_id = ?
        `, [bill.bill_id]);

        // Get payments for this bill
        const payments = await db.query(`
          SELECT 
            amount,
            source,
            date,
            pr_number as prNumber
          FROM purchase_bill_payments 
          WHERE bill_id = ?
        `, [bill.bill_id]);

        return {
          ...bill,
          products: products,
          payments: payments
        };
      })
    );

    res.status(200).json(billsWithDetails);
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

  let connection;
  try {
    // Start a transaction
    connection = await db.beginTransaction();

    // Calculate total amount
    const totalAmount = products.reduce((sum, p) => sum + p.quantity * p.price, 0);
    const paidAmount = payment && payment.amount > 0 ? payment.amount : 0;

    // Insert purchase bill
    const billResult = await connection.run(`
      INSERT INTO purchase_bills (invoice_no, vendor_id, date, total_amount, paid_amount, payment_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [invoiceNo, vendorId, date, totalAmount, paidAmount, paymentType]);

    const billId = billResult.id;

    // Get the inserted bill
    const bill = await connection.get(`
      SELECT * FROM purchase_bills WHERE bill_id = ?
    `, [billId]);

    // Insert products and update stock
    for (const product of products) {
      await connection.run(`
        INSERT INTO purchase_bill_products (bill_id, product_id, quantity, price)
        VALUES (?, ?, ?, ?)
      `, [billId, product.productId, product.quantity, product.price]);

      // Update stock in products table
      await connection.run(`
        UPDATE products
        SET stock = stock + ?
        WHERE product_id = ?
      `, [product.quantity, product.productId]);
    }

    // Insert initial payment if provided
    if (payment && payment.amount > 0) {
      await connection.run(`
        INSERT INTO purchase_bill_payments (bill_id, amount, source, date, pr_number)
        VALUES (?, ?, ?, ?, ?)
      `, [billId, payment.amount, payment.source, payment.date, payment.prNumber || null]);
    }

    // Commit transaction
    await db.commit(connection);

    // Fetch the full bill with products and payments
    const vendorInfo = await db.get(`
      SELECT name FROM vendors WHERE vendor_id = ?
    `, [vendorId]);

    // Get products for this bill
    const billProducts = await db.query(`
      SELECT 
        pbp.product_id as productId,
        p.name,
        pbp.quantity as qty,
        pbp.price
      FROM purchase_bill_products pbp
      JOIN products p ON pbp.product_id = p.product_id
      WHERE pbp.bill_id = ?
    `, [billId]);

    // Get payments for this bill
    const billPayments = await db.query(`
      SELECT 
        amount,
        source,
        date,
        pr_number as prNumber
      FROM purchase_bill_payments 
      WHERE bill_id = ?
    `, [billId]);

    res.status(201).json({
      ...bill,
      vendor_name: vendorInfo.name,
      products: billProducts,
      payments: billPayments
    });
  } catch (err) {
    if (connection) await db.rollback(connection);
    console.error('Error creating purchase bill:', err);
    if (err.code === 'ER_DUP_ENTRY') {
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

  let connection;
  try {
    // Start transaction
    connection = await db.beginTransaction();

    // Check current balance and get vendor info
    const billResult = await connection.query(`
      SELECT pb.balance, pb.vendor_id, v.name as vendor_name
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      WHERE pb.bill_id = ?
    `, [bill_id]);
    
    if (billResult.length === 0) {
      await db.rollback(connection);
      return res.status(404).json({ error: 'Purchase bill not found.' });
    }
    
    const balance = billResult[0].balance;
    const vendorId = billResult[0].vendor_id;
    const vendorName = billResult[0].vendor_name;

    if (amount > balance) {
      await db.rollback(connection);
      return res.status(400).json({ error: 'Payment amount exceeds remaining balance.' });
    }

    // Insert payment
    await connection.run(`
      INSERT INTO purchase_bill_payments (bill_id, amount, source, date, pr_number)
      VALUES (?, ?, ?, ?, ?)
    `, [bill_id, amount, source, date, prNumber || null]);

    // Update bill's paid_amount
    await connection.run(`
      UPDATE purchase_bills
      SET paid_amount = paid_amount + ?
      WHERE bill_id = ?
    `, [amount, bill_id]);

    // Commit transaction
    await db.commit(connection);

    // Fetch updated bill details
    const updatedBill = await db.get(`
      SELECT * FROM purchase_bills WHERE bill_id = ?
    `, [bill_id]);

    // Get products for this bill
    const billProducts = await db.query(`
      SELECT 
        pbp.product_id as productId,
        p.name,
        pbp.quantity as qty,
        pbp.price
      FROM purchase_bill_products pbp
      JOIN products p ON pbp.product_id = p.product_id
      WHERE pbp.bill_id = ?
    `, [bill_id]);

    // Get payments for this bill
    const billPayments = await db.query(`
      SELECT 
        amount,
        source,
        date,
        pr_number as prNumber
      FROM purchase_bill_payments 
      WHERE bill_id = ?
    `, [bill_id]);

    res.status(200).json({
      ...updatedBill,
      vendor_name: vendorName,
      products: billProducts,
      payments: billPayments
    });
  } catch (err) {
    if (connection) await db.rollback(connection);
    console.error('Error adding payment:', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// GET /api/purchase_bills/vendors - Fetch all vendors for dropdown
router.get('/vendors', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT vendor_id AS id, name
      FROM vendors
      ORDER BY name ASC
    `);
    res.status(200).json(result);
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET /api/purchase_bills/products - Fetch all products for dropdown
router.get('/products', async (req, res) => {
  try {
    const result = await db.query(`
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
    res.status(200).json(result);
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

// GET /api/purchase_bills/:id - Get a single purchase bill with details
router.get('/:id', async (req, res) => {
  try {
    const billId = req.params.id;

    // Get bill with vendor info
    const bill = await db.get(`
      SELECT 
        pb.bill_id,
        pb.invoice_no,
        pb.vendor_id,
        v.name AS vendor_name,
        pb.date,
        pb.total_amount,
        pb.paid_amount,
        pb.balance,
        pb.payment_type
      FROM purchase_bills pb
      JOIN vendors v ON pb.vendor_id = v.vendor_id
      WHERE pb.bill_id = ?
    `, [billId]);

    if (!bill) {
      return res.status(404).json({ error: 'Purchase bill not found' });
    }

    // Get products for this bill
    const products = await db.query(`
      SELECT 
        pbp.product_id as productId,
        p.name,
        pbp.quantity as qty,
        pbp.price
      FROM purchase_bill_products pbp
      JOIN products p ON pbp.product_id = p.product_id
      WHERE pbp.bill_id = ?
    `, [billId]);

    // Get payments for this bill
    const payments = await db.query(`
      SELECT 
        amount,
        source,
        date,
        pr_number as prNumber
      FROM purchase_bill_payments 
      WHERE bill_id = ?
    `, [billId]);

    res.json({
      ...bill,
      products: products,
      payments: payments
    });
  } catch (err) {
    console.error('Error fetching purchase bill:', err);
    res.status(500).json({ error: 'Failed to fetch purchase bill' });
  }
});

module.exports = router;