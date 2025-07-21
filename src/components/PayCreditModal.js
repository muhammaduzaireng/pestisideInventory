import React, { useState, useEffect } from 'react'; // Added useEffect
import { stockPurchases } from '../services/api';

const PayCreditModal = ({ invoice, onClose, onSuccess }) => {
    // Ensure invoice.credit_amount is a number, default to 0 if not
    const initialCreditAmount = parseFloat(invoice.credit_amount) || 0;
    const [amountToPay, setAmountToPay] = useState(initialCreditAmount);
    const [paymentDate, setPaymentDate] = useState('');
    const [isPartialPayment, setIsPartialPayment] = useState(false);
    const [newCreditDueDate, setNewCreditDueDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Set initial payment date to today
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        setPaymentDate(today);
    }, []);

    // Effect to determine if it's a partial payment
    useEffect(() => {
        setIsPartialPayment(parseFloat(amountToPay) < initialCreditAmount);
    }, [amountToPay, initialCreditAmount]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const parsedAmountToPay = parseFloat(amountToPay);

        if (isNaN(parsedAmountToPay) || parsedAmountToPay <= 0 || parsedAmountToPay > initialCreditAmount) {
            setError('Amount to pay must be a valid number, greater than 0, and not exceed the outstanding credit.');
            setLoading(false);
            return;
        }

        if (isPartialPayment && !newCreditDueDate) {
            setError('Please provide a new credit due date for partial payment.');
            setLoading(false);
            return;
        }

        try {
            const payload = {
                amount_paid: parsedAmountToPay,
                payment_date: paymentDate
            };

            if (isPartialPayment) {
                payload.new_credit_due_date = newCreditDueDate;
            }

            await stockPurchases.payCredit(invoice.id, payload);
            onSuccess(); // Refresh the list of invoices
        } catch (err) {
            console.error('Error paying credit:', err.response ? err.response.data : err);
            setError(err.response?.data?.error || 'Failed to record payment.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Pay Credit for Invoice {invoice.invoice_number}</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}
            <p><strong>Outstanding Credit:</strong> ${initialCreditAmount.toFixed(2)}</p>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label>
                        Amount to Pay:
                        <input
                            type="number"
                            value={amountToPay}
                            onChange={(e) => setAmountToPay(e.target.value)}
                            min="0.01"
                            max={initialCreditAmount}
                            step="0.01"
                            required
                            style={{ marginLeft: '10px', padding: '8px', width: 'calc(100% - 120px)' }}
                            disabled={loading}
                        />
                    </label>
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label>
                        Payment Date:
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                            style={{ marginLeft: '10px', padding: '8px', width: 'calc(100% - 120px)' }}
                            disabled={loading}
                        />
                    </label>
                </div>

                {isPartialPayment && (
                    <div style={{ marginBottom: '15px', padding: '10px', border: '1px dashed #ccc', borderRadius: '5px' }}>
                        <p style={{ color: 'orange', fontWeight: 'bold' }}>Partial Payment Detected!</p>
                        <label>
                            New Credit Due Date:
                            <input
                                type="date"
                                value={newCreditDueDate}
                                onChange={(e) => setNewCreditDueDate(e.target.value)}
                                required={isPartialPayment} // Make it required only for partial payments
                                style={{ marginLeft: '10px', padding: '8px', width: 'calc(100% - 120px)' }}
                                disabled={loading}
                            />
                        </label>
                        <p style={{ fontSize: '0.9em', color: '#555', marginTop: '5px' }}>
                            Please set a new due date for the remaining credit.
                        </p>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={onClose} disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}>
                        {loading ? 'Processing...' : 'Record Payment'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PayCreditModal;