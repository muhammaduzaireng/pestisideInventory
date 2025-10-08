// src/components/AddProductModal.js

import React, { useState } from 'react';
import './AddProductModal.css'; // Create this CSS file next

const AddProductModal = ({ isOpen, onClose, onAddProduct, vendorName }) => {
  const [productName, setProductName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (productName.trim()) {
      onAddProduct(productName.trim());
      setProductName(''); // Clear input
      onClose();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Add New Product to {vendorName}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="productName">Product Name</label>
            <input
              id="productName"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Silk Thread - 100D"
              required
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="add-btn" disabled={!productName.trim()}>
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;