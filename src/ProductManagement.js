import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, FormControl, InputLabel, Select, MenuItem } from '@mui/material';

const ProductManagement = () => {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', barcode: '', purchase_price: 0, sell_price: 0, stock: 0, vendor_id: '' });

  useEffect(() => {
    fetchProducts();
    fetchVendors();
  }, []);

  const fetchProducts = async () => {
    const response = await axios.get('https://faridagri.devzytic.com/api/products');
    setProducts(response.data);
  };

  const fetchVendors = async () => {
    const response = await axios.get('https://faridagri.devzytic.com/api/vendors');
    setVendors(response.data);
  };

  const addProduct = async () => {
    const response = await axios.post('https://faridagri.devzytic.com/api/products', newProduct);
    setProducts([...products, response.data]);
    setNewProduct({ name: '', barcode: '', purchase_price: 0, sell_price: 0, stock: 0, vendor_id: '' });
  };

  return (
    <Container>
      <Typography variant="h3" gutterBottom>
        Product Management
      </Typography>
      <TextField
        label="Name"
        fullWidth
        margin="normal"
        value={newProduct.name}
        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
      />
      <TextField
        label="Barcode"
        fullWidth
        margin="normal"
        value={newProduct.barcode}
        onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
      />
      <TextField
        label="Purchase Price"
        fullWidth
        margin="normal"
        type="number"
        value={newProduct.purchase_price}
        onChange={(e) => setNewProduct({ ...newProduct, purchase_price: parseFloat(e.target.value) })}
      />
      <TextField
        label="Sell Price"
        fullWidth
        margin="normal"
        type="number"
        value={newProduct.sell_price}
        onChange={(e) => setNewProduct({ ...newProduct, sell_price: parseFloat(e.target.value) })}
      />
      <TextField
        label="Stock"
        fullWidth
        margin="normal"
        type="number"
        value={newProduct.stock}
        onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
      />
      <FormControl fullWidth margin="normal">
        <InputLabel>Vendor</InputLabel>
        <Select
          value={newProduct.vendor_id}
          onChange={(e) => setNewProduct({ ...newProduct, vendor_id: e.target.value })}
        >
          {vendors.map((vendor) => (
            <MenuItem key={vendor.id} value={vendor.id}>
              {vendor.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button variant="contained" color="primary" onClick={addProduct}>
        Add Product
      </Button>
      <TableContainer component={Paper} style={{ marginTop: '20px' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Barcode</TableCell>
              <TableCell>Purchase Price</TableCell>
              <TableCell>Sell Price</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Vendor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.barcode}</TableCell>
                <TableCell>PKR{product.purchase_price}</TableCell>
                <TableCell>PKR{product.sell_price}</TableCell>
                <TableCell>{product.stock}</TableCell>
                <TableCell>{vendors.find((v) => v.id === product.vendor_id)?.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default ProductManagement;