import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './VendorsPage.css'; // Reuse existing CSS

// --- API Configuration ---
const API_BASE_URL = 'https://api.faridagri.devzytic.com/api';

// --- Local Modal Component for Adding Products ---
const LocalAddProductModal = ({ isOpen, onClose, onAddProduct, vendorName }) => {
    const [productData, setProductData] = useState({
        name: '',
        stock: 0,
        defaultPrice: 0,
        unit: 'Unit',
    });

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            setProductData({ name: '', stock: 0, defaultPrice: 0, unit: 'Unit' });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (productData.name.trim() && productData.stock >= 0 && productData.defaultPrice >= 0) {
            onAddProduct(productData);
            onClose();
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProductData(prev => ({
            ...prev,
            [name]: name === 'stock' || name === 'defaultPrice' ? parseFloat(value) || 0 : value,
        }));
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content collection-modal" onClick={e => e.stopPropagation()}>
                <h3>Add Product for {vendorName}</h3>
                <p>Enter the details of the product supplied by this vendor.</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="productNameInput">Product Name:</label>
                        <input
                            id="productNameInput"
                            name="name"
                            type="text"
                            value={productData.name}
                            onChange={handleInputChange}
                            placeholder="e.g., Silk Yarn (120D)"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="productStockInput">Stock:</label>
                        <input
                            id="productStockInput"
                            name="stock"
                            type="number"
                            min="0"
                            value={productData.stock}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="productPriceInput">Default Price (PKR):</label>
                        <input
                            id="productPriceInput"
                            name="defaultPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={productData.defaultPrice}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="productUnitInput">Unit:</label>
                        <input
                            id="productUnitInput"
                            name="unit"
                            type="text"
                            value={productData.unit}
                            onChange={handleInputChange}
                            placeholder="e.g., Unit, Yard, Piece"
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={!productData.name.trim() || productData.stock < 0 || productData.defaultPrice < 0}
                        >
                            Add Product
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function VendorsPage() {
    // State for API-driven vendor data
    const [vendors, setVendors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [selectedVendorId, setSelectedVendorId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Vendor Form States
    const [newVendor, setNewVendor] = useState({
        name: '',
        contact: '',
        address: '',
        products: [], // Array of product objects: { name, stock, defaultPrice, unit }
    });

    // --- API FETCH LOGIC ---
    const fetchVendors = useCallback(async (selectNewId = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/vendors`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Map the fetched data: use vendor_id as 'id'
            const apiVendors = data.map(v => ({
                ...v,
                id: v.vendor_id,
            }));

            setVendors(apiVendors);

            // Handle selection: select new vendor, keep current selection, or select first item
            let idToSelect = selectNewId || selectedVendorId;
            if (apiVendors.length > 0 && !apiVendors.some(v => v.id === idToSelect)) {
                idToSelect = apiVendors[0].id;
            } else if (apiVendors.length === 0) {
                idToSelect = null;
            }

            setSelectedVendorId(idToSelect);
        } catch (err) {
            console.error('Failed to fetch vendors from API:', err);
            setError('Could not connect to the backend server or API failed.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedVendorId]);

    // Initial fetch on component mount
    useEffect(() => {
        fetchVendors();
    }, [fetchVendors]);

    // Find the currently selected vendor object
    const selectedVendor = useMemo(() => {
        return vendors.find(v => v.id === selectedVendorId) || null;
    }, [vendors, selectedVendorId]);

    // --- Form Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewVendor(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleProductAdd = (e) => {
        e.preventDefault();
        if (!newVendor.currentProduct?.name?.trim()) return;
        const newProduct = { ...newVendor.currentProduct };
        setNewVendor(prev => ({
            ...prev,
            products: prev.products.some(p => p.name === newProduct.name)
                ? prev.products
                : [...prev.products, newProduct],
            currentProduct: { name: '', stock: 0, defaultPrice: 0, unit: 'Unit' },
        }));
    };

    const handleProductRemove = (productName) => {
        setNewVendor(prev => ({
            ...prev,
            products: prev.products.filter(p => p.name !== productName),
        }));
    };

    // Update current product fields
    const handleCurrentProductChange = (e) => {
        const { name, value } = e.target;
        setNewVendor(prev => ({
            ...prev,
            currentProduct: {
                ...prev.currentProduct,
                [name]: name === 'stock' || name === 'defaultPrice' ? parseFloat(value) || 0 : value,
            },
        }));
    };

    // --- API SUBMISSION FOR NEW VENDOR ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const { name, contact, address, products } = newVendor;

        if (!name.trim() || !contact.trim() || !address.trim() || products.length === 0) {
            setError('Please fill in Name, Phone, Address, and add at least one product.');
            setIsLoading(false);
            return;
        }

        const newVendorData = { name, contact, address };

        try {
            // 1. Create the vendor
            const vendorResponse = await fetch(`${API_BASE_URL}/vendors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newVendorData),
            });

            if (!vendorResponse.ok) {
                const errorData = await vendorResponse.json();
                throw new Error(errorData.error || `Failed to create vendor (Status: ${vendorResponse.status})`);
            }

            const createdVendor = await vendorResponse.json();

            // 2. Add each product to the new vendor via API
            for (const product of products) {
                const productResponse = await fetch(`${API_BASE_URL}/vendors/${createdVendor.vendor_id}/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: product.name,
                        stock: product.stock,
                        default_price: product.defaultPrice,
                        unit: product.unit,
                    }),
                });

                if (!productResponse.ok) {
                    const productErrorData = await productResponse.json();
                    throw new Error(productErrorData.error || `Failed to add product "${product.name}" (Status: ${productResponse.status})`);
                }
            }

            // 3. Refresh the list and select the newly created vendor
            fetchVendors(createdVendor.vendor_id);

            // 4. Reset form and view
            setNewVendor({ name: '', contact: '', address: '', products: [], currentProduct: { name: '', stock: 0, defaultPrice: 0, unit: 'Unit' } });
            setShowForm(false);
        } catch (err) {
            setError(err.message);
            console.error('Vendor Creation Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Handler to add product via API and refetch ---
    const handleProductAddition = async (productData) => {
        if (!selectedVendorId || !productData.name.trim()) return;

        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/vendors/${selectedVendorId}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: productData.name,
                    stock: productData.stock,
                    default_price: productData.defaultPrice,
                    unit: productData.unit,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add product (Status: ${response.status})`);
            }

            // Refetch vendors to update UI
            fetchVendors();
        } catch (err) {
            setError(err.message);
            console.error('Product Addition Error:', err);
        } finally {
            setIsModalOpen(false);
        }
    };

    // --- Handler to remove product via API and refetch ---
    const handleProductDeletion = async (productName) => {
        if (!selectedVendorId || !productName) return;

        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/vendors/${selectedVendorId}/products`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: productName }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to delete product (Status: ${response.status})`);
            }

            // Refetch vendors to update UI
            fetchVendors();
        } catch (err) {
            setError(err.message);
            console.error('Product Deletion Error:', err);
        }
    };

    // --- Loading and Error Displays ---
    if (isLoading && vendors.length === 0) {
        return <div className="vendors-page"><h1>Loading Vendors...</h1></div>;
    }

    if (error && !showForm) {
        return <div className="vendors-page"><h1 style={{ color: 'red' }}>Error: {error}</h1></div>;
    }

    return (
        <div className="vendors-page">
            <h1>Vendor Management</h1>

            {/* ADD VENDOR BUTTON/FORM TOGGLE */}
            <button
                className="toggle-form-btn"
                onClick={() => {
                    setShowForm(!showForm);
                    if (showForm) {
                        setNewVendor({ name: '', contact: '', address: '', products: [], currentProduct: { name: '', stock: 0, defaultPrice: 0, unit: 'Unit' } });
                    }
                }}
            >
                {showForm ? 'Cancel Add Vendor' : '+ Add New Vendor'}
            </button>

            {/* Display error message if form submission failed */}
            {error && <p className="error-message" style={{ color: 'red', margin: '10px 0' }}>{error}</p>}

            {/* Conditional Add Vendor Form */}
            {showForm && (
                <div className="add-vendor-form-container">
                    <h2>Add New Vendor</h2>
                    <form onSubmit={handleSubmit} className="vendor-form">
                        <div className="form-row">
                            <input
                                name="name"
                                type="text"
                                placeholder="Vendor Name"
                                value={newVendor.name}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                            />
                            <input
                                name="contact"
                                type="text"
                                placeholder="Contact Number"
                                value={newVendor.contact}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-row">
                            <input
                                name="address"
                                type="text"
                                placeholder="Address"
                                value={newVendor.address}
                                onChange={handleInputChange}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-row product-input-row">
                            <input
                                type="text"
                                name="name"
                                placeholder="Product Name"
                                value={newVendor.currentProduct?.name || ''}
                                onChange={handleCurrentProductChange}
                                disabled={isLoading}
                            />
                            <input
                                type="number"
                                name="stock"
                                placeholder="Stock"
                                min="0"
                                value={newVendor.currentProduct?.stock || 0}
                                onChange={handleCurrentProductChange}
                                disabled={isLoading}
                            />
                            <input
                                type="number"
                                name="defaultPrice"
                                placeholder="Default Price (PKR)"
                                min="0"
                                step="0.01"
                                value={newVendor.currentProduct?.defaultPrice || 0}
                                onChange={handleCurrentProductChange}
                                disabled={isLoading}
                            />
                            <input
                                type="text"
                                name="unit"
                                placeholder="Unit (e.g., Unit, Yard)"
                                value={newVendor.currentProduct?.unit || 'Unit'}
                                onChange={handleCurrentProductChange}
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={handleProductAdd}
                                className="add-single-product-btn"
                                disabled={!newVendor.currentProduct?.name?.trim() || isLoading}
                            >
                                Add
                            </button>
                        </div>

                        <div className="product-tag-list form-products-list">
                            {newVendor.products.length === 0 ? (
                                <p className="no-products-msg">Add at least one product before saving.</p>
                            ) : (
                                newVendor.products.map(p => (
                                    <span key={p.name} className="product-tag new-tag">
                                        {p.name} (Stock: {p.stock}, Price: {p.defaultPrice}, Unit: {p.unit})
                                        <button type="button" onClick={() => handleProductRemove(p.name)} className="remove-tag-btn">×</button>
                                    </span>
                                ))
                            )}
                        </div>

                        <button
                            type="submit"
                            className="save-btn"
                            disabled={!newVendor.name || !newVendor.contact || !newVendor.address || newVendor.products.length === 0 || isLoading}
                        >
                            {isLoading ? 'Saving...' : 'Save Vendor'}
                        </button>
                    </form>
                </div>
            )}

            {/* --- MASTER-DETAIL LAYOUT --- */}
            <div className="master-detail-container">
                {/* Left Side: Vendor List (Master) */}
                <div className="vendor-list-master">
                    <h2>All Vendors</h2>
                    <ul className="vendor-selector-list">
                        {vendors.length > 0 ? (
                            vendors.map(vendor => (
                                <li
                                    key={vendor.id}
                                    className={vendor.id === selectedVendorId ? 'active' : ''}
                                    onClick={() => setSelectedVendorId(vendor.id)}
                                >
                                    {vendor.name}
                                    <span className="product-count">{vendor.products.length} Products</span>
                                </li>
                            ))
                        ) : (
                            <li className="empty-row-msg">No vendors found.</li>
                        )}
                    </ul>
                </div>

                {/* Right Side: Product Details (Detail) */}
                <div className="product-detail-view">
                    {selectedVendor ? (
                        <>
                            <h2>Products from: {selectedVendor.name}</h2>
                            <div className="vendor-contact-info">
                                <strong>Contact:</strong> {selectedVendor.phone} |{' '}
                                <strong>Address:</strong> {selectedVendor.address}
                            </div>

                            <div className="product-actions">
                                <button
                                    className="add-product-btn"
                                    onClick={() => setIsModalOpen(true)}
                                >
                                    + Add New Product to {selectedVendor.name}
                                </button>
                            </div>

                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product Name</th>
                                        <th>Stock</th>
                                        <th>Default Price (PKR)</th>
                                        <th>Unit</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedVendor.products.length > 0 ? (
                                        selectedVendor.products.map((product, index) => (
                                            <tr key={product.product_id}>
                                                <td>{index + 1}</td>
                                                <td>{product.name}</td>
                                                <td>{product.stock}</td>
                                                <td>{product.default_price}</td>
                                                <td>{product.unit}</td>
                                                <td>
                                                    <button
                                                        className="remove-product-btn"
                                                        onClick={() => handleProductDeletion(product.name)}
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="empty-row-msg">
                                                No products found for this vendor.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <p className="selection-prompt">
                            Select a vendor from the left to view their product list, or click '+ Add New Vendor' to create one.
                        </p>
                    )}
                </div>
            </div>

            {/* Render the Modal Component */}
            <LocalAddProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAddProduct={handleProductAddition}
                vendorName={selectedVendor?.name || ''}
            />
        </div>
    );
}

export default VendorsPage;