import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Grid,
  Box,
} from '@mui/material';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const Sell = () => {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [newSale, setNewSale] = useState({
    customer_id: '',
    payment_type: 'cash',
    amount_paid: 0,
    credit_amount: 0,
    credit_due_date: null,
    transaction_id: '',
    bank_name: '',
  });
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [openCustomerDialog, setOpenCustomerDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const API_URL = 'http://faridagri.devzytic.com/api';

  useEffect(() => {
    fetchSales();
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await axios.get(`${API_URL}/sale-invoices`);
      setSales(response.data);
    } catch (error) {
      console.error('Error fetching sales invoices:', error);
      setSnackbarMessage('Failed to fetch sales invoices');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_URL}/customers`);
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setSnackbarMessage('Failed to fetch customers');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products`);
      const productsData = response.data.map(p => ({
        ...p,
        stock: parseInt(p.stock) || 0,
        purchase_price: parseFloat(p.purchase_price) || 0,
        sell_price: parseFloat(p.sell_price) || 0,
      }));

      const updatedProducts = await Promise.all(
        productsData.map(async (product) => {
          try {
            const priceResponse = await axios.get(`${API_URL}/stock-entries/recent/${product.id}`);
            const recentPrices = priceResponse.data;
            const sellPrice = parseFloat(recentPrices.sell_price);
            const purchasePrice = parseFloat(recentPrices.purchase_price);
            return {
              ...product,
              sell_price: !isNaN(sellPrice) && sellPrice > 0 ? sellPrice : (product.sell_price > 0 ? product.sell_price : null),
              purchase_price: !isNaN(purchasePrice) && purchasePrice > 0 ? purchasePrice : product.purchase_price,
            };
          } catch (error) {
            console.error(`Error fetching recent prices for product ${product.id}:`, error.response?.data || error.message);
            return { ...product, sell_price: product.sell_price > 0 ? product.sell_price : null };
          }
        })
      );

      // Filter out products with invalid sell_price
      const validProducts = updatedProducts.filter(p => p.sell_price !== null && !isNaN(p.sell_price) && p.sell_price > 0);
      setProducts(validProducts);

      // Remove invalid products from cart
      setCart(prevCart =>
        prevCart
          .map(cartItem => {
            const updatedProduct = validProducts.find(p => p.id === cartItem.id);
            return updatedProduct ? { ...cartItem, sell_price: updatedProduct.sell_price } : null;
          })
          .filter(item => item !== null)
      );

      if (validProducts.length < updatedProducts.length) {
        setSnackbarMessage('Some products have invalid prices and were excluded.');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
      }
      console.log('Updated products:', validProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setSnackbarMessage('Failed to fetch products');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const addToCart = async (product) => {
    if (!product || !product.id) {
      setSnackbarMessage('Invalid product selected.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    let updatedProduct = { ...product };
    try {
      const priceResponse = await axios.get(`${API_URL}/stock-entries/recent/${product.id}`);
      const recentPrices = priceResponse.data;
      const sellPrice = parseFloat(recentPrices.sell_price);
      updatedProduct.sell_price = !isNaN(sellPrice) && sellPrice > 0 ? sellPrice : (product.sell_price > 0 ? product.sell_price : null);
    } catch (error) {
      console.error(`Error fetching recent price for product ${product.id}:`, error.response?.data || error.message);
      updatedProduct.sell_price = product.sell_price > 0 ? product.sell_price : null;
    }

    if (updatedProduct.sell_price === null || isNaN(updatedProduct.sell_price) || updatedProduct.sell_price <= 0) {
      setSnackbarMessage(`Cannot add "${updatedProduct.name}" due to invalid price.`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    if (updatedProduct.stock <= 0) {
      setSnackbarMessage(`Cannot add "${updatedProduct.name}". No stock available.`);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const existingProduct = cart.find((item) => item.id === updatedProduct.id);
    if (existingProduct) {
      if (existingProduct.quantity + 1 > updatedProduct.stock) {
        setSnackbarMessage(`Cannot add more "${updatedProduct.name}". Only ${updatedProduct.stock} left.`);
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return;
      }
      setCart(
        cart.map((item) =>
          item.id === updatedProduct.id ? { ...item, quantity: item.quantity + 1, sell_price: updatedProduct.sell_price } : item
        )
      );
    } else {
      setCart([...cart, { ...updatedProduct, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    const productInCart = cart.find((item) => item.id === productId);
    const originalProduct = products.find((p) => p.id === productId);

    if (!originalProduct) return;

    const parsedQuantity = parseInt(newQuantity);

    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      if (parsedQuantity <= 0 && productInCart.quantity > 1) {
        setCart(cart.map(item => item.id === productId ? { ...item, quantity: 1 } : item));
      } else {
        setCart(cart.filter(item => item.id !== productId));
      }
      return;
    }

    if (parsedQuantity > originalProduct.stock) {
      setSnackbarMessage(`Cannot add more "${originalProduct.name}". Only ${originalProduct.stock} left.`);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      setCart(cart.map(item => item.id === productId ? { ...item, quantity: originalProduct.stock } : item));
      return;
    }

    setCart(
      cart.map((item) =>
        item.id === productId ? { ...item, quantity: parsedQuantity } : item
      )
    );
  };

  const calculateTotalPrice = () => {
    const total = cart.reduce((sum, item) => {
      const price = parseFloat(item.sell_price);
      return !isNaN(price) ? sum + price * item.quantity : sum;
    }, 0);
    return isNaN(total) ? 0 : total;
  };

  const handlePaymentTypeChange = (e) => {
    const type = e.target.value;
    const totalPrice = calculateTotalPrice();
    let updatedAmountPaid = 0;
    let updatedCreditAmount = 0;
    let updatedCreditDueDate = null;

    if (type === 'cash') {
      updatedAmountPaid = totalPrice;
      updatedCreditAmount = 0;
    } else if (type === 'cash_and_credit') {
      updatedAmountPaid = 0;
      updatedCreditAmount = totalPrice;
    }

    setNewSale({
      ...newSale,
      payment_type: type,
      amount_paid: updatedAmountPaid,
      credit_amount: updatedCreditAmount,
      credit_due_date: updatedCreditDueDate,
      transaction_id: '',
      bank_name: '',
    });
  };

  const handleAmountPaidChange = (e) => {
    const inputAmount = parseFloat(e.target.value);
    const totalPrice = calculateTotalPrice();
    const amount_paid = isNaN(inputAmount) || inputAmount < 0 ? 0 : inputAmount;
    const credit_amount = Math.max(0, totalPrice - amount_paid);

    setNewSale({ ...newSale, amount_paid, credit_amount });
  };

  const handleCreditDueDateChange = (date) => {
    setNewSale({ ...newSale, credit_due_date: date });
  };

  const addCustomer = async () => {
    try {
      const response = await axios.post(`${API_URL}/customers`, newCustomer);
      const addedCustomer = response.data;
      setCustomers([...customers, addedCustomer]);
      setNewSale({ ...newSale, customer_id: addedCustomer.id });
      setOpenCustomerDialog(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setSnackbarMessage('Customer added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error adding customer:', error.response?.data || error.message);
      setSnackbarMessage('Failed to add customer');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const addSale = async () => {
    if (cart.length === 0) {
      setSnackbarMessage('Cart is empty. Add products to make a sale.');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    // Validate cart for invalid prices
    const invalidItems = cart.filter(item => item.sell_price === null || isNaN(item.sell_price) || item.sell_price <= 0);
    if (invalidItems.length > 0) {
      setSnackbarMessage(`Invalid prices for: ${invalidItems.map(item => item.name).join(', ')}. Please remove or update these items.`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const totalPrice = calculateTotalPrice();
    if (totalPrice <= 0) {
      setSnackbarMessage('Total price is invalid. Please check cart items.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    let { customer_id, payment_type, amount_paid, credit_amount, credit_due_date, transaction_id, bank_name } = newSale;

    const actualCustomerId = customer_id === '' ? null : customer_id;

    if (payment_type === 'cash') {
      amount_paid = totalPrice;
      credit_amount = 0;
      credit_due_date = null;
      transaction_id = null;
      bank_name = null;
    } else if (payment_type === 'cash_and_credit') {
      amount_paid = Math.min(amount_paid, totalPrice);
      credit_amount = totalPrice - amount_paid;
      transaction_id = null;
      bank_name = null;
      if (credit_amount > 0 && !credit_due_date) {
        setSnackbarMessage('Please provide a credit due date for outstanding credit.');
        setSnackbarSeverity('warning');
        setSnackbarOpen(true);
        return;
      } else if (credit_amount === 0) {
        credit_due_date = null;
      }
    }

    const formattedCreditDueDate = credit_due_date ? credit_due_date.toISOString().split('T')[0] : null;

    try {
      const response = await axios.post(`${API_URL}/sale-invoices`, {
        customer_id: actualCustomerId,
        products: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          sell_price: item.sell_price, // Include sell_price in payload
        })),
        total_price: totalPrice,
        payment_type: payment_type,
        amount_paid: amount_paid,
        credit_amount: credit_amount,
        credit_due_date: formattedCreditDueDate,
        transaction_id: transaction_id,
        bank_name: bank_name,
      });
      await fetchSales();
      setCart([]);
      setNewSale({
        customer_id: '',
        payment_type: 'cash',
        amount_paid: 0,
        credit_amount: 0,
        credit_due_date: null,
        transaction_id: '',
        bank_name: '',
      });
      setSnackbarMessage('Sale invoice recorded successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      await fetchProducts();
    } catch (error) {
      console.error('Error adding sale invoice:', error.response?.data || error.message);
      setSnackbarMessage(error.response?.data?.error || 'Failed to add sale invoice.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const generateBill = async () => {
    if (cart.length === 0) {
      setSnackbarMessage('Cart is empty. Add products to generate a bill.');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const invalidItems = cart.filter(item => item.sell_price === null || isNaN(item.sell_price) || item.sell_price <= 0);
    if (invalidItems.length > 0) {
      setSnackbarMessage(`Invalid prices for: ${invalidItems.map(item => item.name).join(', ')}. Please remove or update these items.`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    const customerName = customers.find((c) => c.id === newSale.customer_id)?.name || 'Walk-in Customer';
    const totalPrice = calculateTotalPrice();
    const { payment_type, amount_paid, credit_amount, credit_due_date } = newSale;

    const productsForBill = cart.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.sell_price,
    }));

    const queryParams = new URLSearchParams({
      customerName,
      products: JSON.stringify(productsForBill),
      totalPrice,
      paymentType: payment_type,
      amountPaid: amount_paid,
      creditAmount: credit_amount,
      creditDueDate: credit_due_date ? credit_due_date.toISOString().split('T')[0] : '',
    });

    window.open(`${API_URL}/generate-invoice-pdf?${queryParams.toString()}`, '_blank');
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        New Sale
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Customer</InputLabel>
            <Select
              value={newSale.customer_id}
              onChange={(e) => setNewSale({ ...newSale, customer_id: e.target.value })}
              label="Customer"
            >
              <MenuItem value=""><em>Walk-in Customer</em></MenuItem>
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
              <MenuItem onClick={() => setOpenCustomerDialog(true)}>Add New Customer</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Product</InputLabel>
            <Select
              value=""
              onChange={(e) => addToCart(products.find((p) => p.id === e.target.value))}
              label="Product"
            >
              {products.map((product) => (
                <MenuItem
                  key={product.id}
                  value={product.id}
                  disabled={product.stock <= 0 || product.sell_price === null || isNaN(product.sell_price) || product.sell_price <= 0}
                >
                  {product.name} (Stock: {product.stock}, Price: PKR{product.sell_price?.toFixed(2) || 'N/A'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6}>
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend">Payment Type</FormLabel>
            <RadioGroup
              row
              value={newSale.payment_type}
              onChange={handlePaymentTypeChange}
            >
              <FormControlLabel value="cash" control={<Radio size="small" />} label="Cash" />
              <FormControlLabel value="cash_and_credit" control={<Radio size="small" />} label="Cash and Credit" />
            </RadioGroup>
          </FormControl>

          {newSale.payment_type === 'cash_and_credit' && (
            <>
              <TextField
                label="Amount Paid (Cash portion)"
                type="number"
                fullWidth
                size="small"
                margin="normal"
                value={newSale.amount_paid}
                onChange={handleAmountPaidChange}
                inputProps={{ step: "0.01", min: "0", max: calculateTotalPrice() }}
                sx={{ mb: 2 }}
              />
              <Typography
                variant="body1"
                sx={{ mt: 1, mb: 2, color: newSale.credit_amount > 0 ? 'error.main' : 'text.secondary' }}
              >
                Credit Amount Due: PKR{newSale.credit_amount.toFixed(2)}
              </Typography>
              {newSale.credit_amount > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>Credit Due Date</Typography>
                  <DatePicker
                    selected={newSale.credit_due_date}
                    onChange={handleCreditDueDateChange}
                    dateFormat="yyyy-MM-dd"
                    customInput={<TextField fullWidth size="small" />}
                    minDate={new Date()}
                  />
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Cart
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Stock Available</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cart.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{products.find(p => p.id === item.id)?.stock || 0}</TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    size="small"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.id, e.target.value)}
                    inputProps={{ min: 1, max: products.find(p => p.id === item.id)?.stock || 0 }}
                    sx={{ width: 80 }}
                  />
                </TableCell>
                <TableCell>PKR{item.sell_price?.toFixed(2) || 'N/A'}</TableCell>
                <TableCell>PKR{(item.sell_price && !isNaN(item.sell_price) ? item.sell_price * item.quantity : 0).toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => removeFromCart(item.id)}
                    color="error"
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Total Price: PKR{calculateTotalPrice().toFixed(2)}
        </Typography>
        <Box>
          <Button
            variant="contained"
            color="secondary"
            onClick={generateBill}
            sx={{ mr: 2 }}
            disabled={cart.length === 0 || calculateTotalPrice() <= 0}
          >
            Generate Bill
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={addSale}
            disabled={cart.length === 0 || calculateTotalPrice() <= 0}
          >
            Add Sale
          </Button>
        </Box>
      </Box>

      <Dialog open={openCustomerDialog} onClose={() => setOpenCustomerDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            size="small"
            margin="normal"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
            required
          />
          <TextField
            label="Phone"
            fullWidth
            size="small"
            margin="normal"
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
          />
          <TextField
            label="Email"
            fullWidth
            size="small"
            margin="normal"
            value={newCustomer.email}
            onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
          />
          <TextField
            label="Address"
            fullWidth
            size="small"
            margin="normal"
            value={newCustomer.address}
            onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCustomerDialog(false)} size="small">Cancel</Button>
          <Button onClick={addCustomer} size="small" color="primary" disabled={!newCustomer.name}>Add</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Sell;