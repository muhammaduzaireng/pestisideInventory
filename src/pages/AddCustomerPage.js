// src/pages/AddCustomerPage.js (FIXED: Added default props to prevent 'not a function' error)

import React, { useState } from 'react';
import './AddCustomerPage.css'; 

const API_BASE_URL = 'https://api.faridagri.devzytic.com/api';

// ⬅️ FIX: Provide default empty functions for props. This prevents the crash 
// if the parent (CustomerAccountsPage) fails to pass them correctly.
function AddCustomerPage({ 
    onSaveSuccess = (customer) => { 
        console.warn("onSaveSuccess handler not provided. Customer created:", customer); 
        alert("Customer created successfully! (Please fix the parent component to handle navigation)");
    }, 
    onBack = () => { 
        console.warn("onBack handler not provided."); 
    } 
}) {
    const [formData, setFormData] = useState({
        name: '',
        contact: '', 
        address: '', 
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const { name, contact, address } = formData; 

        // Basic validation
        if (!name.trim() || !contact.trim() || !address.trim()) {
            setError('Please fill in all required fields (Name, Phone, Address).');
            setIsLoading(false);
            return;
        }

        const newCustomerData = { name, contact, address }; 

        try {
            const response = await fetch(`${API_BASE_URL}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustomerData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to create customer (Status: ${response.status})`);
            }

            const createdCustomer = await response.json();
            
            // ⬅️ SUCCESS: Call the provided handler (or the default one)
            onSaveSuccess(createdCustomer); 
            
        } catch (err) {
            setError(err.message);
            console.error('Customer Creation Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="add-customer-page">
            <h1>Add New Customer</h1>
            <p>Enter the master details for the new customer account.</p>

            <form className="customer-form" onSubmit={handleSubmit}>
                
                <div className="form-group">
                    <label htmlFor="name">Customer Name:</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g., Creative Stitch Co."
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="contact">Phone Number:</label>
                    <input
                        type="tel"
                        id="contact"
                        name="contact"
                        value={formData.contact}
                        onChange={handleChange}
                        placeholder="e.g., 03xx-xxxxxxx"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="address">Address:</label>
                    <textarea
                        id="address"
                        name="address"
                        rows="3"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Full mailing address for billing"
                        required
                    ></textarea>
                </div>
                
                {error && <p className="error-message" style={{color: 'red', margin: '10px 0'}}>{error}</p>}

                <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={onBack} disabled={isLoading}>
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        className="submit-btn" 
                        disabled={isLoading || !formData.name || !formData.contact || !formData.address}
                    >
                        {isLoading ? 'Saving...' : 'Save Customer'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddCustomerPage;