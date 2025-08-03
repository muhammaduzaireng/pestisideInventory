const express = require('express');
const router = express.Router();
const { pool, queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');
const PDFDocument = require('pdfkit');

router.post('/sale-invoices', async (req, res) => {
  const { invoice_number, customer_id, products, total_price, payment_type, amount_paid, credit_amount } = req.body;

  let connection;
  try {
    console.log('POST /api/sale-invoices received with body:', JSON.stringify(req.body, null, 2));
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validate inputs
    if (!invoice_number) {
      throw new Error('Invoice number is required.');
    }
    if (!products || !Array.isArray(products) || products.length === 0) {
      throw new Error('Products array is required and cannot be empty.');
    }
    if (total_price <= 0) {
      throw new Error('Total bill amount must be greater than 0.');
    }

    const saleInvoiceItems = [];

    // Check stock for each product and prepare line items
    for (const item of products) {
      // We only need product ID, stock, and name for validation. We no longer need to query sell_price.
      const [product] = await connection.query(`SELECT id, stock, name FROM products WHERE id = ?`, [item.id]);
      if (product.length === 0) {
        throw new Error(`Product with ID ${item.id} not found.`);
      }

      const currentProduct = parseNumericFields(product[0]);
      if (currentProduct.stock < item.quantity) {
        throw new Error(`Not enough stock for ${currentProduct.name}. Available: ${currentProduct.stock}, Requested: ${item.quantity}`);
      }

      // Record the item details without sell_price
      saleInvoiceItems.push({
        id: item.id,
        quantity: item.quantity,
      });

      // Update product stock
      await connection.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.id]);
    }

    let actualCustomerId = null;
    if (customer_id) {
      const [customerCheck] = await connection.query(`SELECT id FROM customers WHERE id = ?`, [customer_id]);
      if (customerCheck.length === 0) {
        throw new Error(`Customer with ID ${customer_id} does not exist.`);
      }
      actualCustomerId = customer_id;
    }

    // Use the provided invoice number and total price
    const [invoiceResult] = await connection.query(
      `INSERT INTO sale_invoices (invoice_number, customer_id, sale_date, total_bill_amount, payment_type, amount_paid, credit_amount)
       VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
      [invoice_number, actualCustomerId, total_price, payment_type, amount_paid, credit_amount]
    );
    const saleInvoiceId = invoiceResult.insertId;
    console.log('Inserted sale invoice, ID:', saleInvoiceId);

    // Insert each line item into the sale_invoice_items table without unit_price and subtotal
    for (const item of saleInvoiceItems) {
      await connection.query(
        `INSERT INTO sale_invoice_items (sale_invoice_id, product_id, quantity)
         VALUES (?, ?, ?)`,
        [saleInvoiceId, item.id, item.quantity]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Sale invoice recorded successfully', invoiceId: saleInvoiceId, invoiceNumber: invoice_number });
  } catch (err) {
    if (connection) {
      console.log('Rolling back transaction...');
      await connection.rollback();
      connection.release();
    }
    console.error('Error recording sale invoice:', err);
    res.status(err.message.includes('not found') ? 404 : 400).json({ error: err.message });
  } finally {
    if (connection) {
      console.log('Releasing database connection.');
      connection.release();
    }
  }
});

// The remaining routes are unchanged.
router.get('/sale-invoices', async (req, res) => {
  try {
    console.log('GET /api/sale-invoices received');
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
    console.log('Fetched invoices:', JSON.stringify(parsedInvoices, null, 2));
    res.json(parsedInvoices);
  } catch (err) {
    console.error('Error fetching sale invoices:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/sale-invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;
  try {
    console.log('GET /api/sale-invoices/:id received with id:', invoiceId);
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
      console.error('Invoice not found for id:', invoiceId);
      return res.status(404).json({ error: 'Sale invoice not found.' });
    }

    const [itemsResult] = await queryWithRetry(
      `
      SELECT
          sii.id,
          sii.quantity,
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
    console.log('Fetched invoice with items:', JSON.stringify(invoice, null, 2));

    res.json(invoice);
  } catch (err) {
    console.error('Error fetching single sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/sell-records', async (req, res) => {
  let connection;
  try {
    console.log('GET /api/sell-records received with query:', JSON.stringify(req.query, null, 2));
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
          si.credit_amount
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
          si.payment_type LIKE ?
      )`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY si.sale_date DESC`;

    const rows = await queryWithRetry(query, queryParams);
    const parsedRows = rows.map(parseNumericFields);
    console.log('Fetched sell records:', JSON.stringify(parsedRows, null, 2));
    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching sell records:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/sell-records/:id', async (req, res) => {
  const recordId = req.params.id;
  let connection;
  try {
    console.log('GET /api/sell-records/:id received with id:', recordId);
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
          si.credit_amount
      FROM sale_invoices si
      LEFT JOIN customers c ON si.customer_id = c.id
      WHERE si.id = ?;
      `,
      [recordId]
    );

    if (invoiceResult.length === 0) {
      console.error('Sell record not found for id:', recordId);
      return res.status(404).json({ error: `Sell record with ID ${recordId} not found.` });
    }

    const [itemsResult] = await connection.query(
      `
      SELECT
          sii.id,
          sii.quantity,
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
    console.log('Fetched sell record with items:', JSON.stringify(invoice, null, 2));

    res.json(invoice);
  } catch (err) {
    console.error('Error fetching single sell record:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/generate-bill', async (req, res) => {
  const { customerName, products, totalPrice, paymentType, amountPaid, creditAmount } = req.query;

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

  doc.fontSize(20).text('Sale Invoice', { align: 'center' }).moveDown();
  doc.fontSize(12).text(`Customer Name: ${customerName}`).moveDown();
  doc.text(`Date: ${new Date().toLocaleDateString('en-CA')}`).moveDown();
  doc.text('Products:').moveDown();

  // Since we don't have individual prices, we'll list the products and quantity
  parsedProducts.forEach((product) => {
    doc.text(`- ${product.name}: ${product.quantity}`);
  });

  doc.moveDown();
  doc.text(`Total Price: PKR${parseFloat(totalPrice).toFixed(2)}`).moveDown();
  doc.text(`Payment Type: ${paymentType.replace(/_/g, ' ').toUpperCase()}`).moveDown();
  doc.text(`Amount Paid: PKR${parseFloat(amountPaid).toFixed(2)}`).moveDown();
  doc.text(`Credit Amount: PKR${parseFloat(creditAmount).toFixed(2)}`).moveDown();

  doc.end();
});

module.exports = router;
