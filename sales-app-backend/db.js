// sales-app-backend/db.js

const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test the connection when the application starts
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client from pool. Check .env credentials.', err.stack);
  }
  console.log('Successfully connected to PostgreSQL database!');
  release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export the pool itself, which create_tables.js needs
};