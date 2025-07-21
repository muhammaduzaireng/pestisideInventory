import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [newVendor, setNewVendor] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    const response = await axios.get('https://faridagri.devzytic.com/api/vendors');
    setVendors(response.data);
  };

  const addVendor = async () => {
    const response = await axios.post('https://faridagri.devzytic.com/api/vendors', newVendor);
    setVendors([...vendors, response.data]);
    setNewVendor({ name: '', contact_person: '', phone: '', email: '', address: '' });
  };

  return (
    <Container>
      <Typography variant="h3" gutterBottom>
        Vendor Management
      </Typography>
      <TextField
        label="Name"
        fullWidth
        margin="normal"
        value={newVendor.name}
        onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
      />
      <TextField
        label="Contact Person"
        fullWidth
        margin="normal"
        value={newVendor.contact_person}
        onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
      />
      <TextField
        label="Phone"
        fullWidth
        margin="normal"
        value={newVendor.phone}
        onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
      />
      <TextField
        label="Email"
        fullWidth
        margin="normal"
        value={newVendor.email}
        onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
      />
      <TextField
        label="Address"
        fullWidth
        margin="normal"
        value={newVendor.address}
        onChange={(e) => setNewVendor({ ...newVendor, address: e.target.value })}
      />
      <Button variant="contained" color="primary" onClick={addVendor}>
        Add Vendor
      </Button>
      <TableContainer component={Paper} style={{ marginTop: '20px' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact Person</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>{vendor.name}</TableCell>
                <TableCell>{vendor.contact_person}</TableCell>
                <TableCell>{vendor.phone}</TableCell>
                <TableCell>{vendor.email}</TableCell>
                <TableCell>{vendor.address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default VendorManagement;