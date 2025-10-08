// src/pages/SalePage.js

import React from 'react';
import SaleForm from '../components/SaleForm';

function SalePage() {
  return (
    <div className="sale-page">
      <h1>Sale Invoice Generation</h1>
      <SaleForm />
    </div>
  );
}

export default SalePage;