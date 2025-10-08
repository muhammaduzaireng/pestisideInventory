// src/components/Sidebar.js

import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // You'll create this CSS file

const menuItems = [
  { name: 'Sale', path: 'sale' },
  { name: 'Stock', path: 'stock' },
  { name: 'Vendors', path: 'vendors' },
  { name: 'Vendor Accounts', path: 'vendor-accounts' },
  { name: 'Customer Accounts', path: 'customer-accounts' },
  { name: 'Purchase Bill', path: 'purchase-bill' },
  { name: 'Sales Bill', path: 'sales-bill' },
  { name: 'Add Customer', path: 'add-customer' },
];

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3 className="logo">FZ Corp</h3>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={`/dashboard/${item.path}`}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;