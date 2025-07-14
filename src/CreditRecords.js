import React, { useState, useEffect } from 'react';
import { 
  Container, 
  TextField, 
  Button, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Typography, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel,
  Grid,
  Box,
  Chip,
  Alert,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import { Sort, Search, CalendarToday } from '@mui/icons-material';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Safe formatting functions
const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
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

const isDueSoon = (dueDate) => {
  if (!dueDate) return false;
  try {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  } catch {
    return false;
  }
};

const CreditRecords = () => {
  const [records, setRecords] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sortOption, setSortOption] = useState('sale_date');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCreditRecords();
  }, [customerId, customerName, startDate, endDate, sortOption]);

  const fetchCreditRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('http://localhost:5001/api/credit-records', {
        params: { 
          customer_id: customerId,
          customer_name: customerName,
          start_date: startDate ? startDate.toISOString().split('T')[0] : '',
          end_date: endDate ? endDate.toISOString().split('T')[0] : '',
          sort: sortOption,
        }
      });
      setRecords(response.data);
    } catch (error) {
      console.error('Error fetching credit records:', error);
      setError('Failed to fetch credit records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sortedRecords = [...records].sort((a, b) => {
    const aDueSoon = isDueSoon(a.credit_due_date);
    const bDueSoon = isDueSoon(b.credit_due_date);
    
    if (aDueSoon && !bDueSoon) return -1;
    if (!aDueSoon && bDueSoon) return 1;
    return 0;
  });

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Credit Records
      </Typography>

      {/* Filter Section */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Customer ID"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Enter Customer ID"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter Customer Name"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
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
          
          <Grid item xs={12} sm={6} md={2}>
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
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <MenuItem value="sale_date">Date</MenuItem>
                <MenuItem value="customer_name">Customer Name</MenuItem>
                <MenuItem value="amount_paid">Amount Paid</MenuItem>
                <MenuItem value="credit_amount">Credit Amount</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Records Table */}
      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead sx={{ backgroundColor: 'primary.main' }}>
            <TableRow>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>ID</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Customer</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Product</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Qty</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Total</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Payment</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Paid</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Credit</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Due Date</TableCell>
              <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : sortedRecords.length > 0 ? (
              sortedRecords.map((record) => {
                const dueSoon = isDueSoon(record.credit_due_date);
                return (
                  <TableRow 
                    key={record.id}
                    hover
                    sx={{ 
                      backgroundColor: dueSoon ? 'rgba(255, 0, 0, 0.1)' : 'inherit',
                      '&:last-child td, &:last-child th': { border: 0 } 
                    }}
                  >
                    <TableCell>{record.id}</TableCell>
                    <TableCell>
                      {record.customer_name}
                      {dueSoon && (
                        <Chip 
                          label="Due Soon" 
                          size="small" 
                          color="error" 
                          sx={{ ml: 1 }} 
                        />
                      )}
                    </TableCell>
                    <TableCell>{record.product_name}</TableCell>
                    <TableCell>{record.quantity}</TableCell>
                    <TableCell>PKR{formatCurrency(record.total_price)}</TableCell>
                    <TableCell>
                      <Chip 
                        label={record.payment_type} 
                        size="small" 
                        color={record.payment_type === 'cash' ? 'primary' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>PKR{formatCurrency(record.amount_paid)}</TableCell>
                    <TableCell>PKR{formatCurrency(record.credit_amount)}</TableCell>
                    <TableCell sx={{ color: dueSoon ? 'error.main' : 'inherit', fontWeight: dueSoon ? 'bold' : 'normal' }}>
                      {formatDate(record.credit_due_date)}
                    </TableCell>
                    <TableCell>{formatDate(record.sale_date)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No credit records found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default CreditRecords;