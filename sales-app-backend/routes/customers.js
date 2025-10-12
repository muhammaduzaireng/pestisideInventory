// sales-app-backend/routes/customers.js (MINIMAL ROUTES)
const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------
// GET /api/customers - Fetch all customers
// ----------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const customers = await db.query(`
            SELECT 
                customer_id, 
                name, 
                phone, 
                address, 
                created_at
            FROM customers 
            ORDER BY customer_id ASC`);
            
        res.status(200).json(customers);
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// ----------------------------------------------------
// POST /api/customers - Create a new customer (name, contact, address)
// ----------------------------------------------------
router.post('/', async (req, res) => {
    // Frontend sends: name, contact, address
    const { name, contact, address } = req.body;
    
    // 1. Validation 
    if (!name || !contact || !address) {
        return res.status(400).json({ 
            error: 'Name, contact (phone), and address are required fields.' 
        });
    }
    
    try {
        const result = await db.run(`
            INSERT INTO customers (name, phone, address) 
            VALUES (?, ?, ?)`,
            [name, contact, address]
        );
        
        // Fetch the newly created customer
        const newCustomer = await db.get(`
            SELECT * FROM customers WHERE customer_id = ?`,
            [result.id]
        );
        
        res.status(201).json(newCustomer);
    } catch (err) {
        console.error('Error creating customer:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// ----------------------------------------------------
// GET /api/customers/:id - Get a single customer
// ----------------------------------------------------
router.get('/:id', async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await db.get(`
            SELECT 
                customer_id, 
                name, 
                phone, 
                address, 
                created_at
            FROM customers 
            WHERE customer_id = ?`,
            [customerId]
        );

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.status(200).json(customer);
    } catch (err) {
        console.error('Error fetching customer:', err);
        res.status(500).json({ error: 'Failed to fetch customer' });
    }
});

// ----------------------------------------------------
// PUT /api/customers/:id - Update a customer
// ----------------------------------------------------
router.put('/:id', async (req, res) => {
    const customerId = req.params.id;
    const { name, contact, address } = req.body;
    
    // Validation 
    if (!name || !contact || !address) {
        return res.status(400).json({ 
            error: 'Name, contact (phone), and address are required fields.' 
        });
    }
    
    try {
        const result = await db.run(`
            UPDATE customers 
            SET name = ?, phone = ?, address = ? 
            WHERE customer_id = ?`,
            [name, contact, address, customerId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Fetch the updated customer
        const updatedCustomer = await db.get(`
            SELECT * FROM customers WHERE customer_id = ?`,
            [customerId]
        );
        
        res.status(200).json(updatedCustomer);
    } catch (err) {
        console.error('Error updating customer:', err);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

// ----------------------------------------------------
// DELETE /api/customers/:id - Delete a customer
// ----------------------------------------------------
router.delete('/:id', async (req, res) => {
    const customerId = req.params.id;
    
    try {
        // Check if customer has any sale bills
        const saleBills = await db.query(`
            SELECT COUNT(*) as bill_count FROM sale_bills WHERE customer_id = ?`,
            [customerId]
        );
        
        if (saleBills[0].bill_count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete customer with existing sale records.' 
            });
        }
        
        const result = await db.run(`
            DELETE FROM customers WHERE customer_id = ?`,
            [customerId]
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        res.status(200).json({ message: 'Customer deleted successfully' });
    } catch (err) {
        console.error('Error deleting customer:', err);
        res.status(500).json({ error: 'Failed to delete customer' });
    }
});

module.exports = router;