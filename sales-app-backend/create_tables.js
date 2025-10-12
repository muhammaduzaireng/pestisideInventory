// sales-app-backend/create_tables.js - MySQL Version
const db = require('./db');

const createTables = async () => {
  try {
    console.log('Starting MySQL database table creation...');

    // MySQL version of your schema
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
          customer_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,    
          address TEXT NOT NULL,         
          phone VARCHAR(20) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Vendors Table
      CREATE TABLE vendors (
          vendor_id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          phone VARCHAR(20) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Products Table
      CREATE TABLE products (
        product_id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        default_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        unit VARCHAR(50) NOT NULL DEFAULT 'Unit',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
        UNIQUE KEY unique_vendor_product (vendor_id, name)
      );

      -- Purchase Bills Table
      CREATE TABLE purchase_bills (
          bill_id INT PRIMARY KEY AUTO_INCREMENT,
          invoice_no VARCHAR(255) NOT NULL UNIQUE,
          vendor_id INT NOT NULL,
          date DATE NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          balance DECIMAL(10,2) AS (total_amount - paid_amount),
          payment_type ENUM('Cash', 'Credit', 'Cash+Credit', 'Paid') NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT
      );

      -- Purchase Bill Products Table
      CREATE TABLE purchase_bill_products (
          bill_product_id INT PRIMARY KEY AUTO_INCREMENT,
          bill_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
          total_amount DECIMAL(10,2) AS (quantity * price),
          FOREIGN KEY (bill_id) REFERENCES purchase_bills(bill_id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
      );

      -- Purchase Bill Payments Table
      CREATE TABLE purchase_bill_payments (
          payment_id INT PRIMARY KEY AUTO_INCREMENT,
          bill_id INT NOT NULL,
          amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
          source ENUM('Cash', 'Bank Transfer', 'Cheque') NOT NULL,
          date DATE NOT NULL,
          pr_number VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bill_id) REFERENCES purchase_bills(bill_id) ON DELETE CASCADE
      );

      -- Sale Bills Table
      CREATE TABLE sale_bills (
        bill_id INT PRIMARY KEY AUTO_INCREMENT,
        bill_number VARCHAR(255) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        date DATE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        payment_type VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      );

      -- Sale Bill Products Table
      CREATE TABLE sale_bill_products (
        id INT PRIMARY KEY AUTO_INCREMENT,
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
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        bill_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        source VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        pr_number VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES sale_bills(bill_id) ON DELETE CASCADE
      );
    `;

    // Split and execute each statement
    const statements = sqlStatements.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.run(statement);
        console.log('Executed:', statement.substring(0, 50) + '...');
      }
    }
    
    console.log('✅ All MySQL tables created successfully!');
    
  } catch (err) {
    console.error('❌ Error creating MySQL tables:', err.message);
  } finally {
    process.exit();
  }
};

createTables();