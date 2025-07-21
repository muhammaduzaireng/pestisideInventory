import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import Sell from './Sell';
import Stock from './Stock';
import Products from './Products';
import Vendors from './Vendors';
import Customers from './Customers';
import SellRecords from './pages/SellRecords';
import CreditRecords from './CreditRecords';
import CustomerCreditRecords from './CustomerCreditRecords';
import AddCreditPayment from './AddCreditPayment';
import StockPurchasesPage from './pages/StockPurchasesPage';
import VendorCreditRecords from './pages/VendorCreditRecords';

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />}>
        <Route path="sell" element={<Sell />} />
        <Route path="stock" element={<Stock />} />
        <Route path="products" element={<Products />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sell-records" element={<SellRecords />} />
        <Route path="credit-records" element={<CreditRecords />} />
        <Route path="customer-credit-records" element={<CustomerCreditRecords />} />
        <Route path="add-credit-payment" element={<AddCreditPayment />} />
        <Route path="stock-purchases" element={<StockPurchasesPage />} />
        <Route path="vendor-credit-records" element={<VendorCreditRecords />} />
      </Route>
    </Routes>
  </Router>
);

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);