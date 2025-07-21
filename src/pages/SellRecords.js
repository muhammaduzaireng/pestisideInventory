import React, { useState, useEffect } from 'react';
import {
  Container,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { sellRecords } from '../services/api'; // Import sellRecords service
import SellInvoiceDetailModal from '../components/SellInvoiceDetailModal';
import PayCreditModalSell from '../components/PayCreditModalSell'; // Use PayCreditModalSell for sales

const formatCurrency = (value) => {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'string' && !isNaN(parseFloat(value))) {
    return parseFloat(value).toFixed(2);
  }
  return '0.00';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
  } catch (e) {
    console.warn('Failed to format date:', dateString, e);
    return dateString.split('T')[0] || dateString;
  }
};

const SellRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showPayCreditModal, setShowPayCreditModal] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState(null);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const response = await sellRecords.getAll();
      console.log('Fetched sell records:', response.data); // Debug API response
      const parsedRecords = response.data.map((record) => ({
        ...record,
        amount_paid: parseFloat(record.amount_paid) || 0,
        credit_amount: parseFloat(record.credit_amount) || 0,
        total_bill_amount: parseFloat(record.total_bill_amount) || 0,
      }));
      setRecords(parsedRecords);
      setError(null);
    } catch (error) {
      console.error('Error fetching sell records:', error.response?.data || error.message);
      setError(error.response?.data?.error || 'Failed to fetch records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleViewDetails = (invoiceId) => {
    console.log('Opening modal for invoice ID:', invoiceId); // Debug modal trigger
    setSelectedInvoiceId(invoiceId);
  };

  const handleCloseDetails = () => {
    console.log('Closing modal'); // Debug modal close
    setSelectedInvoiceId(null);
  };

  const handlePayCreditClick = (invoice) => {
    console.log('Opening pay credit modal for invoice:', invoice); // Debug invoice data
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
    fetchRecords();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Sales Records</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Refresh />}
          onClick={fetchRecords}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box
          sx={{
            p: 2,
            backgroundColor: 'error.light',
            color: 'error.contrastText',
            borderRadius: 1,
            textAlign: 'center',
          }}
        >
          {error}
        </Box>
      ) : (
        <>
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

          <TableContainer component={Paper} elevation={3}>
            <Table sx={{ minWidth: 650 }} aria-label="sales records table">
              <TableHead sx={{ backgroundColor: 'primary.main' }}>
                <TableRow>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Invoice #</TableCell>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Purchase Date</TableCell>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }} align="right">
                    Paid Amount
                  </TableCell>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }} align="right">
                    Due Amount
                  </TableCell>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }}>Due Date</TableCell>
                  <TableCell sx={{ color: 'common.white', fontWeight: 'bold' }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length > 0 ? (
                  records.map((record) => (
                    <TableRow
                      key={record.record_id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>{record.invoice_number}</TableCell>
                      <TableCell>{formatDate(record.record_date)}</TableCell>
                      <TableCell align="right">${formatCurrency(record.amount_paid)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: record.credit_amount > 0 ? 'error.main' : 'success.main' }}
                      >
                        ${formatCurrency(record.credit_amount)}
                      </TableCell>
                      <TableCell>{formatDate(record.credit_due_date)}</TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          color="info"
                          size="small"
                          onClick={() => handleViewDetails(record.record_id)}
                          sx={{ mr: 1 }}
                        >
                          View
                        </Button>
                        {record.credit_amount > 0 && (
                          <Button
                            variant="contained"
                            color="warning"
                            size="small"
                            onClick={() => handlePayCreditClick(record)}
                          >
                            Pay Credit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No records found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Container>
  );
};

export default SellRecords;