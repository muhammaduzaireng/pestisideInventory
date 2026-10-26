const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// Import your database connection pool (adjust path if needed)
const db = require('../config/db'); 

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
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or Email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into DB
    const userRole = role || 'staff';
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, userRole]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId,
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
  const { username, password } = req.body; // 'username' field can accept username or email

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    // Find user by username or email
    const [rows] = await db.query(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Check password match
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
// 3. GET ALL USERS (Optional - Admin view)
// GET /api/users
// ==========================================
router.get('/', async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, username, email, role, created_at FROM users'
    );
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;