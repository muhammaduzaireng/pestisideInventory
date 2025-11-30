const express = require('express');
const router = express.Router();
const db = require('../db');

// ----------------------------------------------------
// POST /api/customers/:id/previous-bill
// Add a customer's previous bill with balance
// ----------------------------------------------------
router.post('/:id/previous-bill', async (req, res) => {
    const customerId = req.params.id;
    const { previous_bill_number, previous_diary_number, amount } = req.body;

    // Validate required fields
    if (!previous_bill_number || !previous_diary_number || amount === undefined) {
        return res.status(400).json({ 
            error: 'Previous bill number, diary number, and amount are required.'
        });
    }

    // Default values for other columns
    const billNumber = `PREV-${Date.now()}`; // optional unique bill number
    const totalAmount = 0.00;  // not needed for previous bill scenario
    const paidAmount = 0.00;
    const paymentType = 'Previous Bill';
    const date = new Date();

    try {
        const result = await db.run(
            `
            INSERT INTO sale_bills 
                (customer_id, bill_number, previous_bill_number, diary_number, total_amount, paid_amount, balance, payment_type, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                customerId,
                billNumber,
                previous_bill_number,
                previous_diary_number,
                totalAmount,
                paidAmount,
                amount,         // save the provided amount as balance
                paymentType,
                date
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
