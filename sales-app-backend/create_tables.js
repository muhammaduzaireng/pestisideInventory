// sales-app-backend/create_tables.js

const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

// Read the SQL file
const sqlFilePath = path.join(__dirname, 'database.sql');
const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');

const createTables = async () => {
    try {
        console.log('Starting database table creation...');
        
        // Use a single client for transaction/multiple queries in one go
        const client = await pool.connect();
        
        // Execute the SQL script
        await client.query(sqlQuery);
        
        client.release(); // Release the client back to the pool
        console.log('✅ Customers table created successfully!');
        
    } catch (err) {
        console.error('❌ Error creating tables:', err.stack);
        process.exit(1); // Exit with failure code
    } finally {
        // Important: Close the connection pool after script finishes
        await pool.end();
    }
};

createTables();