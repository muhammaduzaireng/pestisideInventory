// src/components/AddCustomerModal.js

import React, { useState } from 'react';

// Assuming modal-backdrop and modal-content styles are available in SaleForm.css or a global CSS file
// (We will add them to SaleForm.css below)

function AddCustomerModal({ onSave, onClose }) {
    const [formData, setFormData] = useState({
        name: '',
        contact: '', 
        address: '', 
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.contact.trim() || !formData.address.trim()) {
            alert('Please fill in all customer details.');
            return;
        }

        // Pass the new data up to the SaleForm component
        onSave(formData); 
        
        // Reset form and close modal
        setFormData({ name: '', contact: '', address: '' });
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content add-customer-modal" onClick={e => e.stopPropagation()}>
                <h3>Add New Customer</h3>
                <form className="customer-form" onSubmit={handleSubmit}>
                    
                    <div className="form-group">
                        <label htmlFor="modal-name">Customer Name:</label>
                        <input
                            type="text"
                            id="modal-name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g., Creative Stitch Co."
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="modal-contact">Phone Number:</label>
                        <input
                            type="tel"
                            id="modal-contact"
                            name="contact"
                            value={formData.contact}
                            onChange={handleChange}
                            placeholder="e.g., 03xx-xxxxxxx"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="modal-address">Address:</label>
                        <textarea
                            id="modal-address"
                            name="address"
                            rows="2"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Full mailing address"
                            required
                        ></textarea>
                    </div>
                    
                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-btn">
                            Save & Select
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddCustomerModal;