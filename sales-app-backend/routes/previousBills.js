// sales-app-backend/routes/previousBills.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------
// POST /api/customers/:id/previous-bill
// Add customer's previous outstanding bill
// ----------------------------------------------------
router.post('/:id/previous-bill', async (req, res) => {
    const customerId = req.params.id;
    const { 
        previous_bill_number, 
        previous_diary_number, 
        outstanding_amount 
    } = req.body;

    if (!previous_bill_number || !previous_diary_number || !outstanding_amount) {
        return res.status(400).json({ 
            error: 'Bill number, diary number, and amount are required.'
        });
    }

    try {
        const result = await db.run(
            `
            INSERT INTO sale_bills 
                (customer_id, previous_bill_number, previous_diary_number, outstanding_amount) 
            VALUES (?, ?, ?, ?)
            `,
            [
                customerId, 
                previous_bill_number, 
                previous_diary_number, 
                outstanding_amount
            ]
        );

        res.status(201).json({
            message: "Previous bill added successfully",
            bill_id: result.id
        });

    } catch (err) {
        console.error("Error saving previous bill:", err);
        res.status(500).json({ error: "Failed to save previous bill" });
    }
});

module.exports = router;
