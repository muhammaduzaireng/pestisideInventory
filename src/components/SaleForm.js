import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './SaleForm.css';

// --- API Configuration ---
const API_BASE_URL = 'https://api.devzytic.com/api';

// --- Constants ---
const WALK_IN_CUSTOMER = {
  id: 1, // Matches customer_id in the database
  name: 'Walk-in Customer',
  contact: null,
  address: null,
};

// --- INTEGRATED COMPONENT: AddCustomerPage ---
function AddCustomerPage({ onSaveSuccess, onBack }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleSave = async () => {
    if (!name) {
      alert('Customer Name is required.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone: phone || null,
          address: address || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save customer');
      }

      const newCustomer = await response.json();
      onSaveSuccess(newCustomer);
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('Failed to save customer: ' + err.message);
    }
  };

  return (
    <div className="add-customer-form">
      <h3>Add New Customer</h3>
      <div className="form-group">
        <label htmlFor="newCustomerName">Name (Required)</label>
        <input
          id="newCustomerName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="newCustomerPhone">Phone</label>
        <input
          id="newCustomerPhone"
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="newCustomerAddress">Address</label>
        <input
          id="newCustomerAddress"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>
      <div className="button-row">
        <button type="button" onClick={handleSave} className="submit-btn save-btn">
          Save Customer
        </button>
        <button type="button" onClick={onBack} className="back-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}
// --- END INTEGRATED COMPONENT ---

function SaleForm() {
  const [customers, setCustomers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerResults, setShowCustomerResults] = useState(false);

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

      // Transform customer data and sort to ensure Walk-in Customer (ID 1) is first
      const transformedCustomers = customersData.map(c => ({
        id: c.customer_id,
        name: c.name,
        contact: c.phone,
        address: c.address,
      }));

      transformedCustomers.sort((a, b) => {
        if (a.id === WALK_IN_CUSTOMER.id) return -1;
        if (b.id === WALK_IN_CUSTOMER.id) return 1;
        return a.name.localeCompare(b.name);
      });

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
        .filter((p, index, self) => index === self.findIndex(p2 => p2.id === p.id));

      setCustomers(transformedCustomers);
      setAvailableProducts(allProducts);

      const defaultCustomerId = transformedCustomers[0]?.id || null;
      setBillDetails(prev => ({
        ...prev,
        customer: defaultCustomerId,
        cashPaid: prev.paymentType === 'Cash' ? 0 : prev.cashPaid,
      }));

      const initialCustomer = transformedCustomers.find(c => c.id === defaultCustomerId);
      if (initialCustomer) {
        setCustomerSearchTerm(initialCustomer.name);
      }
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

  // --- CUSTOMER SEARCH FILTERING ---
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) {
      return customers;
    }
    const lowerCaseTerm = customerSearchTerm.toLowerCase();
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(lowerCaseTerm) ||
        (c.contact && c.contact.toLowerCase().includes(lowerCaseTerm))
    );
  }, [customers, customerSearchTerm]);

  // Update cashPaid and creditRemaining when grandTotal or paymentType changes
  useEffect(() => {
    setBillDetails(prev => {
      let newCashPaid = prev.cashPaid;
      let newCreditRemaining = prev.creditRemaining;

      if (prev.paymentType === 'Cash') {
        newCashPaid = grandTotal;
        newCreditRemaining = 0;
      } else if (prev.paymentType === 'Credit') {
        newCashPaid = 0;
        newCreditRemaining = grandTotal;
      } else if (prev.paymentType === 'Cash+Credit') {
        const cash = parseFloat(prev.cashPaid) || 0;
        newCreditRemaining = Math.max(0, grandTotal - cash);
        if (cash > grandTotal) {
          newCashPaid = grandTotal;
          newCreditRemaining = 0;
        }
      }

      return {
        ...prev,
        cashPaid: newCashPaid,
        creditRemaining: newCreditRemaining,
      };
    });
  }, [grandTotal, billDetails.paymentType]);

  // --- HANDLERS ---
  const handleCustomerSearchChange = (e) => {
    const value = e.target.value;
    setCustomerSearchTerm(value);
    setShowCustomerResults(true);

    if (!value) {
      const defaultCustomer = customers.find(c => c.id === WALK_IN_CUSTOMER.id);
      setBillDetails(prev => ({
        ...prev,
        customer: defaultCustomer?.id || null,
      }));
    }
  };

  const handleCustomerSelect = (customerId) => {
    setBillDetails(prev => {
      let newState = { ...prev, customer: customerId };
      const isWalkIn = parseInt(customerId) === WALK_IN_CUSTOMER.id;

      newState.paymentType = isWalkIn ? 'Cash' : prev.paymentType;

      if (isWalkIn || newState.paymentType === 'Cash') {
        newState.cashPaid = grandTotal;
        newState.creditRemaining = 0;
      } else if (newState.paymentType === 'Credit') {
        newState.cashPaid = 0;
        newState.creditRemaining = grandTotal;
      }

      return newState;
    });

    const selectedCustomer = customers.find(c => c.id === customerId);
    setCustomerSearchTerm(selectedCustomer ? selectedCustomer.name : '');
    setShowCustomerResults(false);
  };

  const handleAddCustomer = async (newCustomer) => {
    try {
      const transformedCustomer = {
        id: newCustomer.customer_id,
        name: newCustomer.name,
        contact: newCustomer.phone,
        address: newCustomer.address,
      };

      setCustomers(prev =>
        [...prev, transformedCustomer].sort((a, b) => {
          if (a.id === WALK_IN_CUSTOMER.id) return -1;
          if (b.id === WALK_IN_CUSTOMER.id) return 1;
          return a.name.localeCompare(b.name);
        })
      );

      setBillDetails(prev => ({
        ...prev,
        customer: transformedCustomer.id,
        paymentType: 'Cash',
        cashPaid: grandTotal,
        creditRemaining: 0,
      }));

      setCustomerSearchTerm(transformedCustomer.name);
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

      if (name === 'paymentType') {
        if (value === 'Cash') {
          newState.cashPaid = grandTotal;
          newState.creditRemaining = 0;
        } else if (value === 'Credit') {
          newState.cashPaid = 0;
          newState.creditRemaining = grandTotal;
        } else if (value === 'Cash+Credit') {
          newState.cashPaid = 0;
          newState.creditRemaining = grandTotal;
        }
      }

      if (name === 'cashPaid' && prev.paymentType === 'Cash+Credit') {
        const cash = parseFloat(value) || 0;
        const remaining = grandTotal - cash;
        newState.creditRemaining = Math.max(0, remaining);
        if (cash > grandTotal) {
          newState.cashPaid = grandTotal;
          newState.creditRemaining = 0;
        }
      }

      if (name === 'cashPaid' && prev.paymentType === 'Cash') {
        newState.cashPaid = grandTotal;
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
    const productToRestore = availableProducts.find(p => p.id === removedItem.id) || {
      id: removedItem.id,
      name: removedItem.name,
      stock: removedItem.stock,
      defaultPrice: removedItem.defaultPrice,
      unit: removedItem.unit,
    };

    setAvailableProducts(prev => [...prev, productToRestore]);
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedProducts.length === 0) {
      alert('Please add at least one product.');
      return;
    }

    const customerId = parseInt(billDetails.customer);
    if (isNaN(customerId) || customerId === null) {
      alert('Please select a valid customer.');
      return;
    }

    const finalCashPaid = parseFloat(billDetails.cashPaid) || 0;
    const finalCreditRemaining = parseFloat(billDetails.creditRemaining) || 0;

    if (billDetails.paymentType === 'Cash') {
      if (finalCashPaid !== grandTotal) {
        setBillDetails(prev => ({ ...prev, cashPaid: grandTotal, creditRemaining: 0 }));
        alert('For Cash payment, Cash Paid has been auto-corrected to match Grand Total.');
        return;
      }
    }

    if (billDetails.paymentType === 'Cash+Credit' && finalCashPaid > grandTotal) {
      alert('Cash Paid cannot be more than the Grand Total.');
      return;
    }

    if (billDetails.paymentType !== 'Credit' && Math.abs((finalCashPaid + finalCreditRemaining) - grandTotal) > 0.01) {
      alert('Cash Paid plus Credit Remaining must equal the Grand Total.');
      return;
    }

    const saleData = {
      billNumber: billDetails.billNumber,
      customerId: customerId,
      paymentType: billDetails.paymentType,
      cashPaid: finalCashPaid,
      creditRemaining: finalCreditRemaining,
      grandTotal: grandTotal,
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

      const responseText = await response.text();

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || 'Unknown error' };
        }
        throw new Error(errorData.error || `Failed to save sale: ${response.status}`);
      }

      const savedSale = JSON.parse(responseText);
      alert(
        `Sale recorded for Bill #${savedSale.bill_number}. Total: PKR ${grandTotal.toFixed(
          2
        )}. Cash Paid: PKR ${finalCashPaid.toFixed(2)}. Credit Remaining: PKR ${finalCreditRemaining.toFixed(2)}`
      );

      // Reset form
      const defaultCustomer = customers.find(c => c.id === WALK_IN_CUSTOMER.id)?.id || null;
      setBillDetails({
        billNumber: '',
        customer: defaultCustomer,
        paymentType: 'Cash',
        cashPaid: 0,
        creditRemaining: 0,
      });
      setCustomerSearchTerm(customers.find(c => c.id === defaultCustomer)?.name || '');
      setSelectedProducts([]);
      setAvailableProducts(prev => {
        const productsToRestore = selectedProducts.filter(p => !prev.some(ap => ap.id === p.id));
        return [...prev, ...productsToRestore];
      });
      fetchData();
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
  const isCashPayment = billDetails.paymentType === 'Cash';

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
          <label htmlFor="customerSearch">Customer</label>
          <div className="customer-input-row customer-search-container">
            <input
              id="customerSearch"
              type="text"
              value={customerSearchTerm}
              onChange={handleCustomerSearchChange}
              onFocus={(e) => {
                e.target.value = ''; // Clear input on focus
                setCustomerSearchTerm('');
                setShowCustomerResults(true);
              }}
              onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
              placeholder="Search customer by name or contact..."
            />
            <button
              type="button"
              className="add-customer-btn"
              onClick={() => setIsAddCustomerModalOpen(true)}
            >
              +
            </button>
            {showCustomerResults && (
              <div className="customer-search-results">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.slice(0, 10).map(c => (
                    <div
                      key={c.id}
                      className={`customer-result-item ${c.id === billDetails.customer ? 'selected' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCustomerSelect(c.id);
                      }}
                    >
                      <strong>{c.name}</strong>
                      {c.contact && <span>({c.contact})</span>}
                    </div>
                  ))
                ) : (
                  <div className="customer-result-item no-results">No customers found.</div>
                )}
              </div>
            )}
          </div>
          <input type="hidden" name="customer" value={billDetails.customer || ''} />
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
              {p.name} (Stock: {p.stock} {p.unit})
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

      {(billDetails.paymentType === 'Cash' || billDetails.paymentType === 'Cash+Credit') && (
        <div className="cash-credit-row">
          <div className="form-group">
            <label htmlFor="cashPaid">{isCashPayment ? 'Cash Paid' : 'Cash Paid (Partial)'}</label>
            <input
              id="cashPaid"
              name="cashPaid"
              type="number"
              min="0"
              max={grandTotal}
              step="any"
              value={isCashPayment ? grandTotal : billDetails.cashPaid}
              onChange={handleBillDetailChange}
              placeholder="0.00"
              required
              disabled={isCashPayment}
              readOnly={isCashPayment}
            />
            {isCashPayment && (
              <small className="cash-paid-hint">Auto-set to grand total for Cash payments</small>
            )}
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