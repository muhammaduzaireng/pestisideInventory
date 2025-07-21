const express = require('express');
const router = express.Router();
const { queryWithRetry } = require('../db');

// Get all customers
router.get('/', async (req, res) => {
  try {
    const results = await queryWithRetry('SELECT * FROM customers');
    res.json(results);
  } catch (err) {
    console.error('Database error in /api/customers:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add new customer
router.post('/', async (req, res) => {
  const { name, phone, email, address } = req.body;
  try {
    const results = await queryWithRetry(
      'INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)',
      [name, phone, email, address]
    );
    res.json({ id: results.insertId });
  } catch (err) {
    console.error('Database error in /api/customers:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;