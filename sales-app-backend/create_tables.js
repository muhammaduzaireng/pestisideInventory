// sales-app-backend/create_tables.js - UPDATED FOR MYSQL
const { pool } = require('./db');

const createTables = async () => {
  let connection;
  try {
    console.log('Starting database table creation...');
    
    connection = await pool.getConnection();
    
    // MySQL version of your SQL schema
    const sqlStatements = `
      -- Drop existing tables in reverse order of dependencies
      DROP TABLE IF EXISTS sale_bill_payments;
      DROP TABLE IF EXISTS sale_bill_products;
      DROP TABLE IF EXISTS sale_bills;
      DROP TABLE IF EXISTS purchase_bill_payments;
      DROP TABLE IF EXISTS purchase_bill_products;
      DROP TABLE IF EXISTS purchase_bills;
      DROP TABLE IF EXISTS products;
      DROP TABLE IF EXISTS vendors;
      DROP TABLE IF EXISTS customers;

      -- Create the FINAL, MINIMAL Customers table
      CREATE TABLE customers (
          customer_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,    
          address TEXT NOT NULL,         
          phone VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Vendors Table
      CREATE TABLE vendors (
          vendor_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          phone VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Products Table
      CREATE TABLE products (
        product_id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        default_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        unit VARCHAR(50) NOT NULL DEFAULT 'Unit',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
        UNIQUE KEY unique_vendor_product (vendor_id, name)
      );

      -- Purchase Bills Table
      CREATE TABLE purchase_bills (
          bill_id INT AUTO_INCREMENT PRIMARY KEY,
          invoice_no VARCHAR(50) NOT NULL UNIQUE,
          vendor_id INT NOT NULL,
          date DATE NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          balance DECIMAL(10,2) AS (total_amount - paid_amount) STORED,
          payment_type VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
          CHECK (payment_type IN ('Cash', 'Credit', 'Cash+Credit', 'Paid'))
      );

      -- Purchase Bill Products Table
      CREATE TABLE purchase_bill_products (
          bill_product_id INT AUTO_INCREMENT PRIMARY KEY,
          bill_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          total_amount DECIMAL(10,2) AS (quantity * price) STORED,
          FOREIGN KEY (bill_id) REFERENCES purchase_bills(bill_id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
          CHECK (quantity > 0),
          CHECK (price >= 0)
      );

      -- Purchase Bill Payments Table
      CREATE TABLE purchase_bill_payments (
          payment_id INT AUTO_INCREMENT PRIMARY KEY,
          bill_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          source VARCHAR(50) NOT NULL,
          date DATE NOT NULL,
          pr_number VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bill_id) REFERENCES purchase_bills(bill_id) ON DELETE CASCADE,
          CHECK (amount > 0),
          CHECK (source IN ('Cash', 'Bank Transfer', 'Cheque'))
      );

      -- Sale Bills Table
      CREATE TABLE sale_bills (
        bill_id INT AUTO_INCREMENT PRIMARY KEY,
        bill_number VARCHAR(50) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        payment_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      );

      -- Sale Bill Products Table
      CREATE TABLE sale_bill_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        sale_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES sale_bills(bill_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
        UNIQUE KEY unique_bill_product (bill_id, product_id)
      );

      -- Sale Bill Payments Table
      CREATE TABLE sale_bill_payments (
        payment_id INT AUTO_INCREMENT PRIMARY KEY,
        bill_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        source VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        pr_number VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES sale_bills(bill_id) ON DELETE CASCADE
      );
    `;

    // Split and execute each statement separately for better error handling
    const statements = sqlStatements.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement + ';');
      }
    }
    
    console.log('✅ All tables created successfully!');
    
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
  } finally {
    if (connection) {
      connection.release();
    }
    // Don't close the pool here as it's used by the application
  }
};

createTables();