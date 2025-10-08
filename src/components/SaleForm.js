import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AddCustomerPage from '../pages/AddCustomerPage';
import './SaleForm.css';

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:5002/api';

// --- Constants ---
const WALK_IN_CUSTOMER = {
  id: 0,
  name: 'Walk-in Customer',
  contact: null,
  address: null,
};

function SaleForm() {
  const [customers, setCustomers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [billDetails, setBillDetails] = useState({
    billNumber: '',
    customer: null,
    paymentType: 'Cash',
    cashPaid: 0,
    creditRemaining: 0,
  });

  // Fetch customers and vendors (with products)
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [customersRes, vendorsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers`),
        fetch(`${API_BASE_URL}/vendors`),
      ]);

      if (!customersRes.ok || !vendorsRes.ok) {
        throw new Error('Failed to fetch data from API');
      }

      const customersData = await customersRes.json();
      const vendorsData = await vendorsRes.json();

      // Transform customer data and add Walk-in Customer
      const transformedCustomers = [
        WALK_IN_CUSTOMER,
        ...customersData.map(c => ({
          id: c.customer_id,
          name: c.name,
          contact: c.phone,
          address: c.address,
        })),
      ];

      // Aggregate products from all vendors
      const allProducts = vendorsData
        .flatMap(v => v.products)
        .map(p => ({
          id: p.product_id,
          name: p.name,
          stock: p.stock,
          defaultPrice: parseFloat(p.default_price),
          unit: p.unit,
        }))
        .filter((p, index, self) => 
          index === self.findIndex(p2 => p2.id === p.id) // Remove duplicates by product_id
        );

      setCustomers(transformedCustomers);
      setAvailableProducts(allProducts);
      setBillDetails(prev => ({
        ...prev,
        customer: transformedCustomers[0]?.id || null,
      }));
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- CALCULATIONS ---
  const grandTotal = useMemo(() => {
    return selectedProducts.reduce((acc, item) => acc + item.total, 0);
  }, [selectedProducts]);

  const remainingCredit = useMemo(() => {
    if (billDetails.paymentType === 'Cash+Credit' && billDetails.customer !== 0) {
      const remaining = grandTotal - parseFloat(billDetails.cashPaid || 0);
      return Math.max(0, remaining);
    }
    return 0;
  }, [grandTotal, billDetails.paymentType, billDetails.cashPaid, billDetails.customer]);

  useEffect(() => {
    setBillDetails(prev => ({
      ...prev,
      creditRemaining: remainingCredit,
    }));
  }, [remainingCredit]);

  // --- HANDLERS ---
  const handleAddCustomer = async (newCustomer) => {
    try {
      console.log('New Customer Response:', newCustomer); // Debug log
      const transformedCustomer = {
        id: newCustomer.customer_id,
        name: newCustomer.name,
        contact: newCustomer.phone,
        address: newCustomer.address,
      };

      setCustomers(prev => [...prev, transformedCustomer]);
      setBillDetails(prev => ({
        ...prev,
        customer: transformedCustomer.id,
        paymentType: 'Cash', // Reset to Cash for new customer
        cashPaid: 0,
        creditRemaining: 0,
      }));
      setIsAddCustomerModalOpen(false);
    } catch (err) {
      console.error('Error processing new customer:', err);
      alert('Failed to process new customer: ' + err.message);
    }
  };

  const handleBillDetailChange = (e) => {
    const { name, value } = e.target;
    setBillDetails(prev => {
      let newState = { ...prev, [name]: value };

      // Handle customer change
      if (name === 'customer') {
        const isWalkIn = parseInt(value) === WALK_IN_CUSTOMER.id;
        newState.paymentType = isWalkIn ? 'Cash' : prev.paymentType;
        newState.cashPaid = isWalkIn ? grandTotal.toFixed(2) : 0;
        newState.creditRemaining = 0;
      }

      // Handle payment type change
      if (name === 'paymentType') {
        if (value === 'Cash') {
          newState.cashPaid = grandTotal.toFixed(2);
          newState.creditRemaining = 0;
        } else if (value === 'Credit') {
          newState.cashPaid = 0;
          newState.creditRemaining = grandTotal.toFixed(2);
        } else {
          newState.cashPaid = 0;
          newState.creditRemaining = grandTotal.toFixed(2);
        }
      }

      // Handle cash paid change
      if (name === 'cashPaid') {
        const cash = parseFloat(value) || 0;
        const remaining = grandTotal - cash;
        newState.creditRemaining = Math.max(0, remaining).toFixed(2);
      }

      return newState;
    });
  };

  const handleProductSelection = (e) => {
    const productId = parseInt(e.target.value);
    const product = availableProducts.find(p => p.id === productId);

    if (product) {
      setAvailableProducts(prev => prev.filter(p => p.id !== productId));
      setSelectedProducts(prev => [
        ...prev,
        {
          ...product,
          salePrice: product.defaultPrice,
          quantity: 1,
          total: product.defaultPrice * 1,
        },
      ]);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedProducts = selectedProducts.map((item, i) => {
      if (i === index) {
        let numericValue = field === 'name' ? value : parseFloat(value) || 0;
        let updatedItem = { ...item, [field]: numericValue };

        if (field === 'salePrice' || field === 'quantity') {
          updatedItem.total = updatedItem.salePrice * updatedItem.quantity;
        }
        return updatedItem;
      }
      return item;
    });
    setSelectedProducts(updatedProducts);
  };

  const removeItem = (index) => {
    const removedItem = selectedProducts[index];
    setAvailableProducts(prev => [...prev, availableProducts.find(p => p.id === removedItem.id) || removedItem]);
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedProducts.length === 0) {
      alert('Please add at least one product.');
      return;
    }

    if (billDetails.paymentType === 'Cash+Credit' && parseFloat(billDetails.cashPaid) > grandTotal) {
      alert('Cash Paid cannot be more than the Grand Total.');
      return;
    }

    const saleData = {
      billNumber: billDetails.billNumber,
      customerId: parseInt(billDetails.customer),
      paymentType: billDetails.paymentType,
      cashPaid: parseFloat(billDetails.cashPaid) || 0,
      creditRemaining: parseFloat(billDetails.creditRemaining) || 0,
      grandTotal: grandTotal.toFixed(2),
      items: selectedProducts.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        salePrice: item.salePrice,
      })),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/sale_bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save sale');
      }

      const savedSale = await response.json();
      alert(`Sale recorded for Bill #${savedSale.bill_number}. Total: PKR ${grandTotal.toFixed(2)}. Cash Paid: PKR ${billDetails.cashPaid}. Credit Remaining: PKR ${billDetails.creditRemaining}`);
      
      // Reset form
      setBillDetails({
        billNumber: '',
        customer: customers[0]?.id || null,
        paymentType: 'Cash',
        cashPaid: 0,
        creditRemaining: 0,
      });
      setSelectedProducts([]);
      setAvailableProducts(prev => [...prev, ...selectedProducts]);
      fetchData(); // Refresh products to update stock
    } catch (err) {
      console.error('Error saving sale:', err);
      alert('Failed to save sale: ' + err.message);
    }
  };

  // --- RENDERING ---
  if (isLoading) {
    return (
      <div className="sale-form">
        <h2>Loading...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sale-form">
        <h2>Error: {error}</h2>
      </div>
    );
  }

  const isWalkInCustomer = parseInt(billDetails.customer) === WALK_IN_CUSTOMER.id;

  return (
    <form className="sale-form" onSubmit={handleSubmit}>
      <div className="bill-header-row">
        <div className="form-group">
          <label htmlFor="billNumber">Bill No. (Manual)</label>
          <input
            id="billNumber"
            name="billNumber"
            type="text"
            value={billDetails.billNumber}
            onChange={handleBillDetailChange}
            placeholder="Enter Bill Number"
            required
          />
        </div>

        <div className="form-group customer-select-group">
          <label htmlFor="customer">Customer</label>
          <div className="customer-input-row">
            <select
              id="customer"
              name="customer"
              value={billDetails.customer || ''}
              onChange={handleBillDetailChange}
              required
            >
              <option value="" disabled>Select a customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="add-customer-btn"
              onClick={() => setIsAddCustomerModalOpen(true)}
            >
              +
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="paymentType">Payment Type</label>
          <select
            id="paymentType"
            name="paymentType"
            value={billDetails.paymentType}
            onChange={handleBillDetailChange}
            disabled={isWalkInCustomer}
          >
            <option value="Cash">Cash</option>
            {!isWalkInCustomer && <option value="Credit">Credit</option>}
            {!isWalkInCustomer && <option value="Cash+Credit">Cash + Credit</option>}
          </select>
        </div>
      </div>

      <div className="product-selection-section">
        <h3>Add Products</h3>
        <select onChange={handleProductSelection} value="">
          <option value="" disabled>Select a product to add...</option>
          {availableProducts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} (Stock: {p.stock})
            </option>
          ))}
        </select>
      </div>

      <div className="sale-items-table">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {selectedProducts.map((item, index) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.salePrice}
                    onChange={(e) => handleItemChange(index, 'salePrice', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </td>
                <td>PKR {item.total.toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => removeItem(index)} className="remove-btn">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {selectedProducts.length === 0 && (
              <tr>
                <td colSpan="5" className="empty-row">No products added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {billDetails.paymentType === 'Cash+Credit' && !isWalkInCustomer && (
        <div className="cash-credit-row">
          <div className="form-group">
            <label htmlFor="cashPaid">Cash Paid</label>
            <input
              id="cashPaid"
              name="cashPaid"
              type="number"
              min="0"
              max={grandTotal}
              step="any"
              value={billDetails.cashPaid}
              onChange={handleBillDetailChange}
              placeholder="0.00"
              required
            />
          </div>
          <div className="credit-display">
            <strong>Credit Remaining:</strong>
            <span>PKR {parseFloat(billDetails.creditRemaining).toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="sale-footer">
        <div className="grand-total">
          <strong>GRAND TOTAL: PKR {grandTotal.toFixed(2)}</strong>
        </div>
        <button type="submit" className="submit-btn" disabled={selectedProducts.length === 0}>
          Save
        </button>
      </div>

      {isAddCustomerModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddCustomerModalOpen(false)}>
          <div className="modal-content add-customer-modal" onClick={e => e.stopPropagation()}>
            <AddCustomerPage
              onSaveSuccess={handleAddCustomer}
              onBack={() => setIsAddCustomerModalOpen(false)}
            />
          </div>
        </div>
      )}
    </form>
  );
}

export default SaleForm;