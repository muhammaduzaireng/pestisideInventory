const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');

function generateInvoiceNumber() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseNumericFields(obj) {
  return {
    ...obj,
    total_bill_amount: parseFloat(obj.total_bill_amount) || 0,
    amount_paid: parseFloat(obj.amount_paid) || 0,
    credit_amount: parseFloat(obj.credit_amount) || 0,
  };
}

router.post('/', async (req, res) => {
  const {
    vendor_id,
    purchase_date,
    payment_method,
    amount_paid,
    credit_due_date,
    transaction_id,
    bank_name,
    products,
  } = req.body;

  if (!vendor_id || !purchase_date || !payment_method || !products || products.length === 0) {
    return res.status(400).json({ error: 'Missing required fields for stock purchase.' });
  }

  let connection;
  try {
    if (!pool.getConnection) {
      throw new Error('Database pool is not properly initialized.');
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let total_bill_amount = 0;
    for (const item of products) {
      if (!item.product_id || item.added_stock <= 0 || item.purchase_price < 0 || item.sell_price < 0) {
        throw new Error('Invalid product data in purchase list.');
      }
      total_bill_amount += item.added_stock * item.purchase_price;
    }

    let final_amount_paid = 0;
    let final_credit_amount = 0;
    let final_credit_due_date = null;
    let final_transaction_id = null;
    let final_bank_name = null;

    switch (payment_method) {
      case 'cash':
      case 'bank_transfer':
        final_amount_paid = total_bill_amount;
        break;
      case 'credit':
        final_credit_amount = total_bill_amount;
        final_credit_due_date = credit_due_date;
        if (!credit_due_date) throw new Error('Credit due date is required for credit payments.');
        break;
      case 'cash_and_credit':
        if (amount_paid === undefined || amount_paid < 0 || amount_paid > total_bill_amount) {
          throw new Error('Invalid amount paid for cash & credit.');
        }
        final_amount_paid = amount_paid;
        final_credit_amount = total_bill_amount - amount_paid;
        final_credit_due_date = credit_due_date;
        if (!credit_due_date) throw new Error('Credit due date is required for cash & credit payments.');
        break;
      default:
        throw new Error('Invalid payment method.');
    }

    if (payment_method === 'bank_transfer') {
      if (!transaction_id || !bank_name) {
        throw new Error('Transaction ID and Bank Name are required for bank transfer.');
      }
      final_transaction_id = transaction_id;
      final_bank_name = bank_name;
    }

    const invoice_number = generateInvoiceNumber();

    const [invoiceResult] = await connection.query(
      `INSERT INTO stock_purchase_invoices (
        invoice_number, vendor_id, purchase_date, total_bill_amount,
        payment_method, amount_paid, credit_amount, credit_due_date,
        transaction_id, bank_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        invoice_number,
        vendor_id,
        purchase_date,
        total_bill_amount,
        payment_method,
        final_amount_paid,
        final_credit_amount,
        final_credit_due_date,
        final_transaction_id,
        final_bank_name,
      ]
    );
    const invoiceId = invoiceResult.insertId;

    for (const item of products) {
      const [productCheck] = await connection.query('SELECT name, barcode, expiry_date_tracking FROM products WHERE id = ?', [
        item.product_id,
      ]);
      if (productCheck.length === 0) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }
      const expiry_date_tracking = productCheck[0].expiry_date_tracking;
      const final_expiry_date = expiry_date_tracking ? item.expiry_date : null;

      if (expiry_date_tracking && !item.expiry_date) {
        throw new Error(`Expiry date is required for product ID ${item.product_id}.`);
      }

      await connection.query(
        `INSERT INTO stock_entries (
          stock_purchase_invoice_id, product_id, added_stock,
          purchase_price, sell_price, purchase_date, expiry_date,
          payment_method, credit_due_date, transaction_id, bank_name, vendor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          invoiceId,
          item.product_id,
          item.added_stock,
          item.purchase_price,
          item.sell_price,
          purchase_date,
          final_expiry_date,
          payment_method,
          final_credit_due_date,
          final_transaction_id,
          final_bank_name,
          vendor_id,
        ]
      );

      // Update products table with stock, purchase_price, sell_price, and expiry_date
      const updateQuery = expiry_date_tracking
        ? 'UPDATE products SET stock = stock + ?, purchase_price = ?, sell_price = ?, expiry_date = ? WHERE id = ?'
        : 'UPDATE products SET stock = stock + ?, purchase_price = ?, sell_price = ? WHERE id = ?';
      const updateParams = expiry_date_tracking
        ? [item.added_stock, item.purchase_price, item.sell_price, final_expiry_date, item.product_id]
        : [item.added_stock, item.purchase_price, item.sell_price, item.product_id];
      await connection.query(updateQuery, updateParams);
    }

    await connection.commit();
    res.status(201).json({ success: true, invoice_id: invoiceId, invoice_number });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error recording stock purchase:', err);
    res.status(500).json({ error: 'Failed to record stock purchase', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/', async (req, res) => {
  try {
    const { vendor_id, start_date, end_date, invoice_number } = req.query;
    const params = [];
    let query = `
      SELECT spi.*, v.name AS vendor_name
      FROM stock_purchase_invoices spi
      LEFT JOIN vendors v ON spi.vendor_id = v.id
      WHERE 1=1
    `;
    if (vendor_id) {
      query += ' AND spi.vendor_id = ?';
      params.push(vendor_id);
    }
    if (start_date) {
      query += ' AND spi.purchase_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND spi.purchase_date <= ?';
      params.push(end_date);
    }
    if (invoice_number) {
      query += ' AND spi.invoice_number LIKE ?';
      params.push(`%${invoice_number}%`);
    }
    query += ' ORDER BY spi.purchase_date DESC, spi.created_at DESC';
    console.log('Executing stock-purchases query:', query, 'with params:', params);
    const invoices = await queryWithRetry(query, params);
    for (const invoice of invoices) {
      const items = await queryWithRetry(
        `
        SELECT se.*, p.name AS product_name, p.barcode AS barcode
        FROM stock_entries se
        JOIN products p ON se.product_id = p.id
        WHERE se.stock_purchase_invoice_id = ?
        `,
        [invoice.id]
      );
      console.log(`Fetched items for invoice_id ${invoice.id}:`, items);
      invoice.items = items.map(item => ({
        id: item.id,
        product_name: item.product_name || 'Unknown Product',
        barcode: item.barcode || 'N/A',
        added_stock: parseInt(item.added_stock) || 0,
        purchase_price: parseFloat(item.purchase_price) || 0,
        sell_price: parseFloat(item.sell_price) || 0,
        expiry_date: item.expiry_date || null,
      }));
    }
    res.json(invoices.map(parseNumericFields));
  } catch (error) {
    console.error('Error fetching stock purchases:', error);
    res.status(500).json({ error: `Failed to fetch stock purchases: ${error.message}` });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching invoice with ID:', id);
    const invoices = await queryWithRetry(
      `
      SELECT spi.*, v.name AS vendor_name
      FROM stock_purchase_invoices spi
      LEFT JOIN vendors v ON spi.vendor_id = v.id
      WHERE spi.id = ?
      `,
      [id]
    );
    console.log('Fetched invoice:', invoices);
    if (invoices.length === 0) {
      return res.status(404).json({ error: `Invoice with ID ${id} not found` });
    }
    const items = await queryWithRetry(
      `
      SELECT se.*, p.name AS product_name, p.barcode AS barcode
      FROM stock_entries se
      JOIN products p ON se.product_id = p.id
      WHERE se.stock_purchase_invoice_id = ?
      `,
      [id]
    );
    console.log('Fetched items for invoice_id:', id, items);
    invoices[0].items = items.map(item => ({
      id: item.id,
      product_name: item.product_name || 'Unknown Product',
      barcode: item.barcode || 'N/A',
      added_stock: parseInt(item.added_stock) || 0,
      purchase_price: parseFloat(item.purchase_price) || 0,
      sell_price: parseFloat(item.sell_price) || 0,
      expiry_date: item.expiry_date || null,
    }));
    res.json(parseNumericFields(invoices[0]));
  } catch (error) {
    console.error('Error fetching single stock purchase invoice:', error);
    res.status(500).json({ error: `Failed to fetch invoice: ${error.message}` });
  }
});

router.put('/:id/pay-credit', async (req, res) => {
  const invoiceId = req.params.id;
  const { amount_paid: currentPaymentAmount, payment_date, new_credit_due_date } = req.body;

  if (typeof currentPaymentAmount !== 'number' || currentPaymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid amount_paid (number > 0) is required.' });
  }
  if (!payment_date) {
    return res.status(400).json({ error: 'Payment date is required.' });
  }

  let connection;
  try {
    if (!pool.getConnection) {
      throw new Error('Database pool is not properly initialized.');
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [invoiceResult] = await connection.query(
      `SELECT total_bill_amount, amount_paid, credit_amount FROM stock_purchase_invoices WHERE id = ?`,
      [invoiceId]
    );

    if (invoiceResult.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const currentInvoice = parseNumericFields(invoiceResult[0]);
    const { total_bill_amount, amount_paid: existingAmountPaid, credit_amount: existingCreditAmount } = currentInvoice;

    if (currentPaymentAmount > existingCreditAmount) {
      await connection.rollback();
      return res.status(400).json({
        error: `Payment amount exceeds remaining credit of PKR ${existingCreditAmount.toFixed(2)}.`,
      });
    }

    const newAmountPaid = existingAmountPaid + currentPaymentAmount;
    const newCreditAmount = existingCreditAmount - currentPaymentAmount;

    let updateQuery = `
      UPDATE stock_purchase_invoices
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
    queryParams.push(invoiceId);

    await connection.query(updateQuery, queryParams);

    await connection.query(
      `INSERT INTO credit_payments (invoice_id, payment_date, amount_paid, invoice_type) VALUES (?, ?, ?, 'purchase')`,
      [invoiceId, payment_date, currentPaymentAmount]
    );

    await connection.commit();
    res.status(200).json({ message: 'Credit payment recorded successfully.', newCreditAmount });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error paying credit:', error);
    res.status(500).json({ error: `Failed to record payment: ${error.message}` });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;