import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Grid,
  Box,
  Chip,
  Alert,
  InputAdornment,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableBody,
} from '@mui/material';
import { Search, CalendarToday } from '@mui/icons-material';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PayCreditModalSell from './components/PayCreditModalSell';
import SellInvoiceDetailModal from './components/SellInvoiceDetailModal';

// Safe formatting functions
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } catch {
    return dateString.split('T')[0] || 'N/A';
  }
};

const formatCurrency = (value) => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value.toFixed(2);
  }
  if (typeof value === 'string' && !isNaN(parseFloat(value))) {
    return parseFloat(value).toFixed(2);
  }
  return '0.00';
};

const isDueSoon = (dueDate) => {
  if (!dueDate) return false;
  try {
    const today = new Date();
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) return false;
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  } catch {
    return false;
  }
};

const CreditRecords = () => {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPayCreditModal, setShowPayCreditModal] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [totals, setTotals] = useState({
    totalPurchases: 0,
    totalCredit: 0,
    totalPayments: 0,
  });
  const [paymentHistory, setPaymentHistory] = useState({});

  const API_URL = 'http://faridagri.devzytic.com/api';

  // Fetch customers on mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch invoices when customer, start date, or end date changes
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerData(selectedCustomerId);
    } else {
      setInvoices([]);
      setTotals({ totalPurchases: 0, totalCredit: 0, totalPayments: 0 });
      setPaymentHistory({});
    }
  }, [selectedCustomerId, startDate, endDate]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching customers from:', `${API_URL}/credit-records/customers`);
      const response = await axios.get(`${API_URL}/credit-records/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error, error.response?.data);
      setError('Failed to fetch customers: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerData = async (customerId) => {
    if (!customerId) {
      setInvoices([]);
      setTotals({ totalPurchases: 0, totalCredit: 0, totalPayments: 0 });
      setPaymentHistory({});
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Fetching invoices for customer:', customerId, {
        start_date: startDate ? startDate.toISOString().split('T')[0] : '',
        end_date: endDate ? endDate.toISOString().split('T')[0] : '',
      });
      const invoiceResponse = await axios.get(`${API_URL}/credit-records/sale-invoices`, {
        params: {
          customer_id: customerId,
          start_date: startDate ? startDate.toISOString().split('T')[0] : '',
          end_date: endDate ? endDate.toISOString().split('T')[0] : '',
        },
      });

      const parsedInvoices = invoiceResponse.data
        .filter((invoice) => invoice.credit_amount > 0) // Show only invoices with credit
        .map((invoice) => ({
          ...invoice,
          record_id: invoice.id,
          record_date: invoice.sale_date,
          total_bill_amount: parseFloat(invoice.total_bill_amount) || 0,
          amount_paid: parseFloat(invoice.amount_paid) || 0,
          credit_amount: parseFloat(invoice.credit_amount) || 0,
        }));

      setInvoices(parsedInvoices);

      // Calculate totals
      const totalPurchases = parsedInvoices.reduce((sum, invoice) => sum + invoice.total_bill_amount, 0);
      const totalCredit = parsedInvoices.reduce((sum, invoice) => sum + invoice.credit_amount, 0);
      const totalPayments = parsedInvoices.reduce((sum, invoice) => sum + invoice.amount_paid, 0);

      setTotals({
        totalPurchases,
        totalCredit,
        totalPayments,
      });

      // Fetch payment history for each invoice
      const paymentData = {};
      for (const invoice of parsedInvoices) {
        try {
          console.log(`Fetching payments for invoice: ${invoice.record_id}`);
          const response = await axios.get(`${API_URL}/credit-payments/${invoice.record_id}`, {
            params: { type: 'sale' },
          });
          paymentData[invoice.record_id] = response.data.map((payment) => ({
            ...payment,
            amount_paid: parseFloat(payment.amount_paid) || 0,
          }));
        } catch (error) {
          console.error(`Error fetching payments for invoice ${invoice.record_id}:`, error);
          paymentData[invoice.record_id] = [];
        }
      }
      setPaymentHistory(paymentData);
    } catch (error) {
      console.error('Error fetching customer data:', error, error.response?.data);
      setError('Failed to fetch customer data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePayCreditClick = (invoice) => {
    console.log('Opening pay credit modal for invoice:', invoice);
    if (!invoice.record_id) {
      console.error('Invalid invoice: missing record_id', invoice);
      setError('Cannot open payment modal: Invoice ID is missing.');
      return;
    }
    setInvoiceToPay(invoice);
    setShowPayCreditModal(true);
  };

  const handlePayCreditSuccess = () => {
    setShowPayCreditModal(false);
    setInvoiceToPay(null);
    if (selectedCustomerId) {
      fetchCustomerData(selectedCustomerId);
    }
  };

  const handleViewDetails = (invoiceId) => {
    console.log('Opening modal for invoice ID:', invoiceId);
    setSelectedInvoiceId(invoiceId);
  };

  const handleCloseDetails = () => {
    console.log('Closing modal');
    setSelectedInvoiceId(null);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Customer Credit & Purchase History
      </Typography>

      {/* Customer Selection and Filters */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Customer</InputLabel>
              <Select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <MenuItem value="">Select a Customer</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name} (ID: {customer.id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              placeholderText="Start Date"
              customInput={
                <TextField
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday />
                      </InputAdornment>
                    ),
                  }}
                />
              }
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              placeholderText="End Date"
              customInput={
                <TextField
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarToday />
                      </InputAdornment>
                    ),
                  }}
                />
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" sx={{ py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !selectedCustomerId && (
        <Paper elevation={3} sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Please select a customer to view their credit and purchase history.
          </Typography>
        </Paper>
      )}

      {/* Totals Summary */}
      {selectedCustomerId && !loading && invoices.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Customer Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body1">
                  Total Purchases: <strong>PKR {formatCurrency(totals.totalPurchases)}</strong>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body1">
                  Total Credit: <strong>PKR {formatCurrency(totals.totalCredit)}</strong>
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="body1">
                  Total Payments: <strong>PKR {formatCurrency(totals.totalPayments)}</strong>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Invoices Table */}
      {selectedCustomerId && !loading && (
        <TableContainer component={Paper} elevation={3}>
          <Table sx={{ minWidth: 650 }} aria-label="credit records table">
            <TableHead sx={{ backgroundColor: 'primary.main' }}>
              <TableRow>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Invoice ID</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Invoice Number</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Payment</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Paid</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Credit</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Due Date</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Sale Date</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Payment History</TableCell>
                <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length > 0 ? (
                invoices.map((invoice) => {
                  const dueSoon = isDueSoon(invoice.credit_due_date);
                  const payments = paymentHistory[invoice.record_id] || [];
                  return (
                    <TableRow
                      key={invoice.record_id}
                      hover
                      sx={{
                        backgroundColor: dueSoon ? 'rgba(255, 0, 0, 0.1)' : 'inherit',
                        '&:last-child td, &:last-child th': { border: 0 },
                      }}
                    >
                      <TableCell>{invoice.record_id}</TableCell>
                      <TableCell>{invoice.invoice_number}</TableCell>
                      <TableCell>PKR {formatCurrency(invoice.total_bill_amount)}</TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.payment_type}
                          size="small"
                          color={invoice.payment_type === 'cash' ? 'primary' : 'warning'}
                        />
                      </TableCell>
                      <TableCell>PKR {formatCurrency(invoice.amount_paid)}</TableCell>
                      <TableCell
                        sx={{ color: invoice.credit_amount > 0 ? 'error.main' : 'success.main' }}
                      >
                        PKR {formatCurrency(invoice.credit_amount)}
                      </TableCell>
                      <TableCell sx={{ color: dueSoon ? 'error.main' : 'inherit', fontWeight: dueSoon ? 'bold' : 'normal' }}>
                        {formatDate(invoice.credit_due_date)}
                      </TableCell>
                      <TableCell>{formatDate(invoice.sale_date)}</TableCell>
                      <TableCell>
                        {payments.length > 0 ? (
                          <Box>
                            {payments.map((payment) => (
                              <Typography key={payment.id} variant="body2">
                                {formatDate(payment.payment_date)}: PKR {formatCurrency(payment.amount_paid)}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No payments
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          color="info"
                          size="small"
                          onClick={() => handleViewDetails(invoice.record_id)}
                          sx={{ mr: 1 }}
                        >
                          View
                        </Button>
                        <Button
                          variant="contained"
                          color="warning"
                          size="small"
                          onClick={() => handlePayCreditClick(invoice)}
                          disabled={invoice.credit_amount <= 0}
                        >
                          Pay Credit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No invoices found for this customer
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {selectedInvoiceId && (
        <SellInvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={handleCloseDetails}
        />
      )}

      {showPayCreditModal && invoiceToPay && (
        <PayCreditModalSell
          invoice={invoiceToPay}
          onClose={() => setShowPayCreditModal(false)}
          onSuccess={handlePayCreditSuccess}
        />
      )}
    </Container>
  );
};

export default CreditRecords;