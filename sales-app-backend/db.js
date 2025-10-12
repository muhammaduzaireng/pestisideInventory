// sales-app-backend/db.js - UPDATED FOR MYSQL
const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the connection when the application starts
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database!');
    connection.release();
  } catch (err) {
    console.error('❌ Error connecting to MySQL database. Check .env credentials.', err.message);
  }
}

testConnection();

module.exports = {
  query: (text, params) => pool.execute(text, params),
  pool
};