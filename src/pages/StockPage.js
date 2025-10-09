import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './StockPage.css';

// --- API CONFIGURATION ---
const API_BASE_URL = 'http://107.174.64.240:5002/api';
const LOW_STOCK_THRESHOLD = 10;

function StockPage() {
  // State to hold all product data
  const [products, setProducts] = useState([]);
  // State for the search term
  const [searchTerm, setSearchTerm] = useState('');
  // State for loading and error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Map API data to match expected structure
      const mappedProducts = data.map(product => ({
        id: product.product_id,
        name: product.name,
        stock_qty: parseInt(product.stock, 10),
        default_price: parseFloat(product.default_price),
        unit: product.unit || 'Unit',
      }));
      setProducts(mappedProducts);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Could not connect to the backend server or API failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filtered Products for the Main Table
  const filteredProducts = useMemo(() => {
    const lowerCaseSearch = searchTerm.toLowerCase();
    if (!lowerCaseSearch) {
      return products;
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(lowerCaseSearch)
    );
  }, [products, searchTerm]);

  // Low Stock Products for the Warning Table
  const lowStockProducts = useMemo(() => {
    return products
      .filter(product => product.stock_qty <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.stock_qty - b.stock_qty); // Sort by quantity (lowest first)
  }, [products]);

  // Rendering
  if (isLoading) {
    return <div className="stock-page"><h1>Loading Products...</h1></div>;
  }

  if (error) {
    return <div className="stock-page"><h1 style={{ color: 'red' }}>Error: {error}</h1></div>;
  }

  return (
    <div className="stock-page">
      <h1>Inventory & Stock Management</h1>

      {/* --- Low Stock Alert Table --- */}
      {lowStockProducts.length > 0 && (
        <div className="low-stock-alert">
          <h2>⚠️ Low Stock Alert ({lowStockProducts.length} Items)</h2>
          <table className="low-stock-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Stock Level</th>
                <th>Unit</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {lowStockProducts.map(product => (
                <tr key={product.id} className={product.stock_qty < LOW_STOCK_THRESHOLD ? 'critical' : ''}>
                  <td>{product.name}</td>
                  <td><strong>{product.stock_qty}</strong></td>
                  <td>{product.unit}</td>
                  <td>PKR {product.default_price.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="threshold-note">Items with stock $\le$ {LOW_STOCK_THRESHOLD} are shown here.</p>
        </div>
      )}
      
      {/* --- Main Stock List Section --- */}
      <div className="main-stock-list">
        <h2>All Products List</h2>
        
        <div className="stock-controls">
          <input
            type="text"
            placeholder="Search product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
        </div>

        <table className="product-inventory-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product Name</th>
              <th>Current Stock</th>
              <th>Unit</th>
              <th>Default Price</th>
              
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.stock_qty}</td>
                <td>{product.unit}</td>
                <td>PKR {product.default_price.toLocaleString()}</td>
                
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan="6" className="empty-row">No products match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default StockPage;