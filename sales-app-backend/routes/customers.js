// sales-app-backend/routes/customers.js (MINIMAL ROUTES)
const express = require('express');
const router = express.Router();
const { query } = require('../db'); 

// ----------------------------------------------------
// GET /api/customers - Fetch all customers
// ----------------------------------------------------
router.get('/', async (req, res) => {
    try {
        const result = await query(`
            -- Select only the columns that exist in the final table
            SELECT 
                customer_id, 
                name, 
                phone, 
                address, 
                created_at
            FROM customers 
            ORDER BY customer_id ASC`);
            
        res.status(200).json(result.rows);
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
        const insertQuery = `
            -- Only insert into the three required data columns
            INSERT INTO customers (name, phone, address) 
            VALUES ($1, $2, $3)
            RETURNING *;`;
            
        // $1=name, $2=phone (from contact), $3=address
        const result = await query(insertQuery, [
            name, 
            contact, 
            address 
        ]);
        
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating customer:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});


module.exports = router;