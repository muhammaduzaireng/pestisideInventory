// sales-app-backend/db.js - MySQL Version
const mysql = require('mysql2');
const path = require('path');

// Load .env file from sales-app-backend directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00'
});

// Create promise wrapper for async/await
const promisePool = pool.promise();

// Test connection and verify database is selected
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error connecting to MySQL database:', err.message);
    console.error('   DB_HOST:', process.env.DB_HOST);
    console.error('   DB_USER:', process.env.DB_USER);
    console.error('   DB_DATABASE:', process.env.DB_DATABASE || 'NOT SET!');
    return;
  }
  console.log('✅ Connected to MySQL database');
  console.log('   Database:', process.env.DB_DATABASE || 'NOT SET!');
  connection.release();
});

// Database methods
const db = {
  // For SELECT queries
  query: (sql, params = []) => {
    return promisePool.execute(sql, params)
      .then(([rows]) => rows)
      .catch(err => {
        console.error('Query Error:', err);
        throw err;
      });
  },

  // For INSERT, UPDATE, DELETE
  run: (sql, params = []) => {
    return promisePool.execute(sql, params)
      .then(([result]) => ({
        id: result.insertId,
        changes: result.affectedRows
      }))
      .catch(err => {
        console.error('Run Error:', err);
        throw err;
      });
  },

  // For single row SELECT
  get: (sql, params = []) => {
    return promisePool.execute(sql, params)
      .then(([rows]) => rows[0] || null)
      .catch(err => {
        console.error('Get Error:', err);
        throw err;
      });
  },

  // For transactions
  beginTransaction: () => promisePool.getConnection().then(conn => {
    return conn.beginTransaction().then(() => conn);
  }),

  commit: (conn) => conn.commit().then(() => conn.release()),
  
  rollback: (conn) => conn.rollback().then(() => conn.release())
};

module.exports = db;