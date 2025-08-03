const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');

function generateInvoiceNumber() {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseNumericFields(obj) {
  console.log('Parsing numeric fields for:', JSON.stringify(obj, null, 2));
  const result = {
    ...obj,
    total_bill_amount: parseFloatOrDefault(obj.total_bill_amount, 0),
    amount_paid: parseFloatOrDefault(obj.amount_paid, 0),
    credit_amount: parseFloatOrDefault(obj.credit_amount, 0),
  };
  if (Object.values(result).some(val => isNaN(val) && typeof val === 'number')) {
    throw new Error(`NaN detected in numeric fields: ${JSON.stringify(result, null, 2)}`);
  }
  console.log('Parsed numeric fields:', JSON.stringify(result, null, 2));
  return result;
}

function parseFloatOrDefault(value, defaultValue) {
  if (value === null || value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parseFloat(parsed.toFixed(2));
}

function parseProductFields(products) {
  console.log('Parsing product fields:', JSON.stringify(products, null, 2));
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Products array is empty or invalid');
  }
  const parsedProducts = products.map((item, index) => {
    if (!item.product_id || item.added_stock == null) {
      throw new Error(`Missing product_id or added_stock for product at index ${index}`);
    }
    const parsedStock = parseInt(item.added_stock);
    const parsedProductId = parseInt(item.product_id);
    if (isNaN(parsedStock) || parsedStock <= 0) {
      throw new Error(`Invalid added_stock for product at index ${index}: ${item.added_stock}`);
    }
    if (isNaN(parsedProductId)) {
      throw new Error(`Invalid product_id for product at index ${index}: ${item.product_id}`);
    }
    return {
      ...item,
      product_id: parsedProductId,
      added_stock: parsedStock,
      expiry_date: item.expiry_date || null,
    };
  });
  console.log('Parsed product fields:', JSON.stringify(parsedProducts, null, 2));
  return parsedProducts;
}

function validateQueryParams(params, paramNames) {
  console.log('Validating query params:', JSON.stringify(params, null, 2));
  paramNames.forEach((name, index) => {
    // Allow null for expiry_date as it's nullable in stock_entries
    if (name === 'expiry_date' && params[index] === null) {
      return;
    }
    if (params[index] === null || params[index] === undefined || (typeof params[index] === 'number' && isNaN(params[index]))) {
      throw new Error(`Invalid or NaN value for ${name}: ${params[index]}`);
    }
  });
}

router.post('/', async (req, res) => {
  console.log('POST /api/stock-purchases received with body:', JSON.stringify(req.body, null, 2));
  const {
    vendor_id,
    invoice_number,
    purchase_date,
    payment_method,
    amount_paid,
    total_bill_amount,
    products,
  } = req.body;

  if (!vendor_id || !invoice_number || !purchase_date || !payment_method || total_bill_amount === undefined || !products || !Array.isArray(products) || products.length === 0) {
    console.error('Validation failed: Missing or invalid required fields', { vendor_id, invoice_number, purchase_date, payment_method, total_bill_amount, products });
    return res.status(400).json({ error: 'Missing or invalid required fields for stock purchase.' });
  }

  if (isNaN(total_bill_amount) || total_bill_amount <= 0) {
    console.error('Validation failed: Total bill amount must be a positive number.', { total_bill_amount });
    return res.status(400).json({ error: 'Total bill amount must be a positive number.' });
  }

  let connection;
  try {
    if (!pool.getConnection) {
      console.error('Database pool is not properly initialized.');
      throw new Error('Database pool is not properly initialized.');
    }
    console.log('Acquiring database connection...');
    connection = await pool.getConnection();
    console.log('Starting transaction...');
    await connection.beginTransaction();

    console.log('Validating vendor_id:', vendor_id);
    const parsedVendorId = parseInt(vendor_id);
    if (isNaN(parsedVendorId)) {
      throw new Error(`Invalid vendor_id: ${vendor_id}`);
    }
    const [vendorCheck] = await connection.query('SELECT id FROM vendors WHERE id = ?', [parsedVendorId]);
    if (vendorCheck.length === 0) {
      console.error('Validation failed: Vendor not found.', { vendor_id });
      throw new Error(`Vendor with ID ${vendor_id} not found.`);
    }

    console.log('Validating products:', JSON.stringify(products, null, 2));
    const parsedProducts = parseProductFields(products);

    let final_amount_paid = 0;
    let final_credit_amount = 0;

    console.log('Processing payment method:', payment_method);
    switch (payment_method) {
      case 'cash':
        final_amount_paid = total_bill_amount;
        break;
      case 'credit':
        final_credit_amount = total_bill_amount;
        break;
      case 'cash_and_credit':
        if (amount_paid === undefined || isNaN(amount_paid) || amount_paid < 0 || amount_paid > total_bill_amount) {
          console.error('Invalid amount paid for cash & credit:', { amount_paid, total_bill_amount });
          throw new Error('Invalid amount paid for cash & credit.');
        }
        final_amount_paid = amount_paid;
        final_credit_amount = total_bill_amount - amount_paid;
        break;
      default:
        console.error('Invalid payment method:', payment_method);
        throw new Error('Invalid payment method.');
    }

    const final_invoice_number = invoice_number || generateInvoiceNumber();
    console.log('Generated/using invoice number:', final_invoice_number);

    const invoiceData = parseNumericFields({
      invoice_number: final_invoice_number,
      vendor_id: parsedVendorId,
      purchase_date,
      total_bill_amount,
      payment_method,
      amount_paid: final_amount_paid,
      credit_amount: final_credit_amount,
    });

    console.log('Inserting into stock_purchase_invoices:', JSON.stringify(invoiceData, null, 2));
    const invoiceParams = [
      invoiceData.invoice_number,
      invoiceData.vendor_id,
      invoiceData.purchase_date,
      invoiceData.total_bill_amount,
      invoiceData.payment_method,
      invoiceData.amount_paid,
      invoiceData.credit_amount,
    ];
    validateQueryParams(invoiceParams, [
      'invoice_number',
      'vendor_id',
      'purchase_date',
      'total_bill_amount',
      'payment_method',
      'amount_paid',
      'credit_amount',
    ]);
    const [invoiceResult] = await connection.query(
      `INSERT INTO stock_purchase_invoices (
        invoice_number, vendor_id, purchase_date, total_bill_amount,
        payment_method, amount_paid, credit_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      invoiceParams
    );
    const invoiceId = invoiceResult.insertId;
    console.log('Inserted stock_purchase_invoices, invoiceId:', invoiceId);

    for (const [index, item] of parsedProducts.entries()) {
      console.log(`Checking product at index ${index}:`, item.product_id);
      const [productCheck] = await connection.query('SELECT name, barcode, expiry_date_tracking, vendor_id FROM products WHERE id = ?', [
        item.product_id,
      ]);
      if (productCheck.length === 0) {
        console.error(`Product not found at index ${index}:`, item.product_id);
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }
      if (productCheck[0].vendor_id !== parsedVendorId) {
        console.error(`Product vendor mismatch at index ${index}:`, { product_id: item.product_id, product_vendor_id: productCheck[0].vendor_id, vendor_id });
        throw new Error(`Product with ID ${item.product_id} does not belong to vendor ID ${vendor_id}.`);
      }
      const expiry_date_tracking = productCheck[0].expiry_date_tracking;
      const final_expiry_date = expiry_date_tracking ? item.expiry_date : null;
      console.log('Product details:', { name: productCheck[0].name, barcode: productCheck[0].barcode, expiry_date_tracking, final_expiry_date });

      if (expiry_date_tracking && !item.expiry_date) {
        console.error(`Expiry date missing for product at index ${index}:`, item.product_id);
        throw new Error(`Expiry date is required for product ID ${item.product_id}.`);
      }

      const stockEntryParams = [
        invoiceId,
        item.product_id,
        item.added_stock,
        purchase_date,
        final_expiry_date,
        payment_method,
        parsedVendorId,
      ];
      console.log('Inserting into stock_entries with params:', JSON.stringify(stockEntryParams, null, 2));
      validateQueryParams(stockEntryParams, [
        'stock_purchase_invoice_id',
        'product_id',
        'added_stock',
        'purchase_date',
        'expiry_date',
        'payment_method',
        'vendor_id',
      ]);
      await connection.query(
        `INSERT INTO stock_entries (
          stock_purchase_invoice_id, product_id, added_stock,
          purchase_date, expiry_date, payment_method, vendor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        stockEntryParams
      );

      console.log('Updating products table for product:', item.product_id);
      const productUpdateParams = expiry_date_tracking
        ? [item.added_stock, final_expiry_date, item.product_id]
        : [item.added_stock, item.product_id];
      validateQueryParams(productUpdateParams, expiry_date_tracking
        ? ['added_stock', 'expiry_date', 'product_id']
        : ['added_stock', 'product_id']);
      await connection.query(
        `UPDATE products SET stock = stock + ? ${expiry_date_tracking ? ', expiry_date = ?' : ''} WHERE id = ?`,
        productUpdateParams
      );
    }

    console.log('Committing transaction...');
    await connection.commit();
    console.log('Transaction committed, sending response:', { invoice_id: invoiceId, invoice_number: final_invoice_number });
    res.status(201).json({ success: true, invoice_id: invoiceId, invoice_number: final_invoice_number });
  } catch (err) {
    console.error('Error recording stock purchase:', {
      message: err.message,
      stack: err.stack,
      requestBody: JSON.stringify(req.body, null, 2),
    });
    if (connection) {
      console.log('Rolling back transaction...');
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ error: 'Failed to record stock purchase', details: err.message });
  } finally {
    if (connection) {
      console.log('Releasing database connection.');
      connection.release();
    }
  }
});

router.get('/', async (req, res) => {
  console.log('GET /api/stock-purchases received with query:', JSON.stringify(req.query, null, 2));
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
      params.push(parseInt(vendor_id));
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
    console.log('Executing query:', query, 'with params:', JSON.stringify(params, null, 2));
    const invoices = await queryWithRetry(query, params);
    console.log('Fetched invoices:', JSON.stringify(invoices, null, 2));
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
      console.log(`Fetched items for invoice_id ${invoice.id}:`, JSON.stringify(items, null, 2));
      invoice.items = items.map(item => ({
        id: item.id,
        product_name: item.product_name || 'Unknown Product',
        barcode: item.barcode || 'N/A',
        added_stock: parseInt(item.added_stock) || 0,
        expiry_date: item.expiry_date || null,
      }));
    }
    res.json(invoices.map(parseNumericFields));
  } catch (error) {
    console.error('Error fetching stock purchases:', {
      message: error.message,
      stack: error.stack,
      query: JSON.stringify(req.query, null, 2),
    });
    res.status(500).json({ error: `Failed to fetch stock purchases: ${error.message}` });
  }
});

router.get('/:id', async (req, res) => {
  console.log('GET /api/stock-purchases/:id received with id:', req.params.id);
  try {
    const { id } = req.params;
    const invoices = await queryWithRetry(
      `
      SELECT spi.*, v.name AS vendor_name
      FROM stock_purchase_invoices spi
      LEFT JOIN vendors v ON spi.vendor_id = v.id
      WHERE spi.id = ?
      `,
      [parseInt(id)]
    );
    console.log('Fetched invoice:', JSON.stringify(invoices, null, 2));
    if (invoices.length === 0) {
      console.error('Invoice not found for id:', id);
      return res.status(404).json({ error: `Invoice with ID ${id} not found` });
    }
    const items = await queryWithRetry(
      `
      SELECT se.*, p.name AS product_name, p.barcode AS barcode
      FROM stock_entries se
      JOIN products p ON se.product_id = p.id
      WHERE se.stock_purchase_invoice_id = ?
      `,
      [parseInt(id)]
    );
    console.log('Fetched items for invoice_id:', id, JSON.stringify(items, null, 2));
    invoices[0].items = items.map(item => ({
      id: item.id,
      product_name: item.product_name || 'Unknown Product',
      barcode: item.barcode || 'N/A',
      added_stock: parseInt(item.added_stock) || 0,
      expiry_date: item.expiry_date || null,
    }));
    res.json(parseNumericFields(invoices[0]));
  } catch (error) {
    console.error('Error fetching single stock purchase invoice:', {
      message: error.message,
      stack: error.stack,
      id: req.params.id,
    });
    res.status(500).json({ error: `Failed to fetch invoice: ${error.message}` });
  }
});

router.put('/:id/pay-credit', async (req, res) => {
  console.log('PUT /api/stock-purchases/:id/pay-credit received with id:', req.params.id, 'body:', JSON.stringify(req.body, null, 2));
  const invoiceId = req.params.id;
  const { amount_paid: currentPaymentAmount, payment_date } = req.body;

  if (typeof currentPaymentAmount !== 'number' || isNaN(currentPaymentAmount) || currentPaymentAmount <= 0) {
    console.error('Validation failed: Invalid amount_paid:', currentPaymentAmount);
    return res.status(400).json({ error: 'Valid amount_paid (number > 0) is required.' });
  }
  if (!payment_date) {
    console.error('Validation failed: Payment date is required.');
    return res.status(400).json({ error: 'Payment date is required.' });
  }

  let connection;
  try {
    if (!pool.getConnection) {
      console.error('Database pool is not properly initialized.');
      throw new Error('Database pool is not properly initialized.');
    }
    console.log('Acquiring database connection for pay-credit...');
    connection = await pool.getConnection();
    console.log('Starting transaction for pay-credit...');
    await connection.beginTransaction();

    console.log('Fetching invoice for id:', invoiceId);
    const [invoiceResult] = await connection.query(
      `SELECT total_bill_amount, amount_paid, credit_amount FROM stock_purchase_invoices WHERE id = ?`,
      [parseInt(invoiceId)]
    );

    if (invoiceResult.length === 0) {
      console.error('Invoice not found:', invoiceId);
      await connection.rollback();
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const currentInvoice = parseNumericFields(invoiceResult[0]);
    console.log('Current invoice data:', JSON.stringify(currentInvoice, null, 2));
    const { total_bill_amount, amount_paid: existingAmountPaid, credit_amount: existingCreditAmount } = currentInvoice;

    if (currentPaymentAmount > existingCreditAmount) {
      console.error('Payment amount exceeds credit:', { currentPaymentAmount, existingCreditAmount });
      await connection.rollback();
      return res.status(400).json({
        error: `Payment amount exceeds remaining credit of PKR ${existingCreditAmount.toFixed(2)}.`,
      });
    }

    const newAmountPaid = existingAmountPaid + currentPaymentAmount;
    const newCreditAmount = existingCreditAmount - currentPaymentAmount;
    console.log('Updating stock_purchase_invoices:', { newAmountPaid, newCreditAmount, payment_date, invoiceId });

    await connection.query(
      `UPDATE stock_purchase_invoices
       SET amount_paid = ?, credit_amount = ?, last_payment_date = ?
       WHERE id = ?`,
      [newAmountPaid, newCreditAmount, payment_date, parseInt(invoiceId)]
    );

    console.log('Inserting into credit_payments:', { invoiceId, payment_date, currentPaymentAmount });
    await connection.query(
      `INSERT INTO credit_payments (invoice_id, payment_date, amount_paid, invoice_type) VALUES (?, ?, ?, 'purchase')`,
      [parseInt(invoiceId), payment_date, currentPaymentAmount]
    );

    console.log('Committing pay-credit transaction...');
    await connection.commit();
    res.status(200).json({ message: 'Credit payment recorded successfully.', newCreditAmount });
  } catch (error) {
    console.error('Error paying credit:', {
      message: error.message,
      stack: error.stack,
      invoiceId,
      requestBody: JSON.stringify(req.body, null, 2),
    });
    if (connection) {
      console.log('Rolling back pay-credit transaction...');
      await connection.rollback();
      connection.release();
    }
    res.status(500).json({ error: `Failed to record payment: ${error.message}` });
  } finally {
    if (connection) {
      console.log('Releasing pay-credit database connection.');
      connection.release();
    }
  }
});

module.exports = router;