-- Stop your backend server before running these commands!

-- Drop existing tables in reverse order of dependencies
DROP TABLE IF EXISTS purchase_bill_payments;
DROP TABLE IF EXISTS purchase_bill_products;
DROP TABLE IF EXISTS purchase_bills;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS customers;

-- Create the FINAL, MINIMAL Customers table
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,    
    address TEXT NOT NULL,         
    phone VARCHAR(20) NOT NULL,    -- Maps to frontend 'contact'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- Vendors Table
CREATE TABLE vendors (
    vendor_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS products;
-- Products Table
CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id),
  name VARCHAR(255) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  default_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(50) NOT NULL DEFAULT 'Unit',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (vendor_id, name)
);

-- Purchase Bills Table
CREATE TABLE purchase_bills (
    bill_id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL,
    vendor_id INTEGER NOT NULL REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
    date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('Cash', 'Credit', 'Cash+Credit', 'Paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (invoice_no)
);

-- Purchase Bill Products Table ( Junction table for bill-product relationship)
CREATE TABLE purchase_bill_products (
    bill_product_id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES purchase_bills(bill_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    total_amount DECIMAL(10,2) GENERATED ALWAYS AS (quantity * price) STORED
);

-- Purchase Bill Payments Table
CREATE TABLE purchase_bill_payments (
    payment_id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES purchase_bills(bill_id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    source VARCHAR(50) NOT NULL CHECK (source IN ('Cash', 'Bank Transfer', 'Cheque')),
    date DATE NOT NULL,
    pr_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_bills (
  bill_id SERIAL PRIMARY KEY,
  bill_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
  date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_bill_products (
  bill_id INTEGER NOT NULL REFERENCES sale_bills(bill_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity INTEGER NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (bill_id, product_id)
);

CREATE TABLE IF NOT EXISTS sale_bill_payments (
  bill_id INTEGER NOT NULL REFERENCES sale_bills(bill_id),
  amount DECIMAL(10,2) NOT NULL,
  source VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  pr_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
