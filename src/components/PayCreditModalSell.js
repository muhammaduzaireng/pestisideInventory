import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { sellRecords } from '../services/api'; // Adjust path to match your project structure

const PayCreditModalSell = ({ invoice, onClose, onSuccess }) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [newCreditDueDate, setNewCreditDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validate invoice prop on mount
  React.useEffect(() => {
    if (!invoice || !invoice.record_id) {
      setError('Invalid invoice data: record_id is missing.');
      console.error('Invalid invoice prop:', invoice);
    }
  }, [invoice]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate invoice.record_id
      if (!invoice?.record_id) {
        throw new Error('Invoice ID is missing.');
      }

      const amount = parseFloat(paymentAmount);
      if (isNaN(amount) || amount <= 0 || amount > invoice.credit_amount) {
        throw new Error('Invalid payment amount.');
      }
      if (!paymentDate) {
        throw new Error('Payment date is required.');
      }

      const paymentData = {
        payment_amount: amount,
        payment_date: paymentDate,
      };
      if (newCreditDueDate) {
        paymentData.new_credit_due_date = newCreditDueDate;
      }

      await sellRecords.payCredit(invoice.record_id, paymentData);

      onSuccess();
      setLoading(false);
    } catch (err) {
      console.error('Error processing payment:', err);
      setError(err.response?.data?.error || 'Failed to process payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 3,
          borderRadius: 2,
          width: '50%',
          maxWidth: '600px',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Pay Credit for Invoice #{invoice?.invoice_number || 'Unknown'}
        </Typography>
        <Typography sx={{ mb: 2 }}>
          Credit Due: ${formatCurrency(invoice?.credit_amount)}
        </Typography>
        {error && (
          <Typography color="error.main" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Payment Amount"
            type="number"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            inputProps={{ min: 0, max: invoice?.credit_amount || 0, step: '0.01' }}
            sx={{ mb: 2 }}
            disabled={!invoice?.record_id}
          />
          <TextField
            fullWidth
            label="Payment Date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            sx={{ mb: 2 }}
            required
            disabled={!invoice?.record_id}
          />
          <TextField
            fullWidth
            label="New Credit Due Date (Optional)"
            type="date"
            value={newCreditDueDate}
            onChange={(e) => setNewCreditDueDate(e.target.value)}
            sx={{ mb: 2 }}
            disabled={!invoice?.record_id}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={loading || !invoice?.record_id}
            >
              {loading ? <CircularProgress size={24} /> : 'Submit Payment'}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          </Box>
        </form>
      </Box>
    </Box>
  );
};

const formatCurrency = (value) => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'string' && !isNaN(parseFloat(value))) {
    return parseFloat(value).toFixed(2);
  }
  return '0.00';
};

export default PayCreditModalSell;