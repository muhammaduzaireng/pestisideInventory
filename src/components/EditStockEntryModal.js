import React, { useState, useEffect } from 'react';
import { stockPurchases, products } from '../services/api';
import { TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

const EditStockEntryModal = ({ invoiceId, onClose, onSuccess }) => {
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editData, setEditData] = useState({}); // { stockEntryId: { purchase_price, sell_price, expiry_date } }

  useEffect(() => {
    const fetchStockEntries = async () => {
      setLoading(true);
      try {
        const response = await stockPurchases.getPurchaseById(invoiceId);
        console.log('API response for invoiceId', invoiceId, ':', response.data);
        const entries = response.data.items || []; // Changed from stock_entries to items
        setStockEntries(entries);
        const initialEditData = entries.reduce((acc, entry) => ({
          ...acc,
          [entry.id]: {
            purchase_price: entry.purchase_price || '',
            sell_price: entry.sell_price || '',
            expiry_date: entry.expiry_date ? new Date(entry.expiry_date).toISOString().split('T')[0] : '',
          },
        }), {});
        setEditData(initialEditData);
        setError(null);
      } catch (err) {
        console.error('Error fetching stock entries:', err);
        setError('Failed to load stock entries: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchStockEntries();
  }, [invoiceId]);

  const handleInputChange = (stockEntryId, field, value) => {
    setEditData((prev) => ({
      ...prev,
      [stockEntryId]: { ...prev[stockEntryId], [field]: value },
    }));
  };

  const handleSave = async (stockEntryId) => {
    const data = editData[stockEntryId];
    if (!data.purchase_price || !data.sell_price || isNaN(parseFloat(data.purchase_price)) || isNaN(parseFloat(data.sell_price)) || parseFloat(data.purchase_price) < 0 || parseFloat(data.sell_price) < 0) {
      setError('Please enter valid purchase and sell prices.');
      return;
    }
    try {
      const payload = {
        purchase_price: parseFloat(data.purchase_price),
        sell_price: parseFloat(data.sell_price),
        expiry_date: data.expiry_date || null,
      };
      await stockPurchases.updateStockEntry(stockEntryId, payload);
      setStockEntries((prev) =>
        prev.map((entry) =>
          entry.id === stockEntryId
            ? { ...entry, purchase_price: payload.purchase_price, sell_price: payload.sell_price, expiry_date: payload.expiry_date }
            : entry
        )
      );
      setError(null);
      onSuccess();
    } catch (err) {
      console.error('Error updating stock entry:', err);
      setError('Failed to update stock entry: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div>Loading stock entries...</div>;
  if (error) return <Typography color="error">{error}</Typography>;
  if (stockEntries.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        <Typography variant="h6" gutterBottom>
          Edit Stock Entries for Invoice #{invoiceId}
        </Typography>
        <Typography>No stock entries found for this invoice.</Typography>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onClose}
          style={{ marginTop: '20px' }}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="h6" gutterBottom>
        Edit Stock Entries for Invoice #{stockEntries[0]?.stock_purchase_invoice_id || invoiceId}
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Added Stock</TableCell>
              <TableCell>Purchase Price</TableCell>
              <TableCell>Sell Price</TableCell>
              <TableCell>Expiry Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stockEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{entry.product_name}</TableCell>
                <TableCell>{entry.added_stock}</TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={editData[entry.id]?.purchase_price || ''}
                    onChange={(e) => handleInputChange(entry.id, 'purchase_price', e.target.value)}
                    inputProps={{ min: 0, step: '0.01' }}
                    size="small"
                    style={{ width: '100px' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={editData[entry.id]?.sell_price || ''}
                    onChange={(e) => handleInputChange(entry.id, 'sell_price', e.target.value)}
                    inputProps={{ min: 0, step: '0.01' }}
                    size="small"
                    style={{ width: '100px' }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="date"
                    value={editData[entry.id]?.expiry_date || ''}
                    onChange={(e) => handleInputChange(entry.id, 'expiry_date', e.target.value)}
                    size="small"
                    style={{ width: '150px' }}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => handleSave(entry.id)}
                    disabled={
                      !editData[entry.id]?.purchase_price ||
                      !editData[entry.id]?.sell_price ||
                      editData[entry.id]?.purchase_price === (entry.purchase_price || '') &&
                      editData[entry.id]?.sell_price === (entry.sell_price || '') &&
                      editData[entry.id]?.expiry_date === (entry.expiry_date ? new Date(entry.expiry_date).toISOString().split('T')[0] : '')
                    }
                  >
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        variant="outlined"
        color="secondary"
        onClick={onClose}
        style={{ marginTop: '20px' }}
      >
        Close
      </Button>
    </div>
  );
};

export default EditStockEntryModal;