import React, { useState, useEffect } from 'react';
import { Container, TextField, Button, Typography, MenuItem, Select, FormControl, InputLabel, Paper, Box } from '@mui/material';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const AddCreditPayment = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [bills, setBills] = useState([]);
  const [selectedBillId, setSelectedBillId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [nextDueDate, setNextDueDate] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [loadingBills, setLoadingBills] = useState(false);

  // Fetch customers on mount
  useEffect(() => {
    axios.get('http://localhost:5001/api/customers')
      .then(res => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, []);

  // Fetch bills when customer changes
  useEffect(() => {
    setSelectedBillId('');
    setPendingAmount(0);
    if (selectedCustomer) {
      setLoadingBills(true);
      axios.get(`http://localhost:5001/api/credit-records?customer_id=${selectedCustomer}`)
        .then(res => {
          // Only show bills with pending credit
          setBills(res.data.filter(bill => bill.credit_amount > 0));
          setLoadingBills(false);
        })
        .catch(() => {
          setBills([]);
          setLoadingBills(false);
        });
    } else {
      setBills([]);
    }
  }, [selectedCustomer]);

  // Update pending amount on bill selection
  useEffect(() => {
    const bill = bills.find(b => b.id === parseInt(selectedBillId));
    setPendingAmount(bill ? bill.credit_amount : 0);
  }, [selectedBillId, bills]);

  const handleAddPayment = async () => {
    if (!selectedCustomer || !selectedBillId || !amountPaid) {
      alert('Please select customer, bill, and enter amount.');
      return;
    }
    if (parseFloat(amountPaid) <= 0 || parseFloat(amountPaid) > pendingAmount) {
      alert('Enter a valid amount.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5001/api/credit-payment', {
        sale_id: selectedBillId,
        amount_paid: parseFloat(amountPaid),
        next_due_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      });
      alert(`Payment added! Updated credit amount: ${response.data.updatedCreditAmount}`);
      // Refresh bills
      setAmountPaid('');
      setNextDueDate(null);
      axios.get(`http://localhost:5001/api/credit-records?customer_id=${selectedCustomer}`)
        .then(res => setBills(res.data.filter(bill => bill.credit_amount > 0)));
      setSelectedBillId('');
      setPendingAmount(0);
    } catch (error) {
      alert('Failed to add payment');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Add Credit Payment</Typography>
      <FormControl fullWidth margin="normal">
        <InputLabel>Customer</InputLabel>
        <Select
          value={selectedCustomer}
          label="Customer"
          onChange={e => setSelectedCustomer(e.target.value)}
        >
          <MenuItem value=""><em>Select Customer</em></MenuItem>
          {customers.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.name} ({c.phone})</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth margin="normal" disabled={!selectedCustomer || loadingBills}>
        <InputLabel>Pending Bills</InputLabel>
        <Select
          value={selectedBillId}
          label="Pending Bills"
          onChange={e => setSelectedBillId(e.target.value)}
        >
          <MenuItem value=""><em>Select Bill</em></MenuItem>
          {bills.map(b => (
            <MenuItem key={b.id} value={b.id}>
              Bill #{b.id} | {b.product_name} | Credit: ${b.credit_amount} | Date: {b.sale_date?.split('T')[0]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {selectedBillId && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, mt: 1 }}>
          <Typography><b>Bill Details</b></Typography>
          <Typography>Bill ID: {selectedBillId}</Typography>
          <Typography>Pending Credit: PKR{pendingAmount}</Typography>
        </Paper>
      )}
      <TextField
        label="Amount Paid"
        type="number"
        fullWidth
        margin="normal"
        value={amountPaid}
        inputProps={{ min: 1, max: pendingAmount }}
        onChange={e => setAmountPaid(e.target.value)}
        disabled={!selectedBillId}
      />
      <Box mt={2} mb={2}>
        <Typography variant="body1">Next Due Date (optional)</Typography>
        <DatePicker
          selected={nextDueDate}
          onChange={setNextDueDate}
          dateFormat="yyyy-MM-dd"
          disabled={!selectedBillId}
        />
      </Box>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAddPayment}
        disabled={!selectedBillId || !amountPaid}
      >
        Add Payment
      </Button>
    </Container>
  );
};

export default AddCreditPayment;