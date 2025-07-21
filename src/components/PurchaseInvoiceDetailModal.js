import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from '@mui/material';
import { stockPurchases } from '../services/api';
import axios from 'axios';
import jsPDF from 'jspdf';

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

const PurchaseInvoiceDetailModal = ({ invoiceId, onClose }) => {
  const [invoice, setInvoice] = useState(null);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const API_URL = 'http://localhost:5001/api';

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setLoading(true);
      try {
        // Fetch invoice details
        const invoiceResponse = await stockPurchases.getPurchaseById(invoiceId);
        console.log('Fetched invoice details:', invoiceResponse.data);
        const parsedInvoice = {
          ...invoiceResponse.data,
          total_bill_amount: parseFloat(invoiceResponse.data.total_bill_amount) || 0,
          amount_paid: parseFloat(invoiceResponse.data.amount_paid) || 0,
          credit_amount: parseFloat(invoiceResponse.data.credit_amount) || 0,
          vendor_name: invoiceResponse.data.vendor_name || 'Unknown Vendor',
          items: (invoiceResponse.data.items || []).map((item) => ({
            ...item,
            id: item.id || `temp-${Math.random()}`,
            product_name: item.product_name || 'Unknown Product',
            barcode: item.barcode || 'N/A',
            added_stock: parseInt(item.added_stock) || 0,
            purchase_price: parseFloat(item.purchase_price) || 0,
            sell_price: parseFloat(item.sell_price) || 0,
            subtotal: parseFloat((item.added_stock * item.purchase_price).toFixed(2)) || 0,
          })),
        };
        setInvoice(parsedInvoice);

        // Fetch payment records
        try {
          const paymentResponse = await axios.get(`${API_URL}/credit-payments/${invoiceId}?type=purchase`);
          console.log('Fetched payment records:', paymentResponse.data);
          setPaymentRecords(paymentResponse.data || []);
        } catch (paymentErr) {
          console.warn('Failed to fetch payment records:', paymentErr.response?.data || paymentErr.message);
          setPaymentRecords([]); // Set empty array to allow rendering
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching invoice details:', err);
        if (err.code === 'ECONNRESET' && retryCount < maxRetries) {
          setRetryCount(retryCount + 1);
          setTimeout(() => {
            fetchInvoiceDetails();
          }, 1000 * (retryCount + 1));
        } else {
          setError(
            err.response?.status === 404
              ? `Invoice with ID ${invoiceId} not found.`
              : err.code === 'ECONNRESET'
              ? 'Failed to connect to the database. Please try again later.'
              : err.code === 'ER_BAD_FIELD_ERROR'
              ? 'Database configuration error. Please contact support.'
              : 'Failed to load invoice details.'
          );
        }
      } finally {
        setLoading(false); // Always reset loading state
      }
    };

    if (invoiceId) {
      fetchInvoiceDetails();
    } else {
      setError('No invoice ID provided.');
      setLoading(false);
    }
  }, [invoiceId, retryCount]);

  const generatePdfBill = () => {
    if (!invoice) return;

    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(22);
    doc.text('Purchase Invoice', 105, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(12);
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 20, yPos);
    yPos += 7;
    doc.text(`Purchase Date: ${formatDate(invoice.purchase_date)}`, 20, yPos);
    yPos += 7;
    doc.text(`Vendor: ${invoice.vendor_name || 'Unknown Vendor'}`, 20, yPos);
    yPos += 10;

    // Payment summary
    doc.setFontSize(14);
    doc.text('Payment Summary:', 20, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text(`Method: ${invoice.payment_method.replace(/_/g, ' ').toUpperCase()}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Bill Amount: $${formatCurrency(invoice.total_bill_amount)}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Amount Paid: $${formatCurrency(invoice.amount_paid)}`, 20, yPos);
    yPos += 7;
    doc.text(`Pending Credit: $${formatCurrency(invoice.credit_amount)}`, 20, yPos);
    yPos += 7;

    if (invoice.payment_method === 'credit' || invoice.payment_method === 'cash_and_credit') {
      doc.text(`Credit Due Date: ${formatDate(invoice.credit_due_date)}`, 20, yPos);
      yPos += 7;
    }
    if (invoice.payment_method === 'bank_transfer' || (invoice.payment_method === 'cash_and_credit' && invoice.transaction_id)) {
      doc.text(`Transaction ID: ${invoice.transaction_id || 'N/A'}`, 20, yPos);
      yPos += 7;
      doc.text(`Bank Name: ${invoice.bank_name || 'N/A'}`, 20, yPos);
      yPos += 7;
    }
    yPos += 10;

    // Payment history
    if (paymentRecords.length > 0) {
      doc.setFontSize(14);
      doc.text('Payment History:', 20, yPos);
      yPos += 7;

      const paymentHeaders = ['Payment Date', 'Amount Paid'];
      const paymentColWidths = [80, 50];
      const startX = 20;

      doc.setFontSize(10);
      paymentHeaders.forEach((header, i) => {
        doc.text(header, startX + paymentColWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      yPos += 5;
      doc.line(startX, yPos, startX + paymentColWidths.reduce((a, b) => a + b, 0), yPos);
      yPos += 5;

      paymentRecords.forEach((payment) => {
        const rowData = [formatDate(payment.payment_date), `$${formatCurrency(payment.amount_paid)}`];
        rowData.forEach((data, i) => {
          doc.text(String(data), startX + paymentColWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
        });
        yPos += 7;
      });
      yPos += 10;
    }

    // Product details table
    doc.setFontSize(14);
    doc.text('Purchased Products:', 20, yPos);
    yPos += 7;

    const tableHeaders = ['Product Name', 'Barcode', 'Quantity', 'Purchase Price', 'Sell Price', 'Expiry Date', 'Subtotal'];
    const colWidths = [50, 30, 20, 30, 30, 30, 30];
    const startX = 20;

    doc.setFontSize(10);
    tableHeaders.forEach((header, i) => {
      doc.text(header, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
    });
    yPos += 5;
    doc.line(startX, yPos, startX + colWidths.reduce((a, b) => a + b, 0), yPos);
    yPos += 5;

    invoice.items.forEach((item) => {
      const itemSubtotal = item.added_stock * item.purchase_price;
      const rowData = [
        item.product_name,
        item.barcode,
        item.added_stock,
        `$${formatCurrency(item.purchase_price)}`,
        `$${formatCurrency(item.sell_price)}`,
        formatDate(item.expiry_date),
        `$${formatCurrency(itemSubtotal)}`,
      ];
      rowData.forEach((data, i) => {
        doc.text(String(data), startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      yPos += 7;
    });

    doc.save(`Purchase_Invoice_${invoice.invoice_number}.pdf`);
  };

  if (loading) return <Box sx={{ p: 2, textAlign: 'center' }}>Loading Invoice Details...</Box>;
  if (error) return <Box sx={{ p: 2, color: 'error.main', textAlign: 'center' }}>{error}</Box>;
  if (!invoice) return <Box sx={{ p: 2, textAlign: 'center' }}>No invoice data found.</Box>;

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
          maxHeight: '90vh',
          overflowY: 'auto',
          width: '80%',
          maxWidth: '800px',
        }}
      >
        <Typography variant="h5" sx={{ mb: 2 }}>
          Purchase Invoice Details - {invoice.invoice_number}
        </Typography>
        <Typography>
          <strong>Vendor:</strong> {invoice.vendor_name || 'Unknown Vendor'}
        </Typography>
        <Typography>
          <strong>Purchase Date:</strong> {formatDate(invoice.purchase_date)}
        </Typography>
        <Typography>
          <strong>Total Bill Amount:</strong> ${formatCurrency(invoice.total_bill_amount)}
        </Typography>
        <Typography>
          <strong>Payment Method:</strong> {invoice.payment_method.replace(/_/g, ' ').toUpperCase()}
        </Typography>
        <Typography>
          <strong>Total Amount Paid:</strong> ${formatCurrency(invoice.amount_paid)}
        </Typography>
        <Typography sx={{ color: invoice.credit_amount > 0 ? 'error.main' : 'success.main' }}>
          <strong>Pending Credit:</strong> ${formatCurrency(invoice.credit_amount)}
        </Typography>

        {(invoice.payment_method === 'credit' || invoice.payment_method === 'cash_and_credit') && (
          <Typography>
            <strong>Credit Due Date:</strong> {formatDate(invoice.credit_due_date)}
          </Typography>
        )}
        {(invoice.payment_method === 'bank_transfer' || (invoice.payment_method === 'cash_and_credit' && invoice.transaction_id)) && (
          <>
            <Typography>
              <strong>Transaction ID:</strong> {invoice.transaction_id || 'N/A'}
            </Typography>
            <Typography>
              <strong>Bank Name:</strong> {invoice.bank_name || 'N/A'}
            </Typography>
          </>
        )}

        {paymentRecords.length > 0 && (
          <>
            <Typography variant="h6" sx={{ mt: 2 }}>
              Payment History:
            </Typography>
            <TableContainer component={Paper} sx={{ mt: 1 }}>
              <Table aria-label="payment history table">
                <TableHead>
                  <TableRow>
                    <TableCell>Payment Date</TableCell>
                    <TableCell align="right">Amount Paid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paymentRecords.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell align="right">${formatCurrency(payment.amount_paid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        <Typography variant="h6" sx={{ mt: 2 }}>
          Items Purchased:
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 1 }}>
          <Table aria-label="items table">
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell align="right">Purchase Price</TableCell>
                <TableCell align="right">Sell Price</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell align="right">Subtotal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.items &&
                invoice.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.product_name} ({item.barcode})
                    </TableCell>
                    <TableCell>{item.barcode}</TableCell>
                    <TableCell>{item.added_stock}</TableCell>
                    <TableCell align="right">${formatCurrency(item.purchase_price)}</TableCell>
                    <TableCell align="right">${formatCurrency(item.sell_price)}</TableCell>
                    <TableCell>{formatDate(item.expiry_date)}</TableCell>
                    <TableCell align="right">${formatCurrency(item.added_stock * item.purchase_price)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="contained" color="primary" onClick={generatePdfBill}>
            Generate PDF
          </Button>
          <Button variant="outlined" color="secondary" onClick={onClose}>
            Close
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default PurchaseInvoiceDetailModal;