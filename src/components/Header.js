// src/components/Header.js

import React from 'react';
import './Header.css'; // You'll create this CSS file

function Header({ onLogout }) {
  return (
    <header className="header">
      <div className="header-title">Dashboard Overview</div>
      <button className="logout-button" onClick={onLogout}>
        Logout
      </button>
    </header>
  );
}

export default Header;