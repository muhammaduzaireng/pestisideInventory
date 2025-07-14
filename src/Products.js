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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid // Import Grid for layout
} from '@mui/material';
import axios from 'axios';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '' });
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchVendors();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error fetching products: ' + (error.response?.data?.error || error.message));
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/vendors');
      setVendors(response.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      alert('Error fetching vendors: ' + (error.response?.data?.error || error.message));
    }
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.barcode) {
      alert('Please provide both name and barcode.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:5001/api/products', {
        name: newProduct.name,
        barcode: newProduct.barcode,
        vendor_id: selectedVendor || null,
      });
      setProducts([...products, response.data]);
      setNewProduct({ name: '', barcode: '' });
      setSelectedVendor('');
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}> {/* Added maxWidth and margin top/bottom */}
      <Typography variant="h4" component="h1" gutterBottom align="center"> {/* Added component and align */}
        Manage Products
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}> {/* Added Paper for grouping form, padding, and margin bottom */}
        <Typography variant="h5" gutterBottom>
          Add New Product
        </Typography>
        <Grid container spacing={2} alignItems="center"> {/* Used Grid for layout */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Product Name"
              fullWidth
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              required
              variant="outlined" // Added outlined variant
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Barcode"
              fullWidth
              value={newProduct.barcode}
              onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
              required
              variant="outlined" // Added outlined variant
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined"> {/* Added outlined variant */}
              <InputLabel>Vendor</InputLabel>
              <Select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                label="Vendor" // Important for outlined select
                displayEmpty
              >
                <MenuItem value=""><em>None</em></MenuItem>
                {vendors.map((vendor) => (
                  <MenuItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={addProduct}
              fullWidth // Make button full width
              size="large" // Make button larger
            >
              Add Product
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        Existing Products
      </Typography>
      <TableContainer component={Paper} elevation={3}> {/* Added elevation */}
        <Table aria-label="products table">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}> {/* Added background color to header */}
              <TableCell sx={{ color: 'white' }}>Name</TableCell> {/* Changed text color to white */}
              <TableCell sx={{ color: 'white' }}>Barcode</TableCell>
              <TableCell sx={{ color: 'white' }}>Vendor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length > 0 ? (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.barcode}</TableCell>
                  <TableCell>{product.vendorName || 'None'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} align="center">No products found. Add a new product!</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Products;