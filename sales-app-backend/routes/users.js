const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); 

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret_key_123';

// ==========================================
// 1. REGISTER NEW USER
// POST /api/users/register
// ==========================================
router.post('/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  try {
    // Check if user already exists
    const result = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    // Normalize output whether db returns [rows] or directly rows
    const existing = Array.isArray(result[0]) ? result[0] : result;

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Username or Email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into DB
    const userRole = role || 'staff';
    const insertResult = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, userRole]
    );

    const insertData = Array.isArray(insertResult[0]) ? insertResult[0] : insertResult;

    res.status(201).json({
      message: 'User registered successfully',
      userId: insertData.insertId,
      user: { username, email, role: userRole }
    });
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 2. LOGIN USER
// POST /api/users/login
// ==========================================
router.post('/login', async (req, res) => {
  const { username, password } = req.body; // accepts username or email

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, username]
    );

    // Normalize output whether db returns [rows] or directly rows
    const rows = Array.isArray(result[0]) ? result[0] : result;

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 3. GET ALL USERS (Admin / Debug)
// GET /api/users
// ==========================================
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email, role, created_at FROM users');
    const users = Array.isArray(result[0]) ? result[0] : result;
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;