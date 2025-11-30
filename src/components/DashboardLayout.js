// src/components/DashboardLayout.js

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './DashboardLayout.css'; // You'll create this CSS file

// Placeholder components for all your menu items
import SalePage from '../pages/SalePage';
import StockPage from '../pages/StockPage';
import VendorsPage from '../pages/VendorsPage';
import VendorAccountsPage from '../pages/VendorAccountsPage';
import CustomerAccountsPage from '../pages/CustomerAccountsPage';
import PurchaseBillPage from '../pages/PurchaseBillPage';
import SalesBillPage from '../pages/SalesBillPage';
import AddCustomerPage from '../pages/AddCustomerPage';
import PreviousBillsPage from '../pages/PreviousBills';


// ... import other pages as needed
// ... and so on for all others

function DashboardLayout({ onLogout }) {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="main-content">
        <Header onLogout={onLogout} />
        <div className="content-area">
          {/* Nested Routes for the Sidebar Menus */}
          <Routes>
            <Route path="/sale" element={<SalePage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendor-accounts" element={<VendorAccountsPage />} />
            <Route path="/customer-accounts" element={<CustomerAccountsPage />} />
            <Route path="/add-customer" element={<AddCustomerPage />} />
            <Route path="/purchase-bill" element={<PurchaseBillPage />} />
            <Route path="/sales-bill" element={<SalesBillPage />} />
            <Route path="/stock-purchases" element={<h2>Stock Purchases Page</h2>} />
            <Route path="/previous-bills" element={<PreviousBillsPage />} />
            {/* ... other routes for your menu items */}
            <Route path="/" element={<SalePage />} /> {/* Default content */}
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;