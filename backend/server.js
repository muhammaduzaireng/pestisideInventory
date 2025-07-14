const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const connectWithRetry = require('./retryConnection');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: 'srv1650.hstgr.io',
  user: 'u672236642_Uzair',
  password: 'Choudhary@55',
  database: 'u672236642_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

// Test the connection with retry logic
connectWithRetry(pool)
  .then(() => {
    console.log('Initial MySQL connection successful');
  })
  .catch((err) => {
    console.error('Initial MySQL connection failed:', err.message);
  });

pool.getConnection()
  .then((connection) => {
    console.log('MySQL Pool Connected');
    connection.release();
  })
  .catch((err) => {
    console.error('Error connecting to MySQL Pool:', err);
  });

const parseNumericFields = (row) => {
  if (!row) return row;

  const numericFields = [
    'total_bill_amount',
    'amount_paid',
    'credit_amount',
    'purchase_price',
    'sell_price',
    'stock',
    'added_stock',
    'quantity',
    'unit_price',
    'subtotal',
  ];

  const parsedRow = { ...row };
  for (const field of numericFields) {
    if (Object.prototype.hasOwnProperty.call(parsedRow, field) && parsedRow[field] !== null) {
      if (field === 'added_stock' || field === 'quantity' || field === 'stock') {
        parsedRow[field] = parseInt(parsedRow[field], 10);
      } else {
        parsedRow[field] = parseFloat(parsedRow[field]);
      }
      if (isNaN(parsedRow[field])) {
        parsedRow[field] = 0;
      }
    }
  }
  return parsedRow;
};

const generateInvoiceNumber = () => {
  return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// --- Routes ---

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password') {
    res.json({ success: true, token: 'fake-token' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Sell (Legacy endpoint)
app.get('/api/sell', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM sales');
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get Product Details
app.get('/api/products/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const [results] = await pool.query('SELECT *, expiry_date_tracking FROM products WHERE id = ?', [productId]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(parseNumericFields(results[0]));
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add New Customer
app.post('/api/customers', async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const [results] = await pool.query(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone, email, address]
    );
    res.json({ id: results.insertId });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add Sale (Legacy endpoint)
app.post('/api/sell', async (req, res) => {
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
    connection.release();

    res.json({ success: true });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const [results] = await pool.query(
      'SELECT p.*, v.name AS vendorName FROM products p LEFT JOIN vendors v ON p.vendor_id = v.id'
    );
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add Product
app.post('/api/products', async (req, res) => {
  const { name, barcode, vendor_id } = req.body;

  if (!name || !barcode) {
    return res.status(400).json({ error: 'Name and barcode are required' });
  }

  try {
    const [results] = await pool.query(
      'INSERT INTO products (name, barcode, vendor_id, purchase_price, sell_price, expiry_date_tracking) VALUES (?, ?, ?, ?, ?, ?)',
      [name, barcode, vendor_id || null, null, null, false]
    );
    res.json({ id: results.insertId, name, barcode, vendor_id: vendor_id || null, purchase_price: null, sell_price: null, expiry_date_tracking: false });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Customers
app.get('/api/customers', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM customers');
    res.json(results);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Stock (Aggregated View)
app.get('/api/stock', async (req, res) => {
  try {
    const [results] = await pool.query(`
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
app.post('/api/stock-entries', async (req, res) => {
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

  try {
    const [productRes] = await pool.query('SELECT expiry_date_tracking FROM products WHERE id = ?', [product_id]);
    if (productRes.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const expiryDateTracking = productRes[0].expiry_date_tracking;

    if (expiryDateTracking && !expiry_date) {
      return res.status(400).json({ error: 'Expiry date is required for this product type.' });
    }
    const finalExpiryDate = expiryDateTracking ? expiry_date : null;

    const isCreditPayment = payment_method === 'credit' || payment_method === 'cash_and_credit';
    if (isCreditPayment && !credit_due_date) {
      return res.status(400).json({ error: 'Credit due date is required for credit/cash & credit payments.' });
    }
    const finalCreditDueDate = isCreditPayment ? credit_due_date : null;

    const isBankTransfer = payment_method === 'bank_transfer';
    if (isBankTransfer && (!transaction_id || !bank_name)) {
      return res.status(400).json({ error: 'Transaction ID and Bank Name are required for bank transfer.' });
    }
    const finalTransactionId = isBankTransfer ? transaction_id : null;
    const finalBankName = isBankTransfer ? bank_name : null;

    const finalVendorId = vendor_id ? parseInt(vendor_id) : null;

    const [results] = await pool.query(
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

    res.status(201).json({ id: results.insertId, message: 'Stock entry added successfully.' });
  } catch (err) {
    console.error('Error adding stock entry:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry detected.', details: err.message });
    }
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// DEPRECATED: Add stock to a product
app.post('/api/products/:id/add-stock', async (req, res) => {
  const { id } = req.params;
  const { added_stock, purchase_price, sell_price, purchase_date } = req.body;

  console.warn(`WARNING: The /api/products/${id}/add-stock endpoint is deprecated. Use /api/stock-entries instead.`);

  if (!added_stock || !purchase_price || !sell_price || !purchase_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    await pool.query(
      'UPDATE products SET stock = stock + ?, purchase_price = ?, sell_price = ?, last_purchase_date = ? WHERE id = ?',
      [added_stock, purchase_price, sell_price, purchase_date, id]
    );
    res.json({ success: true, message: 'Product stock and prices updated (deprecated route).' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update Product Prices
app.put('/api/products/:id/prices', async (req, res) => {
  const { id } = req.params;
  const { purchase_price, sell_price } = req.body;
  if (purchase_price === undefined && sell_price === undefined) {
    return res.status(400).json({ error: 'At least one price must be provided' });
  }
  try {
    let updateFields = [];
    let params = [];
    if (purchase_price !== undefined) {
      updateFields.push('purchase_price = ?');
      params.push(purchase_price);
    }
    if (sell_price !== undefined) {
      updateFields.push('sell_price = ?');
      params.push(sell_price);
    }
    params.push(id);
    await pool.query(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Default product prices updated.' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get Recent Stock Entry Prices for a Product
app.get('/api/stock-entries/recent/:productId', async (req, res) => {
  const { productId } = req.params;
  try {
    const [results] = await pool.query(
      `SELECT purchase_price, sell_price
       FROM stock_entries
       WHERE product_id = ?
       ORDER BY purchase_date DESC, created_at DESC
       LIMIT 1`,
      [productId]
    );
    if (results.length === 0) {
      // Fall back to products table if no stock entries exist
      const [productResults] = await pool.query(
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
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});
app.put('/api/stock-entries/:id', async (req, res) => {
  const { id } = req.params;
  const { purchase_price, sell_price, expiry_date } = req.body;
  try {
    const [results] = await pool.query(
      `UPDATE stock_entries
       SET purchase_price = ?, sell_price = ?, expiry_date = ?
       WHERE id = ?`,
      [parseFloat(purchase_price), parseFloat(sell_price), expiry_date || null, id]
    );
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Stock entry not found' });
    }
    res.json({ message: 'Stock entry updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});
// Generate PDF Bill
app.get('/api/generate-bill', async (req, res) => {
  const { customerName, products, totalPrice, paymentType, amountPaid, creditAmount, creditDueDate } = req.query;

  let parsedProducts;
  try {
    parsedProducts = JSON.parse(products);
  } catch (err) {
    console.error('Error parsing products:', err);
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
    doc.text(`- ${product.name}: ${product.quantity} x $${product.price} = $${product.quantity * product.price}`);
  });

  doc.moveDown();
  doc.text(`Total Price: $${totalPrice}`).moveDown();
  doc.text(`Payment Type: ${paymentType}`).moveDown();

  if (paymentType === 'cash_and_credit') {
    doc.text(`Amount Paid: $${amountPaid}`).moveDown();
    doc.text(`Credit Amount: $${creditAmount}`).moveDown();
    doc.text(`Credit Due Date: ${creditDueDate}`).moveDown();
  }

  doc.end();
});

// Get Sell Records
app.get('/api/sell-records', async (req, res) => {
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

    const [rows] = await connection.query(query, queryParams);
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
app.get('/api/sell-records/:id', async (req, res) => {
  const recordId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();

    const [invoiceResult] = await pool.query(
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

    const [itemsResult] = await pool.query(
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

// Get Credit Payments
app.get('/api/credit-payments/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;
  const { type = 'sale' } = req.query;

  let connection;
  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(
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

// Get Credit Records
app.get('/api/credit-records', async (req, res) => {
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

    const [results] = await pool.query(query, params);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add Credit Payment (Legacy for sales table)
app.post('/api/credit-payment', async (req, res) => {
  const { sale_id, amount_paid, next_due_date } = req.body;
  try {
    const [saleResult] = await pool.query('SELECT credit_amount FROM sales WHERE id = ?', [sale_id]);
    const sale = parseNumericFields(saleResult[0]);

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const updatedCreditAmount = sale.credit_amount - amount_paid;

    await pool.query(
      'UPDATE sales SET credit_amount = ?, credit_due_date = ? WHERE id = ?',
      [updatedCreditAmount, next_due_date || null, sale_id]
    );

    res.json({ success: true, updatedCreditAmount });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get Credit Payments
app.get('/api/credit-payments', async (req, res) => {
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
    const [results] = await pool.query(query, params);
    const parsedResults = results.map(parseNumericFields);
    res.json(parsedResults);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Vendors
app.get('/api/vendors', async (req, res) => {
  try {
    const [results] = await pool.query('SELECT * FROM vendors ORDER BY name');
    res.json(results);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }

  try {
    const [results] = await pool.query(
      'INSERT INTO vendors (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [name, contact_person, phone, email, address]
    );
    res.json({ id: results.insertId, name, contact_person, phone, email, address });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.put('/api/vendors/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, address } = req.body;

  try {
    await pool.query(
      'UPDATE vendors SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, contact_person, phone, email, address, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.delete('/api/vendors/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM vendors WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Stock Purchases
app.post('/api/stock-purchases', async (req, res) => {
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
      const [productCheck] = await connection.query('SELECT expiry_date_tracking FROM products WHERE id = ?', [
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

      await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.added_stock, item.product_id]);
    }

    await connection.commit();
    connection.release();

    res.status(201).json({ success: true, invoice_id: invoiceId, invoice_number });
  } catch (err) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error recording stock purchase:', err);
    res.status(500).json({ error: 'Failed to record stock purchase', details: err.message });
  }
});

// Get Stock Purchase Invoices
app.get('/api/stock-purchases', async (req, res) => {
  try {
    const [invoices] = await pool.query(`
      SELECT spi.*, v.name AS vendor_name
      FROM stock_purchase_invoices spi
      JOIN vendors v ON spi.vendor_id = v.id
      ORDER BY spi.purchase_date DESC, spi.created_at DESC;
    `);
    const parsedInvoices = invoices.map(parseNumericFields);
    res.json(parsedInvoices);
  } catch (err) {
    console.error('Error fetching stock purchase invoices:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Pay Credit for Stock Purchase
app.put('/api/stock-purchases/:id/pay-credit', async (req, res) => {
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
        error: `Payment amount exceeds remaining credit of $${existingCreditAmount.toFixed(2)}.`,
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
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Error paying credit:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Add Sale Invoice
app.post('/api/sale-invoices', async (req, res) => {
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
    if (connection) await connection.rollback();
    console.error('Error recording sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get All Sale Invoices
app.get('/api/sale-invoices', async (req, res) => {
  try {
    const [invoices] = await pool.query(`
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
app.get('/api/sale-invoices/:id', async (req, res) => {
  const invoiceId = req.params.id;
  try {
    const [invoiceResult] = await pool.query(
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

    const [itemsResult] = await pool.query(
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

// Pay Credit for Sale Invoice
app.post('/api/sell-records/pay-credit', async (req, res) => {
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
    if (connection) await connection.rollback();
    console.error('Error paying credit for sale invoice:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get Single Stock Purchase Invoice
app.get('/api/stock-purchases/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      connection = await pool.getConnection();
      const [invoiceRows] = await connection.query(
        `
        SELECT spi.*, v.name AS vendor_name
        FROM stock_purchase_invoices spi
        LEFT JOIN vendors v ON spi.vendor_id = v.id
        WHERE spi.id = ?
        `,
        [id]
      );

      if (invoiceRows.length === 0) {
        connection.release();
        return res.status(404).json({ error: `Stock purchase invoice with ID ${id} not found.` });
      }

      const [itemRows] = await connection.query(
        `
        SELECT se.*, p.name AS product_name, p.barcode
        FROM stock_entries se
        LEFT JOIN products p ON se.product_id = p.id
        WHERE se.stock_purchase_invoice_id = ?
        `,
        [id]
      );

      const parsedInvoice = parseNumericFields({
        ...invoiceRows[0],
        items: itemRows.map((item) => ({
          ...item,
          product_name: item.product_name || 'Unknown Product',
          barcode: item.barcode || 'N/A',
          purchase_price: parseFloat(item.purchase_price) || 0,
          sell_price: parseFloat(item.sell_price) || 0,
          added_stock: parseInt(item.added_stock) || 0,
          subtotal: parseFloat((item.added_stock * item.purchase_price).toFixed(2)) || 0,
        })),
      });

      connection.release();
      return res.status(200).json(parsedInvoice);
    } catch (err) {
      if (connection) connection.release();
      if (err.code === 'ECONNRESET' && retries < maxRetries - 1) {
        retries++;
        console.warn(`Retrying query due to ECONNRESET (attempt ${retries + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
        continue;
      }
      console.error('Error fetching single stock purchase invoice:', err);
      return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  }
});

// server.js (excerpt)
app.get('/api/sale-invoices/sales-trend', async (req, res) => {
  const numMonths = parseInt(req.query.months) || 6;
  try {
    const [rows] = await connection.execute(
      `SELECT
           DATE_FORMAT(sale_date, '%Y-%m') AS month_year,
           DATE_FORMAT(sale_date, '%b') AS month_name,
           SUM(total_price) AS total_sales
       FROM sale_invoices
       WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month_year, month_name
       ORDER BY month_year ASC`,
      [numMonths]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sales trend data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// server.js (excerpt)
app.get('/api/products/top-selling', async (req, res) => {
  const limit = parseInt(req.query.limit) || 5; // Default to top 5
  try {
    const [rows] = await connection.execute(
      `SELECT p.name, SUM(sii.quantity) AS sales_volume
       FROM products p
       JOIN sale_invoice_items sii ON p.id = sii.product_id
       GROUP BY p.id, p.name
       ORDER BY sales_volume DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top selling products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.get('/api/sale-invoices/monthly-total', async (req, res) => {
    const { year, month } = req.query;

    if (!year || !month) {
        return res.status(400).json({ error: 'Year and month are required query parameters.' });
    }

    try {
        // Ensure 'connection' is accessible here (e.g., globally defined or passed)
        const [rows] = await connection.execute(
            `SELECT SUM(total_bill_amount) AS totalSales FROM sale_invoices
             WHERE YEAR(sale_date) = ? AND MONTH(sale_date) = ?`,
            [year, month]
        );
        res.json({ totalSales: rows[0].totalSales || 0 });
    } catch (error) {
        console.error('Error fetching monthly sales total:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});