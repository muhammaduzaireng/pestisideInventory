const express = require('express');
const router = express.Router();
const { queryWithRetry } = require('../db');
const { parseNumericFields } = require('../utils');

// Sales Trend
router.get('/reports/sale-invoices/sales-trend', async (req, res) => {
  try {
    const rows = await queryWithRetry(
      `SELECT
           DATE_FORMAT(sale_date, '%Y-%m') AS month_year,
           DATE_FORMAT(sale_date, '%b') AS month_name,
           SUM(total_bill_amount) AS total_sales
       FROM sale_invoices
       WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month_year, month_name
       ORDER BY month_year ASC`
    );
    const parsedRows = rows.map(row => ({
      ...parseNumericFields(row),
      name: row.month_name,
      sales: parseFloat(row.total_sales) || 0
    }));
    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching sales trend data:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Top Selling Products
router.get('/reports/top-selling-products', async (req, res) => {
  try {
    const rows = await queryWithRetry(
      `SELECT p.name AS name, SUM(sii.quantity) AS sales_volume
       FROM products p
       JOIN sale_invoice_items sii ON p.id = sii.product_id
       GROUP BY p.id, p.name
       ORDER BY sales_volume DESC
       LIMIT 10`
    );
    const parsedRows = rows.map(row => ({
      ...parseNumericFields(row),
      name: row.name || 'Unknown Product',
      value: parseFloat(row.sales_volume) || 0
    }));
    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching top selling products:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Monthly Sales Total
// Modified endpoint that works with or without parameters
router.get('/reports/monthly-total', async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const month = req.query.month || new Date().getMonth() + 1; // Months are 0-indexed in JS
  
  try {
    const rows = await queryWithRetry(
      `SELECT 
         SUM(total_bill_amount) AS totalSales
       FROM sale_invoices
       WHERE YEAR(sale_date) = ?
         AND MONTH(sale_date) = ?`,
      [year, month]
    );
    
    res.json({ 
      totalSales: parseFloat(rows[0].totalSales) || 0,
      month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
      year: year
    });
  } catch (err) {
    console.error('Error fetching monthly sales:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Total Products
router.get('/reports/products/count', async (req, res) => {
  try {
    const rows = await queryWithRetry('SELECT COUNT(*) AS total FROM products');
    res.json({ totalProducts: parseInt(rows[0].total) || 0 });
  } catch (err) {
    console.error('Error fetching product count:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Total Customers
router.get('/customers/count', async (req, res) => {
  try {
    const rows = await queryWithRetry('SELECT COUNT(*) AS total FROM customers');
    res.json({ totalCustomers: parseInt(rows[0].total) || 0 });
  } catch (err) {
    console.error('Error fetching customer count:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Active Vendors
router.get('/vendors/count', async (req, res) => {
  try {
    const rows = await queryWithRetry('SELECT COUNT(*) AS total FROM vendors');
    res.json({ totalVendors: parseInt(rows[0].total) || 0 });
  } catch (err) {
    console.error('Error fetching vendor count:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/reports/sale-invoices/monthly-total', async (req, res) => {
  const { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ error: 'Year and month are required query parameters.' });
  }

  try {
    const rows = await queryWithRetry(
      `SELECT SUM(total_bill_amount) AS totalSales
       FROM sale_invoices
       WHERE YEAR(sale_date) = ? AND MONTH(sale_date) = ?`,
      [year, month]
    );
    res.json({ totalSales: parseFloat(rows[0].totalSales) || 0 });
  } catch (err) {
    console.error('Error fetching monthly sales total:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;