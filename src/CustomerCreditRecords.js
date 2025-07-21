import React, { useState, useEffect } from 'react';
import {
  Container, Typography, MenuItem, Select, FormControl, InputLabel,
  TextField, Button, Table, TableHead, TableBody, TableCell, TableRow, Paper, Dialog, DialogTitle, DialogContent
} from '@mui/material';
import axios from 'axios';

const CustomerRecords = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sellRecords, setSellRecords] = useState([]);
  const [creditRecords, setCreditRecords] = useState([]);
  const [creditPayments, setCreditPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billDetail, setBillDetail] = useState(null);

  // Fetch customers on mount
  useEffect(() => {
    axios.get('https://faridagri.devzytic.com/api/customers')
      .then(res => setCustomers(res.data))
      .catch(() => setCustomers([]));
  }, []);

  // Fetch records for selected customer and date range
  const fetchRecords = async () => {
    // This condition ensures no records are fetched if no customer is selected
    if (!selectedCustomer) {
      setSellRecords([]);
      setCreditRecords([]);
      setCreditPayments([]);
      return;
    }
    setLoading(true);
    try {
      // customer_id is correctly passed to the backend for filtering
      const params = { customer_id: selectedCustomer };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      // Fetch Sell Records for the selected customer
      const sellRes = await axios.get('https://faridagri.devzytic.com/api/sell-records', { params });
      setSellRecords(sellRes.data);

      // Fetch Credit Records for the selected customer
      const creditRes = await axios.get('https://faridagri.devzytic.com/api/credit-records', { params });
      setCreditRecords(creditRes.data);

      // Fetch Credit Payments for the selected customer
      const paymentRes = await axios.get('https://faridagri.devzytic.com/api/credit-payments', { params });
      setCreditPayments(paymentRes.data);

    } catch (err) {
      console.error("Error fetching records:", err);
      setSellRecords([]);
      setCreditRecords([]);
      setCreditPayments([]);
    }
    setLoading(false);
  };

  // Trigger fetchRecords when selectedCustomer or date range changes
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, startDate, endDate]); // Dependencies correctly trigger re-fetch

  const handleBillDetail = async (sellId) => {
    setSelectedBill(sellId);
    setBillDetail(null); // Clear previous bill details
    try {
      const res = await axios.get(`https://faridagri.devzytic.com/api/sell/${sellId}`);
      setBillDetail(res.data);
    } catch (err) {
      console.error("Error fetching bill details:", err);
      setBillDetail({ error: 'Failed to load bill details' });
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Customer Records</Typography>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Customer</InputLabel>
        <Select
          value={selectedCustomer}
          label="Customer"
          onChange={e => setSelectedCustomer(e.target.value)}
        >
          <MenuItem value=""><em>Select customer</em></MenuItem>
          {customers.map(c => (
            <MenuItem key={c.id} value={c.id}>{c.name} ({c.phone})</MenuItem>
          ))}
        </Select>
      </FormControl>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <TextField
          label="Start Date"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="End Date"
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="outlined" onClick={fetchRecords} disabled={loading || !selectedCustomer}>
          {loading ? 'Loading...' : 'Apply Filter'}
        </Button>
      </div>

      {/* Sell Records Table */}
      <Typography variant="h6" sx={{ mt: 2 }}>Sell Records</Typography>
      <Table component={Paper} sx={{ mb: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Sell ID</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>Total Price</TableCell>
            <TableCell>Payment Type</TableCell>
            <TableCell>Amount Paid</TableCell>
            <TableCell>Credit Amount</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sellRecords.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.sale_date?.split('T')[0]}</TableCell>
              <TableCell>{r.product_name}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>PKR{r.total_price}</TableCell>
              <TableCell>{r.payment_type}</TableCell>
              <TableCell>PKR{r.amount_paid}</TableCell>
              <TableCell>PKR{r.credit_amount}</TableCell>
              <TableCell>
                <Button variant="outlined" size="small" onClick={() => handleBillDetail(r.id)}>
                  View Bill
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {sellRecords.length === 0 && <TableRow><TableCell colSpan={9} align="center">No records</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Credit Records Table */}
      <Typography variant="h6" sx={{ mt: 2 }}>Credit Records (Unpaid Bills)</Typography>
      <Table component={Paper} sx={{ mb: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Credit ID</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Credit Amount</TableCell>
            <TableCell>Due Date</TableCell>
            <TableCell>Paid</TableCell>
            <TableCell>Sale Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {creditRecords.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.product_name}</TableCell>
              <TableCell>PKR{r.credit_amount}</TableCell>
              <TableCell>{r.credit_due_date ? r.credit_due_date.split('T')[0] : '-'}</TableCell>
              <TableCell>PKR{r.amount_paid}</TableCell>
              <TableCell>{r.sale_date?.split('T')[0]}</TableCell>
            </TableRow>
          ))}
          {creditRecords.length === 0 && <TableRow><TableCell colSpan={6} align="center">No records</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Credit Payments History Table */}
      <Typography variant="h6" sx={{ mt: 2 }}>Credit Payments History</Typography>
      <Table component={Paper} sx={{ mb: 2 }}>
        <TableHead>
          <TableRow>
            <TableCell>Payment Date</TableCell>
            <TableCell>Sale ID</TableCell>
            <TableCell>Product</TableCell>
            <TableCell>Amount Paid</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {creditPayments.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.payment_date ? r.payment_date.split('T')[0] : '-'}</TableCell>
              <TableCell>{r.sale_id}</TableCell>
              <TableCell>{r.product_name}</TableCell>
              <TableCell>PKR{r.amount_paid}</TableCell>
            </TableRow>
          ))}
          {creditPayments.length === 0 && <TableRow><TableCell colSpan={4} align="center">No records</TableCell></TableRow>}
        </TableBody>
      </Table>

      {/* Bill Detail Dialog */}
      <Dialog open={!!selectedBill} onClose={() => setSelectedBill(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Bill Details (Sell ID: {selectedBill})</DialogTitle>
        <DialogContent>
          {billDetail ? (
            billDetail.error ? (
              <Typography color="error">{billDetail.error}</Typography>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(billDetail, null, 2)}</pre>
            )
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default CustomerRecords;