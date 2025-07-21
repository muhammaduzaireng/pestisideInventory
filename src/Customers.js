import React, { useState, useEffect } from 'react';
import { Container, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import axios from 'axios';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const response = await axios.get('https://faridagri.devzytic.com/api/customers');
    setCustomers(response.data);
  };

  const addCustomer = async () => {
    const response = await axios.post('https://faridagri.devzytic.com/api/customers', newCustomer);
    setCustomers([...customers, response.data]);
    setNewCustomer({ name: '', phone: '', email: '', address: '' });
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>
        Customers
      </Typography>
      <TextField
        label="Name"
        fullWidth
        margin="normal"
        value={newCustomer.name}
        onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
      />
      <TextField
        label="Phone"
        fullWidth
        margin="normal"
        value={newCustomer.phone}
        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
      />
      <TextField
        label="Email"
        fullWidth
        margin="normal"
        value={newCustomer.email}
        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
      />
      <TextField
        label="Address"
        fullWidth
        margin="normal"
        value={newCustomer.address}
        onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
      />
      <Button variant="contained" color="primary" onClick={addCustomer}>
        Add Customer
      </Button>
      <TableContainer component={Paper} style={{ marginTop: '20px' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.address}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Customers;