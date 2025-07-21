const mysql = require('mysql2/promise');

const maxRetries = 5; // Maximum number of retry attempts
const initialDelay = 1000; // Initial delay in milliseconds

async function connectWithRetry(pool, retries = maxRetries, delay = initialDelay) {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL Connected');
    connection.release();
    return connection;
  } catch (err) {
    console.error(`Error connecting to MySQL: ${err.message}. Retrying in ${delay}ms...`);
    if (retries > 0) {
      await new Promise(res => setTimeout(res, delay));
      return connectWithRetry(pool, retries - 1, delay * 2); // Exponential backoff
    } else {
      throw new Error(`Failed to connect to MySQL after ${maxRetries} attempts`);
    }
  }
}

module.exports = connectWithRetry;