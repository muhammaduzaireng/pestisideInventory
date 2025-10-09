const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/sale_bills - Fetch all sale bills with products and payments
router.get('/', async (req, res) => {
  try {
    const billsResult = await query(`
      SELECT 
        sb.bill_id,
        sb.bill_number,
        sb.customer_id,
        c.name AS customer_name,
        sb.date,
        sb.total_amount,
        sb.paid_amount,
        sb.balance,
        sb.payment_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'product_id', sbp.product_id,
              'name', p.name,
              'qty', sbp.quantity,
              'sale_price', sbp.sale_price,
              'unit', p.unit
            )
          )
          FROM sale_bill_products sbp
          JOIN products p ON sbp.product_id = p.product_id
          WHERE sbp.bill_id = sb.bill_id
        ), '[]') AS products,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'amount', sbpay.amount,
              'source', sbpay.source,
              'date', sbpay.date,
              'pr_number', sbpay.pr_number
            )
          )
          FROM sale_bill_payments sbpay
          WHERE sbpay.bill_id = sb.bill_id
        ), '[]') AS payments
      FROM sale_bills sb
      JOIN customers c ON sb.customer_id = c.customer_id
      ORDER BY sb.date DESC
    `);

    res.status(200).json(billsResult.rows);
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

  // Validation
  if (!billNumber || !customerId || !paymentType || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Bill number, customer ID, payment type, and at least one item are required.' });
  }
  if (!['Cash', 'Credit', 'Cash+Credit'].includes(paymentType)) {
    return res.status(400).json({ error: 'Invalid payment type. Must be Cash, Credit, or Cash+Credit.' });
  }
  if (cashPaid < 0 || creditRemaining < 0 || grandTotal <= 0) {
    return res.status(400).json({ error: 'Cash paid, credit remaining, and grand total must be non-negative.' });
  }
  if (Math.abs((cashPaid + creditRemaining) - grandTotal) > 0.1) { // Increase to 0.1
  return res.status(400).json({ error: 'Cash paid plus credit remaining must equal grand total.' });
}
  for (const item of items) {
    if (!item.productId || item.quantity <= 0 || item.salePrice < 0) {
      return res.status(400).json({ error: 'Each item must have a valid product ID, positive quantity, and non-negative sale price.' });
    }
  }

  try {
    // Start transaction
    await query('BEGIN');

    // Validate stock availability
    for (const item of items) {
      const productResult = await query('SELECT stock FROM products WHERE product_id = $1', [item.productId]);
      if (productResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }
      if (productResult.rows[0].stock < item.quantity) {
        await query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for product ID ${item.productId}. Available: ${productResult.rows[0].stock}, Requested: ${item.quantity}` });
      }
    }

    // Insert into sale_bills
    const billResult = await query(`
      INSERT INTO sale_bills (bill_number, customer_id, date, total_amount, paid_amount, balance, payment_type)
      VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)
      RETURNING bill_id, bill_number, customer_id, date, total_amount, paid_amount, balance, payment_type
    `, [billNumber, customerId, grandTotal, cashPaid, creditRemaining, paymentType]);

    const bill = billResult.rows[0];
    const billId = bill.bill_id;

    // Insert into sale_bill_products
    const products = [];
    for (const item of items) {
      await query(`
        INSERT INTO sale_bill_products (bill_id, product_id, quantity, sale_price)
        VALUES ($1, $2, $3, $4)
      `, [billId, item.productId, item.quantity, item.salePrice]);

      // Update product stock
      const productResult = await query(`
        UPDATE products
        SET stock = stock - $1
        WHERE product_id = $2
        RETURNING product_id, name, unit
      `, [item.quantity, item.productId]);

      products.push({
        product_id: productResult.rows[0].product_id,
        name: productResult.rows[0].name,
        qty: item.quantity,
        sale_price: parseFloat(item.salePrice),
        unit: productResult.rows[0].unit || 'Unit',
      });
    }

    // Insert into sale_bill_payments if cashPaid > 0
    const payments = [];
    if (cashPaid > 0) {
      const paymentSource = paymentType === 'Cash' ? 'Cash' : 'Cash+Credit';
      await query(`
        INSERT INTO sale_bill_payments (bill_id, amount, source, date, pr_number)
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
      `, [billId, cashPaid, paymentSource, null]);
      payments.push({
        amount: parseFloat(cashPaid),
        source: paymentSource,
        date: bill.date,
        pr_number: null,
      });
    }

    // Fetch customer name
    const customerResult = await query('SELECT name FROM customers WHERE customer_id = $1', [customerId]);
    const customerName = customerResult.rows[0]?.name || 'Unknown';

    // Commit transaction
    await query('COMMIT');

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
    await query('ROLLBACK');
    console.error('Error saving sale:', err);
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

  try {
    // Start transaction
    await query('BEGIN');

    // Check if bill exists and get current balance
    const billResult = await query('SELECT balance, paid_amount FROM sale_bills WHERE bill_id = $1', [bill_id]);
    if (billResult.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Sale bill not found.' });
    }

    const currentBalance = parseFloat(billResult.rows[0].balance);
    const currentPaid = parseFloat(billResult.rows[0].paid_amount);
    if (amount > currentBalance) {
      await query('ROLLBACK');
      return res.status(400).json({ error: `Payment amount (${amount}) exceeds current balance (${currentBalance}).` });
    }

    // Insert payment
    await query(`
      INSERT INTO sale_bill_payments (bill_id, amount, source, date, pr_number)
      VALUES ($1, $2, $3, $4, $5)
    `, [bill_id, amount, source, date || new Date().toISOString().substring(0, 10), pr_number]);

    // Update sale bill
    const newPaidAmount = currentPaid + amount;
    const newBalance = currentBalance - amount;
    await query(`
      UPDATE sale_bills
      SET paid_amount = $1, balance = $2
      WHERE bill_id = $3
    `, [newPaidAmount, newBalance, bill_id]);

    // Fetch updated bill with customer and products
    const updatedBillResult = await query(`
      SELECT 
        sb.bill_id,
        sb.bill_number,
        sb.customer_id,
        c.name AS customer_name,
        sb.date,
        sb.total_amount,
        sb.paid_amount,
        sb.balance,
        sb.payment_type,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'product_id', sbp.product_id,
              'name', p.name,
              'qty', sbp.quantity,
              'sale_price', sbp.sale_price,
              'unit', p.unit
            )
          )
          FROM sale_bill_products sbp
          JOIN products p ON sbp.product_id = p.product_id
          WHERE sbp.bill_id = sb.bill_id
        ), '[]') AS products,
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'amount', sbpay.amount,
              'source', sbpay.source,
              'date', sbpay.date,
              'pr_number', sbpay.pr_number
            )
          )
          FROM sale_bill_payments sbpay
          WHERE sbpay.bill_id = sb.bill_id
        ), '[]') AS payments
      FROM sale_bills sb
      JOIN customers c ON sb.customer_id = c.customer_id
      WHERE sb.bill_id = $1
    `, [bill_id]);

    // Commit transaction
    await query('COMMIT');

    res.status(201).json(updatedBillResult.rows[0]);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error adding payment:', err);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

module.exports = router;