const express = require('express');
const router = express.Router();
const { queryWithRetry } = require('../db');

// Get all vendors
router.get('/', async (req, res) => {
  try {
    const results = await queryWithRetry('SELECT * FROM vendors ORDER BY name');
    res.json(results);
  } catch (err) {
    console.error('Database error in /api/vendors:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Add vendor
router.post('/', async (req, res) => {
  const { name, contact_person, phone, email, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Vendor name is required' });
  }

  try {
    const results = await queryWithRetry(
      'INSERT INTO vendors (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [name, contact_person, phone, email, address]
    );
    res.json({ id: results.insertId, name, contact_person, phone, email, address });
  } catch (err) {
    console.error('Database error in /api/vendors POST:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Update vendor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, address } = req.body;

  try {
    await queryWithRetry(
      'UPDATE vendors SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, contact_person, phone, email, address, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Database error in /api/vendors/:id:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Delete vendor
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await queryWithRetry('DELETE FROM vendors WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Database error in /api/vendors/:id DELETE:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

module.exports = router;