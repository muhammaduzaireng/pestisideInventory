// import React, { useState, useEffect } from 'react';
// import {
//   Container,
//   Typography,
//   TextField,
//   Button,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   Paper,
//   MenuItem,
//   Select,
//   FormControl,
//   InputLabel,
//   Grid,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   Snackbar,
//   Alert,
// } from '@mui/material';
// import axios from 'axios';

// const Products = () => {
//   const [products, setProducts] = useState([]);
//   const [vendors, setVendors] = useState([]);
//   const [newProduct, setNewProduct] = useState({
//     name: '',
//     barcode: '',
//     purchase_price: '',
//     sell_price: '',
//   });
//   const [editProduct, setEditProduct] = useState(null);
//   const [selectedVendor, setSelectedVendor] = useState('');
//   const [openDialog, setOpenDialog] = useState(false);
//   const [snackbarOpen, setSnackbarOpen] = useState(false);
//   const [snackbarMessage, setSnackbarMessage] = useState('');
//   const [snackbarSeverity, setSnackbarSeverity] = useState('success');

//   const API_URL = 'https://faridagri.devzytic.com/api';

//   useEffect(() => {
//     fetchProducts();
//     fetchVendors();
//   }, []);

//   const fetchProducts = async () => {
//     try {
//       console.log('Fetching products from:', `${API_URL}/products`);
//       const response = await axios.get(`${API_URL}/products`);
//       setProducts(
//         response.data.map((p) => ({
//           ...p,
//           purchase_price: parseFloat(p.purchase_price) || 0,
//           sell_price: parseFloat(p.sell_price) || 0,
//         }))
//       );
//     } catch (error) {
//       console.error('Error fetching products:', error);
//       setSnackbarMessage('Error fetching products: ' + (error.response?.data?.error || error.message));
//       setSnackbarSeverity('error');
//       setSnackbarOpen(true);
//     }
//   };

//   const fetchVendors = async () => {
//     try {
//       console.log('Fetching vendors from:', `${API_URL}/vendors`);
//       const response = await axios.get(`${API_URL}/vendors`);
//       setVendors(response.data);
//     } catch (error) {
//       console.error('Error fetching vendors:', error);
//       setSnackbarMessage('Error fetching vendors: ' + (error.response?.data?.error || error.message));
//       setSnackbarSeverity('error');
//       setSnackbarOpen(true);
//     }
//   };

//   const validatePrice = (price) => {
//     const parsed = parseFloat(price);
//     return !isNaN(parsed) && parsed > 0;
//   };

//   const addProduct = async () => {
//     if (!newProduct.name || !newProduct.barcode) {
//       setSnackbarMessage('Please provide both name and barcode.');
//       setSnackbarSeverity('warning');
//       setSnackbarOpen(true);
//       return;
//     }
//     if (!validatePrice(newProduct.purchase_price) || !validatePrice(newProduct.sell_price)) {
//       setSnackbarMessage('Please provide valid purchase and sell prices (greater than 0).');
//       setSnackbarSeverity('warning');
//       setSnackbarOpen(true);
//       return;
//     }

//     const payload = {
//       name: newProduct.name,
//       barcode: newProduct.barcode,
//       vendor_id: selectedVendor || null,
//       purchase_price: parseFloat(newProduct.purchase_price),
//       sell_price: parseFloat(newProduct.sell_price),
//     };
//     console.log('Adding product:', payload);

//     try {
//       const response = await axios.post(`${API_URL}/products`, payload);
//       console.log('Add product response:', response.data);
//       setProducts([...products, {
//         ...response.data,
//         purchase_price: parseFloat(response.data.purchase_price) || 0,
//         sell_price: parseFloat(response.data.sell_price) || 0,
//       }]);
//       setNewProduct({ name: '', barcode: '', purchase_price: '', sell_price: '' });
//       setSelectedVendor('');
//       setSnackbarMessage('Product added successfully');
//       setSnackbarSeverity('success');
//       setSnackbarOpen(true);
//     } catch (error) {
//       console.error('Error adding product:', error, error.response?.data);
//       setSnackbarMessage('Error adding product: ' + (error.response?.data?.error || error.message));
//       setSnackbarSeverity('error');
//       setSnackbarOpen(true);
//     }
//   };

//   const updateProduct = async () => {
//     if (!editProduct.name || !editProduct.barcode) {
//       setSnackbarMessage('Please provide both name and barcode.');
//       setSnackbarSeverity('warning');
//       setSnackbarOpen(true);
//       return;
//     }
//     if (!validatePrice(editProduct.purchase_price) || !validatePrice(editProduct.sell_price)) {
//       setSnackbarMessage('Please provide valid purchase and sell prices (greater than 0).');
//       setSnackbarSeverity('warning');
//       setSnackbarOpen(true);
//       return;
//     }

//     const payload = {
//       name: editProduct.name,
//       barcode: editProduct.barcode,
//       vendor_id: editProduct.vendor_id || null,
//       purchase_price: parseFloat(editProduct.purchase_price),
//       sell_price: parseFloat(editProduct.sell_price),
//     };
//     console.log('Updating product:', editProduct.id, payload);

//     try {
//       const response = await axios.put(`${API_URL}/products/${editProduct.id}/prices`, payload);
//       console.log('Update product response:', response.data);
//       setProducts(
//         products.map((p) =>
//           p.id === editProduct.id
//             ? {
//                 ...p, // Keep existing fields
//                 name: payload.name,
//                 barcode: payload.barcode,
//                 vendor_id: payload.vendor_id,
//                 vendorName: vendors.find(v => v.id === payload.vendor_id)?.name || 'None',
//                 purchase_price: parseFloat(payload.purchase_price) || 0,
//                 sell_price: parseFloat(payload.sell_price) || 0,
//               }
//             : p
//         )
//       );
//       setEditProduct(null);
//       setOpenDialog(false);
//       setSnackbarMessage(`Product ${editProduct.name} updated successfully`);
//       setSnackbarSeverity('success');
//       setSnackbarOpen(true);
//     } catch (error) {
//       console.error('Error updating product:', error, error.response?.data);
//       setSnackbarMessage(
//         `Error updating product ID ${editProduct.id}: ` +
//         (error.response?.data?.error || error.message)
//       );
//       setSnackbarSeverity('error');
//       setSnackbarOpen(true);
//     }
//   };

//   const handleEditClick = (product) => {
//     setEditProduct({
//       id: product.id,
//       name: product.name,
//       barcode: product.barcode,
//       vendor_id: product.vendor_id || '',
//       purchase_price: product.purchase_price || '',
//       sell_price: product.sell_price || '',
//     });
//     setOpenDialog(true);
//   };

//   const handleDialogClose = () => {
//     setEditProduct(null);
//     setOpenDialog(false);
//   };

//   const handleSnackbarClose = (event, reason) => {
//     if (reason === 'clickaway') return;
//     setSnackbarOpen(false);
//   };

//   return (
//     <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
//       <Typography variant="h4" component="h1" gutterBottom align="center">
//         Manage Products
//       </Typography>

//       <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
//         <Typography variant="h5" gutterBottom>
//           Add New Product
//         </Typography>
//         <Grid container spacing={2} alignItems="center">
//           <Grid item xs={12} sm={6}>
//             <TextField
//               label="Product Name"
//               fullWidth
//               value={newProduct.name}
//               onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
//               required
//               variant="outlined"
//             />
//           </Grid>
//           <Grid item xs={12} sm={6}>
//             <TextField
//               label="Barcode"
//               fullWidth
//               value={newProduct.barcode}
//               onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
//               required
//               variant="outlined"
//             />
//           </Grid>
//           <Grid item xs={12} sm={6}>
//             <TextField
//               label="Purchase Price"
//               type="number"
//               fullWidth
//               value={newProduct.purchase_price}
//               onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
//               required
//               variant="outlined"
//               inputProps={{ step: '0.01', min: '0' }}
//             />
//           </Grid>
//           <Grid item xs={12} sm={6}>
//             <TextField
//               label="Sell Price"
//               type="number"
//               fullWidth
//               value={newProduct.sell_price}
//               onChange={(e) => setNewProduct({ ...newProduct, sell_price: e.target.value })}
//               required
//               variant="outlined"
//               inputProps={{ step: '0.01', min: '0' }}
//             />
//           </Grid>
//           <Grid item xs={12}>
//             <FormControl fullWidth variant="outlined">
//               <InputLabel>Vendor</InputLabel>
//               <Select
//                 value={selectedVendor}
//                 onChange={(e) => setSelectedVendor(e.target.value)}
//                 label="Vendor"
//                 displayEmpty
//               >
//                 <MenuItem value=""><em>None</em></MenuItem>
//                 {vendors.map((vendor) => (
//                   <MenuItem key={vendor.id} value={vendor.id}>
//                     {vendor.name}
//                   </MenuItem>
//                 ))}
//               </Select>
//             </FormControl>
//           </Grid>
//           <Grid item xs={12}>
//             <Button
//               variant="contained"
//               color="primary"
//               onClick={addProduct}
//               fullWidth
//               size="large"
//             >
//               Add Product
//             </Button>
//           </Grid>
//         </Grid>
//       </Paper>

//       <Typography variant="h5" component="h2" gutterBottom>
//         Existing Products
//       </Typography>
//       <TableContainer component={Paper} elevation={3}>
//         <Table aria-label="products table">
//           <TableHead>
//             <TableRow sx={{ backgroundColor: 'primary.main' }}>
//               <TableCell sx={{ color: 'white' }}>Name</TableCell>
//               <TableCell sx={{ color: 'white' }}>Barcode</TableCell>
//               <TableCell sx={{ color: 'white' }}>Vendor</TableCell>
//               <TableCell sx={{ color: 'white' }}>Purchase Price</TableCell>
//               <TableCell sx={{ color: 'white' }}>Sell Price</TableCell>
//               <TableCell sx={{ color: 'white' }}>Actions</TableCell>
//             </TableRow>
//           </TableHead>
//           <TableBody>
//             {products.length > 0 ? (
//               products.map((product) => (
//                 <TableRow key={product.id}>
//                   <TableCell>{product.name}</TableCell>
//                   <TableCell>{product.barcode}</TableCell>
//                   <TableCell>{product.vendorName || 'None'}</TableCell>
//                   <TableCell>PKR {product.purchase_price.toFixed(2)}</TableCell>
//                   <TableCell>PKR {product.sell_price.toFixed(2)}</TableCell>
//                   <TableCell>
//                     <Button
//                       variant="contained"
//                       color="info"
//                       size="small"
//                       onClick={() => handleEditClick(product)}
//                     >
//                       Edit
//                     </Button>
//                   </TableCell>
//                 </TableRow>
//               ))
//             ) : (
//               <TableRow>
//                 <TableCell colSpan={6} align="center">
//                   No products found. Add a new product!
//                 </TableCell>
//               </TableRow>
//             )}
//           </TableBody>
//         </Table>
//       </TableContainer>

//       <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="xs" fullWidth>
//         <DialogTitle>Edit Product</DialogTitle>
//         <DialogContent>
//           <TextField
//             label="Product Name"
//             fullWidth
//             value={editProduct?.name || ''}
//             onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
//             required
//             variant="outlined"
//             margin="normal"
//           />
//           <TextField
//             label="Barcode"
//             fullWidth
//             value={editProduct?.barcode || ''}
//             onChange={(e) => setEditProduct({ ...editProduct, barcode: e.target.value })}
//             required
//             variant="outlined"
//             margin="normal"
//           />
//           <TextField
//             label="Purchase Price"
//             type="number"
//             fullWidth
//             value={editProduct?.purchase_price || ''}
//             onChange={(e) => setEditProduct({ ...editProduct, purchase_price: e.target.value })}
//             required
//             variant="outlined"
//             margin="normal"
//             inputProps={{ step: '0.01', min: '0' }}
//           />
//           <TextField
//             label="Sell Price"
//             type="number"
//             fullWidth
//             value={editProduct?.sell_price || ''}
//             onChange={(e) => setEditProduct({ ...editProduct, sell_price: e.target.value })}
//             required
//             variant="outlined"
//             margin="normal"
//             inputProps={{ step: '0.01', min: '0' }}
//           />
//           <FormControl fullWidth variant="outlined" margin="normal">
//             <InputLabel>Vendor</InputLabel>
//             <Select
//               value={editProduct?.vendor_id || ''}
//               onChange={(e) => setEditProduct({ ...editProduct, vendor_id: e.target.value })}
//               label="Vendor"
//               displayEmpty
//             >
//               <MenuItem value=""><em>None</em></MenuItem>
//               {vendors.map((vendor) => (
//                 <MenuItem key={vendor.id} value={vendor.id}>
//                   {vendor.name}
//                 </MenuItem>
//               ))}
//             </Select>
//           </FormControl>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={handleDialogClose} size="small">
//             Cancel
//           </Button>
//           <Button onClick={updateProduct} size="small" color="primary">
//             Save
//           </Button>
//         </DialogActions>
//       </Dialog>

//       <Snackbar
//         open={snackbarOpen}
//         autoHideDuration={6000}
//         onClose={handleSnackbarClose}
//         anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
//       >
//         <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
//           {snackbarMessage}
//         </Alert>
//       </Snackbar>
//     </Container>
//   );
// };

// export default Products;

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
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import axios from 'axios';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    barcode: '',
    purchase_price: '',
    sell_price: '',
  });
  const [editProduct, setEditProduct] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const API_URL = 'https://faridagri.devzytic.com/api';

  useEffect(() => {
    fetchProducts();
    fetchVendors();
  }, []);

  const fetchProducts = async () => {
    try {
      console.log('Fetching products from:', `${API_URL}/products`);
      const response = await axios.get(`${API_URL}/products`);
      setProducts(
        response.data.map((p) => ({
          ...p,
          name: p.name || p.title || 'Unknown Product',
          purchase_price: p.purchase_price ? parseFloat(p.purchase_price) : null,
          sell_price: p.sell_price ? parseFloat(p.sell_price) : null,
          vendorName: p.vendorName || p.vendor_name || 'None',
        }))
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      setSnackbarMessage('Error fetching products: ' + (error.response?.data?.error || error.message));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const fetchVendors = async () => {
    try {
      console.log('Fetching vendors from:', `${API_URL}/vendors`);
      const response = await axios.get(`${API_URL}/vendors`);
      setVendors(response.data);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setSnackbarMessage('Error fetching vendors: ' + (error.response?.data?.error || error.message));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.barcode) {
      setSnackbarMessage('Please provide both name and barcode.');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      name: newProduct.name,
      barcode: newProduct.barcode,
      vendor_id: selectedVendor || null,
      purchase_price: newProduct.purchase_price ? parseFloat(newProduct.purchase_price) : null,
      sell_price: newProduct.sell_price ? parseFloat(newProduct.sell_price) : null,
    };
    console.log('Adding product:', payload);

    try {
      const response = await axios.post(`${API_URL}/products`, payload);
      console.log('Add product response:', response.data);
      setProducts([...products, {
        ...response.data,
        name: response.data.name || response.data.title || 'Unknown Product',
        purchase_price: response.data.purchase_price ? parseFloat(response.data.purchase_price) : null,
        sell_price: response.data.sell_price ? parseFloat(response.data.sell_price) : null,
        vendorName: vendors.find(v => v.id === payload.vendor_id)?.name || 'None',
      }]);
      setNewProduct({ name: '', barcode: '', purchase_price: '', sell_price: '' });
      setSelectedVendor('');
      setSnackbarMessage('Product added successfully');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error adding product:', error, error.response?.data);
      setSnackbarMessage('Error adding product: ' + (error.response?.data?.error || error.message));
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const updateProduct = async () => {
    if (!editProduct.name || !editProduct.barcode) {
      setSnackbarMessage('Please provide both name and barcode.');
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }

    const payload = {
      name: editProduct.name,
      barcode: editProduct.barcode,
      vendor_id: editProduct.vendor_id || null,
      purchase_price: editProduct.purchase_price ? parseFloat(editProduct.purchase_price) : null,
      sell_price: editProduct.sell_price ? parseFloat(editProduct.sell_price) : null,
    };
    console.log('Updating product:', editProduct.id, payload);

    try {
      const response = await axios.put(`${API_URL}/products/${editProduct.id}/prices`, payload);
      console.log('Update product response:', response.data);
      setProducts(
        products.map((p) =>
          p.id === editProduct.id
            ? {
                ...p,
                name: payload.name,
                barcode: payload.barcode,
                vendor_id: payload.vendor_id,
                vendorName: vendors.find(v => v.id === payload.vendor_id)?.name || 'None',
                purchase_price: payload.purchase_price ? parseFloat(payload.purchase_price) : null,
                sell_price: payload.sell_price ? parseFloat(payload.sell_price) : null,
              }
            : p
        )
      );
      setEditProduct(null);
      setOpenDialog(false);
      setSnackbarMessage(`Product ${editProduct.name} updated successfully`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error updating product:', error, error.response?.data);
      setSnackbarMessage(
        `Error updating product ID ${editProduct.id}: ` +
        (error.response?.data?.error || error.message)
      );
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleEditClick = (product) => {
    setEditProduct({
      id: product.id,
      name: product.name,
      barcode: product.barcode,
      vendor_id: product.vendor_id || '',
      purchase_price: product.purchase_price || '',
      sell_price: product.sell_price || '',
    });
    setOpenDialog(true);
  };

  const handleDialogClose = () => {
    setEditProduct(null);
    setOpenDialog(false);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Manage Products
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Add New Product
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              label="Product Name"
              fullWidth
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Barcode"
              fullWidth
              value={newProduct.barcode}
              onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
              required
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Purchase Price"
              type="number"
              fullWidth
              value={newProduct.purchase_price}
              onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
              variant="outlined"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sell Price"
              type="number"
              fullWidth
              value={newProduct.sell_price}
              onChange={(e) => setNewProduct({ ...newProduct, sell_price: e.target.value })}
              variant="outlined"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Vendor</InputLabel>
              <Select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                label="Vendor"
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
              fullWidth
              size="large"
            >
              Add Product
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="h5" component="h2" gutterBottom>
        Existing Products
      </Typography>
      <TableContainer component={Paper} elevation={3}>
        <Table aria-label="products table">
          <TableHead>
            <TableRow sx={{ backgroundColor: 'primary.main' }}>
              <TableCell sx={{ color: 'white' }}>Name</TableCell>
              <TableCell sx={{ color: 'white' }}>Barcode</TableCell>
              <TableCell sx={{ color: 'white' }}>Vendor</TableCell>
              <TableCell sx={{ color: 'white' }}>Purchase Price</TableCell>
              <TableCell sx={{ color: 'white' }}>Sell Price</TableCell>
              <TableCell sx={{ color: 'white' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.length > 0 ? (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.barcode}</TableCell>
                  <TableCell>{product.vendorName}</TableCell>
                  <TableCell>{product.purchase_price ? `PKR ${product.purchase_price.toFixed(2)}` : 'N/A'}</TableCell>
                  <TableCell>{product.sell_price ? `PKR ${product.sell_price.toFixed(2)}` : 'N/A'}</TableCell>
                  <TableCell>
                    <Button
                      variant="contained"
                      color="info"
                      size="small"
                      onClick={() => handleEditClick(product)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No products found. Add a new product!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Product</DialogTitle>
        <DialogContent>
          <TextField
            label="Product Name"
            fullWidth
            value={editProduct?.name || ''}
            onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
            required
            variant="outlined"
            margin="normal"
          />
          <TextField
            label="Barcode"
            fullWidth
            value={editProduct?.barcode || ''}
            onChange={(e) => setEditProduct({ ...editProduct, barcode: e.target.value })}
            required
            variant="outlined"
            margin="normal"
          />
          <TextField
            label="Purchase Price"
            type="number"
            fullWidth
            value={editProduct?.purchase_price || ''}
            onChange={(e) => setEditProduct({ ...editProduct, purchase_price: e.target.value })}
            variant="outlined"
            margin="normal"
            inputProps={{ step: '0.01', min: '0' }}
          />
          <TextField
            label="Sell Price"
            type="number"
            fullWidth
            value={editProduct?.sell_price || ''}
            onChange={(e) => setEditProduct({ ...editProduct, sell_price: e.target.value })}
            variant="outlined"
            margin="normal"
            inputProps={{ step: '0.01', min: '0' }}
          />
          <FormControl fullWidth variant="outlined" margin="normal">
            <InputLabel>Vendor</InputLabel>
            <Select
              value={editProduct?.vendor_id || ''}
              onChange={(e) => setEditProduct({ ...editProduct, vendor_id: e.target.value })}
              label="Vendor"
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
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} size="small">
            Cancel
          </Button>
          <Button onClick={updateProduct} size="small" color="primary">
            Save
          </Button>
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

export default Products;