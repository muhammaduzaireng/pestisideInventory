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

const SellInvoiceDetailModal = ({ invoiceId, onClose }) => {
  const [invoice, setInvoice] = useState(null);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = 'http://faridagri.devzytic.com/api';

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setLoading(true);
      try {
        // Fetch invoice details
        const invoiceResponse = await axios.get(`${API_URL}/sell-records/${invoiceId}`);
        const parsedInvoice = {
          ...invoiceResponse.data,
          total_bill_amount: parseFloat(invoiceResponse.data.total_bill_amount) || 0,
          amount_paid: parseFloat(invoiceResponse.data.amount_paid) || 0,
          credit_amount: parseFloat(invoiceResponse.data.credit_amount) || 0,
          items: invoiceResponse.data.items.map((item) => ({
            ...item,
            unit_price: parseFloat(item.unit_price) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
          })),
        };
        setInvoice(parsedInvoice);

        // Fetch payment records
        const paymentResponse = await axios.get(`${API_URL}/credit-payments/${invoiceId}?type=sale`);
        setPaymentRecords(paymentResponse.data);

        setError(null);
      } catch (err) {
        console.error('Error fetching invoice details or payments:', err);
        setError('Failed to load invoice details or payment records.');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoiceDetails();
  }, [invoiceId]);

  const generatePdfBill = () => {
    if (!invoice) return;

    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(22);
    doc.text('Sales Invoice', 105, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(12);
    doc.text(`Invoice Number: ${invoice.invoice_number}`, 20, yPos);
    yPos += 7;
    doc.text(`Sale Date: ${formatDate(invoice.record_date)}`, 20, yPos);
    yPos += 7;
    doc.text(`Customer: ${invoice.customer_name || 'Walk-in Customer'}`, 20, yPos);
    yPos += 10;

    // Payment summary
    doc.setFontSize(14);
    doc.text('Payment Summary:', 20, yPos);
    yPos += 7;
    doc.setFontSize(12);
    doc.text(`Method: ${invoice.payment_type.replace(/_/g, ' ').toUpperCase()}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Bill Amount: $${formatCurrency(invoice.total_bill_amount)}`, 20, yPos);
    yPos += 7;
    doc.text(`Total Amount Paid: $${formatCurrency(invoice.amount_paid)}`, 20, yPos);
    yPos += 7;
    doc.text(`Pending Credit: $${formatCurrency(invoice.credit_amount)}`, 20, yPos);
    yPos += 7;

    if (invoice.payment_type === 'credit' || invoice.payment_type === 'cash_and_credit') {
      doc.text(`Credit Due Date: ${formatDate(invoice.credit_due_date)}`, 20, yPos);
      yPos += 7;
    }
    if (invoice.payment_type === 'bank_transfer' || (invoice.payment_type === 'cash_and_credit' && invoice.transaction_id)) {
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

      // Draw payment headers
      doc.setFontSize(10);
      paymentHeaders.forEach((header, i) => {
        doc.text(header, startX + paymentColWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      yPos += 5;
      doc.line(startX, yPos, startX + paymentColWidths.reduce((a, b) => a + b, 0), yPos);
      yPos += 5;

      // Draw payment rows
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
    doc.text('Sold Products:', 20, yPos);
    yPos += 7;

    const tableHeaders = ['Product Name', 'Barcode', 'Quantity', 'Unit Price', 'Subtotal'];
    const colWidths = [60, 40, 20, 30, 30];
    const startX = 20;

    // Draw table headers
    doc.setFontSize(10);
    tableHeaders.forEach((header, i) => {
      doc.text(header, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
    });
    yPos += 5;
    doc.line(startX, yPos, startX + colWidths.reduce((a, b) => a + b, 0), yPos);
    yPos += 5;

    // Draw table rows
    invoice.items.forEach((item) => {
      const rowData = [
        item.product_name,
        item.barcode,
        item.quantity,
        `$${formatCurrency(item.unit_price)}`,
        `$${formatCurrency(item.subtotal)}`,
      ];
      rowData.forEach((data, i) => {
        doc.text(String(data), startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      yPos += 7;
    });

    doc.save(`Sales_Invoice_${invoice.invoice_number}.pdf`);
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
          Sales Invoice Details - {invoice.invoice_number}
        </Typography>
        <Typography>
          <strong>Customer:</strong> {invoice.customer_name || 'Walk-in Customer'}
        </Typography>
        <Typography>
          <strong>Sale Date:</strong> {formatDate(invoice.record_date)}
        </Typography>
        <Typography>
          <strong>Total Bill Amount:</strong> ${formatCurrency(invoice.total_bill_amount)}
        </Typography>
        <Typography>
          <strong>Payment Method:</strong> {invoice.payment_type.replace(/_/g, ' ').toUpperCase()}
        </Typography>
        <Typography>
          <strong>Total Amount Paid:</strong> ${formatCurrency(invoice.amount_paid)}
        </Typography>
        <Typography sx={{ color: invoice.credit_amount > 0 ? 'error.main' : 'success.main' }}>
          <strong>Pending Credit:</strong> ${formatCurrency(invoice.credit_amount)}
        </Typography>

        {(invoice.payment_type === 'credit' || invoice.payment_type === 'cash_and_credit') && (
          <Typography>
            <strong>Credit Due Date:</strong> {formatDate(invoice.credit_due_date)}
          </Typography>
        )}
        {(invoice.payment_type === 'bank_transfer' || (invoice.payment_type === 'cash_and_credit' && invoice.transaction_id)) && (
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
          Items Sold:
        </Typography>
        <TableContainer component={Paper} sx={{ mt: 1 }}>
          <Table aria-label="items table">
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell align="right">Unit Price</TableCell>
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
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell align="right">${formatCurrency(item.unit_price)}</TableCell>
                    <TableCell align="right">${formatCurrency(item.subtotal)}</TableCell>
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

export default SellInvoiceDetailModal;