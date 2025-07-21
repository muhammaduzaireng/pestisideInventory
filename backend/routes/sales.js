const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields, generateInvoiceNumber } = require('../utils');
const PDFDocument = require('pdfkit');

// DEPRECATED: Sell (Legacy endpoint)
router.get('/sell', async (req, res) => {
  console.warn('WARNING: /api/sell is deprecated. Use /api/sale-invoices instead.');
  try {
    const results = await queryWithRetry('SELECT * FROM sales', []);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error in /api/sell:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// DEPRECATED: Add Sale (Legacy endpoint)
router.post('/sell', async (req, res) => {
  console.warn('WARNING: /api/sell POST is deprecated. Use /api/sale-invoices instead.');
  const { customer_id, products, total_price, payment_type, amount_paid, credit_due_date } = req.body;

  if (!products || products.length === 0) {
    return res.status(400).json({ error: 'Products are required' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    let credit_amount = payment_type === 'cash_and_credit' ? total_price - amount_paid : 0;
    const salePromises = products.map(async (product) => {
      const { id: product_id, quantity } = product;

      const [productResult] = await connection.query('SELECT stock FROM products WHERE id = ?', [product_id]);
      const productData = productResult[0];

      if (!productData) {
        throw new Error(`Product with ID ${product_id} not found`);
      }

      const availableStock = productData.stock;

      if (availableStock < quantity) {
        throw new Error(`Insufficient stock for product with ID ${product_id}`);
      }

      await connection.query(
        'INSERT INTO sales (customer_id, product_id, quantity, total_price, payment_type, amount_paid, credit_amount, credit_due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [customer_id, product_id, quantity, total_price, payment_type, amount_paid, credit_amount, credit_due_date]
      );

      await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, product_id]);
    });

    await Promise.all(salePromises);
    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Database error in /api/sell POST:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Add Sale Invoice
router.post('/sale-invoices', async (req, res) => {
  const {
    customer_id,
    products,
    total_price,
    payment_type,
    amount_paid,
    credit_amount,
    credit_due_date,
    transaction_id,
    bank_name,
  } = req.body;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    for (const item of products) {
      const [product] = await connection.query(`SELECT id, stock, sell_price, name FROM products WHERE id = ?`, [
        item.id,
      ]);

      if (product.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Product with ID ${item.id} not found.` });
      }
      const currentProduct = parseNumericFields(product[0]);

      if (currentProduct.stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({
          error: `Not enough stock for ${currentProduct.name}. Available: ${currentProduct.stock}, Requested: ${item.quantity}`,
        });
      }

      await connection.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.id]);
    }

    let actualCustomerId = null;
    if (customer_id) {
      const [customerCheck] = await connection.query(`SELECT id FROM customers WHERE id = ?`, [customer_id]);
      if (customerCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: `Customer with ID ${customer_id} does not exist.` });
      }
      actualCustomerId = customer_id;
    }

    const invoiceNumber = generateInvoiceNumber();
    const [invoiceResult] = await connection.query(
      `INSERT INTO sale_invoices (invoice_number, customer_id, sale_date, total_bill_amount, payment_type, amount_paid, credit_amount, credit_due_date, transaction_id, bank_name)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        actualCustomerId,
        total_price,
        payment_type,
        amount_paid,
        credit_amount,
        credit_due_date ? new Date(credit_due_date).toISOString().split('T')[0] : null,
        transaction_id || null,
        bank_name || null,
      ]
    );
    const saleInvoiceId = invoiceResult.insertId;

    for (const item of products) {
      const [productDetails] = await connection.query(`SELECT sell_price FROM products WHERE id = ?`, [item.id]);
      const unitPrice = parseFloat(productDetails[0].sell_price);
      const subtotal = unitPrice * item.quantity;

      await connection.query(
        `INSERT INTO sale_invoice_items (sale_invoice_id, product_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [saleInvoiceId, item.id, item.quantity, unitPrice, subtotal]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Sale invoice recorded successfully', invoiceId: saleInvoiceId, invoiceNumber });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback error in /api/sale-invoices:', rollbackErr);
      }
      connection.release();
    }
    console.error('Error recording sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get All Sale Invoices
router.get('/sale-invoices', async (req, res) => {
  try {
    const invoices = await queryWithRetry(`
      SELECT
          si.*,
          c.name AS customer_name,
          c.phone AS customer_phone
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      ORDER BY si.sale_date DESC;
    `);
    const parsedInvoices = invoices.map(parseNumericFields);
    res.json(parsedInvoices);
  } catch (err) {
    console.error('Error fetching sale invoices:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get Single Sale Invoice
router.get('/sale-invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;
  try {
    const [invoiceResult] = await queryWithRetry(
      `
      SELECT
          si.*,
          c.name AS customer_name,
          c.phone AS customer_phone
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ?;
      `,
      [invoiceId]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({ error: 'Sale invoice not found.' });
    }

    const [itemsResult] = await queryWithRetry(
      `
      SELECT
          sii.id,
          sii.quantity,
          sii.unit_price,
          sii.subtotal,
          p.name AS product_name,
          p.barcode
      FROM sale_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.sale_invoice_id = ?;
      `,
      [invoiceId]
    );

    let invoice = parseNumericFields(invoiceResult[0]);
    invoice.items = itemsResult.map(parseNumericFields);

    res.json(invoice);
  } catch (err) {
    console.error('Error fetching single sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get Sell Records
router.get('/sell-records', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();

    const { start_date, end_date, search } = req.query;

    let query = `
      SELECT
          si.id AS record_id,
          si.invoice_number,
          c.name AS customer_name,
          si.sale_date AS record_date,
          si.total_bill_amount,
          si.payment_type,
          si.amount_paid,
          si.credit_amount,
          si.credit_due_date,
          si.transaction_id,
          si.bank_name
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE 1=1
    `;

    const queryParams = [];

    if (start_date) {
      query += ` AND si.sale_date >= ?`;
      queryParams.push(start_date + ' 00:00:00');
    }
    if (end_date) {
      query += ` AND si.sale_date <= ?`;
      queryParams.push(end_date + ' 23:59:59');
    }

    if (search) {
      const searchTerm = `%${search}%`;
      query += ` AND (
          si.invoice_number LIKE ? OR
          c.name LIKE ? OR
          si.payment_type LIKE ? OR
          si.total_bill_amount LIKE ? OR
          si.amount_paid LIKE ? OR
          si.credit_amount LIKE ?
      )`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY si.sale_date DESC`;

    const rows = await queryWithRetry(query, queryParams);
    const parsedRows = rows.map(parseNumericFields);
    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching sell records:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get Single Sell Record
router.get('/sell-records/:id', async (req, res) => {
  const recordId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();

    const [invoiceResult] = await connection.query(
      `
      SELECT
          si.id AS record_id,
          si.invoice_number,
          c.name AS customer_name,
          si.sale_date AS record_date,
          si.total_bill_amount,
          si.payment_type,
          si.amount_paid,
          si.credit_amount,
          si.credit_due_date,
          si.transaction_id,
          si.bank_name
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ?;
      `,
      [recordId]
    );

    if (invoiceResult.length === 0) {
      return res.status(404).json({ error: `Sell record with ID ${recordId} not found.` });
    }

    const [itemsResult] = await connection.query(
      `
      SELECT
          sii.id,
          sii.quantity,
          sii.unit_price,
          sii.subtotal,
          p.name AS product_name,
          p.barcode
      FROM sale_invoice_items sii
      JOIN products p ON sii.product_id = p.id
      WHERE sii.sale_invoice_id = ?;
      `,
      [recordId]
    );

    let invoice = parseNumericFields(invoiceResult[0]);
    invoice.items = itemsResult.map(parseNumericFields);

    res.json(invoice);
  } catch (err) {
    console.error('Error fetching single sell record:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Generate PDF Bill
router.get('/generate-bill', async (req, res) => {
  const { customerName, products, totalPrice, paymentType, amountPaid, creditAmount, creditDueDate } = req.query;

  let parsedProducts;
  try {
    parsedProducts = JSON.parse(products);
  } catch (err) {
    console.error('Error parsing products in /api/generate-bill:', err);
    return res.status(400).json({ error: 'Invalid products data' });
  }

  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="bill.pdf"');

  doc.pipe(res);

  doc.fontSize(20).text('Invoice', { align: 'center' }).moveDown();
  doc.fontSize(14).text(`Customer Name: ${customerName}`).moveDown();
  doc.text('Products:').moveDown();

  parsedProducts.forEach((product) => {
    doc.text(`- ${product.name}: ${product.quantity} x $${parseFloat(product.price).toFixed(2)} = $${(product.quantity * parseFloat(product.price)).toFixed(2)}`);
  });

  doc.moveDown();
  doc.text(`Total Price: $${parseFloat(totalPrice).toFixed(2)}`).moveDown();
  doc.text(`Payment Type: ${paymentType}`).moveDown();

  if (paymentType === 'cash_and_credit') {
    doc.text(`Amount Paid: $${parseFloat(amountPaid).toFixed(2)}`).moveDown();
    doc.text(`Credit Amount: $${parseFloat(creditAmount).toFixed(2)}`).moveDown();
    doc.text(`Credit Due Date: ${creditDueDate || 'N/A'}`).moveDown();
  }

  doc.end();
});

module.exports = router;