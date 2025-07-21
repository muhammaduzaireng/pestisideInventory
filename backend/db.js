const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'srv1650.hstgr.io',
  user: 'u672236642_Uzair',
  password: 'Choudhary@55',
  database: 'u672236642_inventory',
  waitForConnections: true,
  connectionLimit: 30, // Increased to handle load
  queueLimit: 0,
  connectTimeout: 30000, // 30 seconds
  acquireTimeout: 30000,
  wait_timeout: 28800,
});

// Test initial connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Initial MySQL connection successful');
    connection.release();
  } catch (err) {
    console.error('Initial MySQL connection failed:', err.message);
  }
}
testConnection();

// Retry logic for database queries
async function queryWithRetry(query, params, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [result] = await pool.query(query, params);
      return result;
    } catch (err) {
      if (err.code === 'ECONNRESET' && attempt < retries) {
        console.warn(`Retrying query (attempt ${attempt + 1}/${retries}) after ECONNRESET:`, err.message);
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { pool, queryWithRetry };