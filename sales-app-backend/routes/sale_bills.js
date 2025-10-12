const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/sale_bills - Fetch all sale bills with products and payments
router.get('/', async (req, res) => {
  try {
    // First get all sale bills with customer info
    const bills = await db.query(`
      SELECT 
        sb.bill_id,
        sb.bill_number,
        sb.customer_id,
        c.name AS customer_name,
        sb.date,
        sb.total_amount,
        sb.paid_amount,
        sb.balance,
        sb.payment_type
      FROM sale_bills sb
      JOIN customers c ON sb.customer_id = c.customer_id
      ORDER BY sb.date DESC
    `);

    // Then get products and payments for each bill
    const billsWithDetails = await Promise.all(
      bills.map(async (bill) => {
        // Get products for this bill
        const products = await db.query(`
          SELECT 
            sbp.product_id,
            p.name,
            sbp.quantity as qty,
            sbp.sale_price,
            p.unit
          FROM sale_bill_products sbp
          JOIN products p ON sbp.product_id = p.product_id
          WHERE sbp.bill_id = ?
        `, [bill.bill_id]);

        // Get payments for this bill
        const payments = await db.query(`
          SELECT 
            amount,
            source,
            date,
            pr_number
          FROM sale_bill_payments 
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
    console.error('Error fetching sale bills:', err);
    res.status(500).json({ error: 'Failed to fetch sale bills' });
  }
});

// GET /api/sale_bills/payment_sources - Fetch valid payment sources
router.get('/payment_sources', async (req, res) => {
  try {
    res.status(200).json(['Cash', 'Bank Transfer', 'Cheque']);
  } catch (err) {
    console.error('Error fetching payment sources:', err);
    res.status(500).json({ error: 'Failed to fetch payment sources' });
  }
});

// POST /api/sale_bills - Create a new sale
router.post('/', async (req, res) => {
  const { billNumber, customerId, paymentType, cashPaid, creditRemaining, grandTotal, items } = req.body;

  console.log('Received data:', req.body);

  // FIXED VALIDATION: Check for null/undefined specifically, not falsy
  if (!billNumber || customerId === undefined || customerId === null || !paymentType || !items || !Array.isArray(items) || items.length === 0) {
    console.log('Validation failed:', { 
      billNumber, 
      customerId, 
      paymentType, 
      items, 
      itemsLength: items?.length 
    });
    return res.status(400).json({ error: 'Bill number, customer ID, payment type, and at least one item are required.' });
  }

  if (!['Cash', 'Credit', 'Cash+Credit'].includes(paymentType)) {
    return res.status(400).json({ error: 'Invalid payment type. Must be Cash, Credit, or Cash+Credit.' });
  }
  if (cashPaid < 0 || creditRemaining < 0 || grandTotal <= 0) {
    return res.status(400).json({ error: 'Cash paid, credit remaining, and grand total must be non-negative.' });
  }
  if (Math.abs((cashPaid + creditRemaining) - grandTotal) > 0.1) {
    return res.status(400).json({ error: 'Cash paid plus credit remaining must equal grand total.' });
  }
  for (const item of items) {
    if (!item.productId || item.quantity <= 0 || item.salePrice < 0) {
      return res.status(400).json({ error: 'Each item must have a valid product ID, positive quantity, and non-negative sale price.' });
    }
  }

  let connection;
  try {
    // Start transaction - get raw MySQL connection
    connection = await db.beginTransaction();

    // Validate stock availability - use connection.execute for queries
    for (const item of items) {
      const [productResult] = await connection.execute('SELECT stock FROM products WHERE product_id = ?', [item.productId]);
      if (productResult.length === 0) {
        await db.rollback(connection);
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }
      if (productResult[0].stock < item.quantity) {
        await db.rollback(connection);
        return res.status(400).json({ error: `Insufficient stock for product ID ${item.productId}. Available: ${productResult[0].stock}, Requested: ${item.quantity}` });
      }
    }

    // Insert into sale_bills - use connection.execute for INSERT
    const [billResult] = await connection.execute(`
      INSERT INTO sale_bills (bill_number, customer_id, date, total_amount, paid_amount, balance, payment_type)
      VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
    `, [billNumber, customerId, grandTotal, cashPaid, creditRemaining, paymentType]);

    const billId = billResult.insertId;

    // Get the inserted bill - use connection.execute for SELECT
    const [billRows] = await connection.execute(`
      SELECT bill_id, bill_number, customer_id, date, total_amount, paid_amount, balance, payment_type
      FROM sale_bills WHERE bill_id = ?
    `, [billId]);

    const bill = billRows[0];

    // Insert into sale_bill_products
    const products = [];
    for (const item of items) {
      await connection.execute(`
        INSERT INTO sale_bill_products (bill_id, product_id, quantity, sale_price)
        VALUES (?, ?, ?, ?)
      `, [billId, item.productId, item.quantity, item.salePrice]);

      // Update product stock
      await connection.execute(`
        UPDATE products
        SET stock = stock - ?
        WHERE product_id = ?
      `, [item.quantity, item.productId]);

      // Get updated product info
      const [productInfoRows] = await connection.execute(`
        SELECT product_id, name, unit FROM products WHERE product_id = ?
      `, [item.productId]);

      const productInfo = productInfoRows[0];
      products.push({
        product_id: productInfo.product_id,
        name: productInfo.name,
        qty: item.quantity,
        sale_price: parseFloat(item.salePrice),
        unit: productInfo.unit || 'Unit',
      });
    }

    // Insert into sale_bill_payments if cashPaid > 0
    const payments = [];
    if (cashPaid > 0) {
      const paymentSource = paymentType === 'Cash' ? 'Cash' : 'Cash+Credit';
      await connection.execute(`
        INSERT INTO sale_bill_payments (bill_id, amount, source, date, pr_number)
        VALUES (?, ?, ?, CURDATE(), ?)
      `, [billId, cashPaid, paymentSource, null]);
      payments.push({
        amount: parseFloat(cashPaid),
        source: paymentSource,
        date: bill.date,
        pr_number: null,
      });
    }

    // Fetch customer name
    const [customerRows] = await connection.execute('SELECT name FROM customers WHERE customer_id = ?', [customerId]);
    const customerName = customerRows[0]?.name || 'Unknown';

    // Commit transaction
    await db.commit(connection);

    res.status(201).json({
      bill_id: bill.bill_id,
      bill_number: bill.bill_number,
      customer_id: bill.customer_id,
      customer_name: customerName,
      date: bill.date,
      total_amount: parseFloat(bill.total_amount),
      paid_amount: parseFloat(bill.paid_amount),
      balance: parseFloat(bill.balance),
      payment_type: bill.payment_type,
      products,
      payments,
    });
  } catch (err) {
    if (connection) await db.rollback(connection);
    console.error('Error saving sale:', err);
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bill number already exists.' });
    }
    
    res.status(500).json({ error: 'Failed to save sale' });
  }
});

// POST /api/sale_bills/:bill_id/payments - Add a payment to an existing sale bill
router.post('/:bill_id/payments', async (req, res) => {
  const { bill_id } = req.params;
  const { amount, source, date, pr_number } = req.body;

  // Validation
  if (!amount || amount <= 0 || !source || !['Cash', 'Bank Transfer', 'Cheque'].includes(source)) {
    return res.status(400).json({ error: 'Valid amount and source are required.' });
  }

  let connection;
  try {
    // Start transaction
    connection = await db.beginTransaction();

    // Check if bill exists and get current balance
    const [billRows] = await connection.execute('SELECT balance, paid_amount FROM sale_bills WHERE bill_id = ?', [bill_id]);
    if (billRows.length === 0) {
      await db.rollback(connection);
      return res.status(404).json({ error: 'Sale bill not found.' });
    }

    const currentBalance = parseFloat(billRows[0].balance);
    const currentPaid = parseFloat(billRows[0].paid_amount);
    if (amount > currentBalance) {
      await db.rollback(connection);
      return res.status(400).json({ error: `Payment amount (${amount}) exceeds current balance (${currentBalance}).` });
    }

    // Insert payment
    await connection.execute(`
      INSERT INTO sale_bill_payments (bill_id, amount, source, date, pr_number)
      VALUES (?, ?, ?, ?, ?)
    `, [bill_id, amount, source, date || new Date().toISOString().substring(0, 10), pr_number]);

    // Update sale bill
    const newPaidAmount = currentPaid + amount;
    const newBalance = currentBalance - amount;
    await connection.execute(`
      UPDATE sale_bills
      SET paid_amount = ?, balance = ?
      WHERE bill_id = ?
    `, [newPaidAmount, newBalance, bill_id]);

    // Fetch updated bill with customer
    const [updatedBillRows] = await connection.execute(`
      SELECT 
        sb.bill_id,
        sb.bill_number,
        sb.customer_id,
        c.name AS customer_name,
        sb.date,
        sb.total_amount,
        sb.paid_amount,
        sb.balance,
        sb.payment_type
      FROM sale_bills sb
      JOIN customers c ON sb.customer_id = c.customer_id
      WHERE sb.bill_id = ?
    `, [bill_id]);

    const updatedBill = updatedBillRows[0];

    // Get products for this bill
    const [productRows] = await connection.execute(`
      SELECT 
        sbp.product_id,
        p.name,
        sbp.quantity as qty,
        sbp.sale_price,
        p.unit
      FROM sale_bill_products sbp
      JOIN products p ON sbp.product_id = p.product_id
      WHERE sbp.bill_id = ?
    `, [bill_id]);

    // Get payments for this bill
    const [paymentRows] = await connection.execute(`
      SELECT 
        amount,
        source,
        date,
        pr_number
      FROM sale_bill_payments 
      WHERE bill_id = ?
    `, [bill_id]);

    // Commit transaction
    await db.commit(connection);

    res.status(201).json({
      ...updatedBill,
      products: productRows,
      payments: paymentRows
    });
  } catch (err) {
    if (connection) await db.rollback(connection);
    console.error('Error adding payment:', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// GET /api/sale_bills/:id - Get a single sale bill with details
router.get('/:id', async (req, res) => {
  try {
    const billId = req.params.id;

    // Get bill with customer info
    const bill = await db.get(`
      SELECT 
        sb.bill_id,
        sb.bill_number,
        sb.customer_id,
        c.name AS customer_name,
        sb.date,
        sb.total_amount,
        sb.paid_amount,
        sb.balance,
        sb.payment_type
      FROM sale_bills sb
      JOIN customers c ON sb.customer_id = c.customer_id
      WHERE sb.bill_id = ?
    `, [billId]);

    if (!bill) {
      return res.status(404).json({ error: 'Sale bill not found' });
    }

    // Get products for this bill
    const products = await db.query(`
      SELECT 
        sbp.product_id,
        p.name,
        sbp.quantity as qty,
        sbp.sale_price,
        p.unit
      FROM sale_bill_products sbp
      JOIN products p ON sbp.product_id = p.product_id
      WHERE sbp.bill_id = ?
    `, [billId]);

    // Get payments for this bill
    const payments = await db.query(`
      SELECT 
        amount,
        source,
        date,
        pr_number
      FROM sale_bill_payments 
      WHERE bill_id = ?
    `, [billId]);

    res.json({
      ...bill,
      products: products,
      payments: payments
    });
  } catch (err) {
    console.error('Error fetching sale bill:', err);
    res.status(500).json({ error: 'Failed to fetch sale bill' });
  }
});

module.exports = router;