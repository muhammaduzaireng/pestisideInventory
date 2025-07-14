import React, { useState, useEffect } from 'react';
import { stockPurchases, products, vendors } from '../services/api'; // Adjust path if needed

const AddStockPurchaseForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    vendor_id: '',
    purchase_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    payment_method: 'cash',
    amount_paid: 0,
    credit_due_date: '',
    transaction_id: '',
    bank_name: '',
    products: [], // Array of { product_id, added_stock, purchase_price, sell_price, expiry_date }
  });

  const [allProducts, setAllProducts] = useState([]); // Store all products
  const [availableProducts, setAvailableProducts] = useState([]); // Filtered products based on vendor
  const [availableVendors, setAvailableVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, vendorsRes] = await Promise.all([
          products.getAll(),
          vendors.getAll(),
        ]);
        setAllProducts(productsRes.data);
        setAvailableProducts(productsRes.data); // Initially, all products are available
        setAvailableVendors(vendorsRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load products or vendors.');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter products when vendor_id changes
  useEffect(() => {
    if (formData.vendor_id) {
      setAvailableProducts(
        allProducts.filter(
          (product) => product.vendor_id === parseInt(formData.vendor_id)
        )
      );
      // Reset products in formData if they don't match the selected vendor
      setFormData((prev) => ({
        ...prev,
        products: prev.products.filter((item) =>
          allProducts.some(
            (p) =>
              p.id === parseInt(item.product_id) &&
              p.vendor_id === parseInt(formData.vendor_id)
          )
        ),
      }));
    } else {
      setAvailableProducts(allProducts); // Show all products if no vendor selected
    }
  }, [formData.vendor_id, allProducts]);

  const handleInvoiceChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductChange = async (index, e) => {
    const { name, value } = e.target;
    const updatedProducts = [...formData.products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      [name]: name === 'added_stock' || name === 'purchase_price' || name === 'sell_price'
        ? parseFloat(value) || 0
        : value,
    };

    // Fetch and auto-fill recent purchase_price and sell_price when product_id changes
    if (name === 'product_id' && value) {
      try {
        const selectedProduct = allProducts.find((p) => p.id === parseInt(value));
        const response = await products.getRecentPrices(value);
        const { purchase_price, sell_price } = response.data;

        updatedProducts[index].purchase_price = purchase_price !== null ? purchase_price : (selectedProduct?.purchase_price || 0);
        updatedProducts[index].sell_price = sell_price !== null ? sell_price : (selectedProduct?.sell_price || 0);
      } catch (err) {
        console.error('Error fetching recent prices:', err);
        const selectedProduct = allProducts.find((p) => p.id === parseInt(value));
        updatedProducts[index].purchase_price = selectedProduct?.purchase_price || 0;
        updatedProducts[index].sell_price = selectedProduct?.sell_price || 0;
      }
    }

    setFormData((prev) => ({ ...prev, products: updatedProducts }));
  };

  const addProductRow = () => {
    setFormData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          product_id: '',
          added_stock: 0,
          purchase_price: 0,
          sell_price: 0,
          expiry_date: '',
        },
      ],
    }));
  };

  const removeProductRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  };

  const calculateTotalBillAmount = () => {
    return formData.products.reduce((sum, item) => sum + (item.added_stock * item.purchase_price), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const totalBillAmount = calculateTotalBillAmount();
    let amount_paid = formData.amount_paid;
    let credit_due_date = formData.credit_due_date;
    let transaction_id = formData.transaction_id;
    let bank_name = formData.bank_name;

    // Adjust amount_paid based on payment method
    if (formData.payment_method === 'cash' || formData.payment_method === 'bank_transfer') {
      amount_paid = totalBillAmount;
    } else if (formData.payment_method === 'credit') {
      amount_paid = 0; // Entire amount is credit
    }

    const payload = {
      ...formData,
      total_bill_amount: totalBillAmount,
      amount_paid: amount_paid,
      // Ensure specific fields are nullified if not applicable
      credit_due_date: (formData.payment_method === 'credit' || formData.payment_method === 'cash_and_credit') ? credit_due_date : null,
      transaction_id: formData.payment_method === 'bank_transfer' ? transaction_id : null,
      bank_name: formData.payment_method === 'bank_transfer' ? bank_name : null,
    };

    console.log('Submitting Stock Purchase:', payload); // Debugging

    try {
      await stockPurchases.addPurchase(payload);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error adding stock purchase:', err.response ? err.response.data : err);
      setError(err.response?.data?.error || 'Failed to add stock purchase.');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error && !allProducts.length && !availableVendors.length) return <div>Error: {error}</div>;

  return (
    <div className="add-stock-purchase-form">
      <h2>Record New Stock Purchase</h2>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>Error: {error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            Vendor:
            <select
              name="vendor_id"
              value={formData.vendor_id}
              onChange={handleInvoiceChange}
              required
              style={{ marginLeft: '10px', padding: '8px' }}
            >
              <option value="">Select Vendor</option>
              {availableVendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Purchase Date:
            <input
              type="date"
              name="purchase_date"
              value={formData.purchase_date}
              onChange={handleInvoiceChange}
              required
              style={{ marginLeft: '10px', padding: '8px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Payment Method:
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleInvoiceChange}
              required
              style={{ marginLeft: '10px', padding: '8px' }}
            >
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash_and_credit">Cash & Credit</option>
            </select>
          </label>
        </div>

        {(formData.payment_method === 'cash_and_credit' || formData.payment_method === 'credit') && (
          <div style={{ marginBottom: '15px' }}>
            <label>
              Credit Due Date:
              <input
                type="date"
                name="credit_due_date"
                value={formData.credit_due_date}
                onChange={handleInvoiceChange}
                required={formData.payment_method === 'cash_and_credit' || formData.payment_method === 'credit'}
                style={{ marginLeft: '10px', padding: '8px' }}
              />
            </label>
          </div>
        )}

        {(formData.payment_method === 'bank_transfer' || formData.payment_method === 'cash_and_credit') && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label>
                Transaction ID:
                <input
                  type="text"
                  name="transaction_id"
                  value={formData.transaction_id}
                  onChange={handleInvoiceChange}
                  required={formData.payment_method === 'bank_transfer'}
                  style={{ marginLeft: '10px', padding: '8px' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>
                Bank Name:
                <input
                  type="text"
                  name="bank_name"
                  value={formData.bank_name}
                  onChange={handleInvoiceChange}
                  required={formData.payment_method === 'bank_transfer'}
                  style={{ marginLeft: '10px', padding: '8px' }}
                />
              </label>
            </div>
          </>
        )}

        {(formData.payment_method === 'cash_and_credit') && (
          <div style={{ marginBottom: '15px' }}>
            <label>
              Amount Paid (Cash Part):
              <input
                type="number"
                name="amount_paid"
                value={formData.amount_paid}
                onChange={handleInvoiceChange}
                min="0"
                max={calculateTotalBillAmount()}
                step="0.01"
                required
                style={{ marginLeft: '10px', padding: '8px' }}
              />
            </label>
          </div>
        )}

        <div style={{ marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '15px' }}>
          <h3>Products in this Purchase</h3>
          {formData.products.map((item, index) => {
            const selectedProduct = allProducts.find((p) => p.id === parseInt(item.product_id));
            const requiresExpiry = selectedProduct ? selectedProduct.expiry_date_tracking : false;

            return (
              <div key={index} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
                <label>
                  Product:
                  <select
                    name="product_id"
                    value={item.product_id}
                    onChange={(e) => handleProductChange(index, e)}
                    required
                    style={{ marginLeft: '10px', padding: '8px', width: '200px' }}
                  >
                    <option value="">Select Product</option>
                    {availableProducts.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({prod.barcode})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ marginLeft: '20px' }}>
                  Quantity:
                  <input
                    type="number"
                    name="added_stock"
                    value={item.added_stock}
                    onChange={(e) => handleProductChange(index, e)}
                    min="1"
                    required
                    style={{ marginLeft: '10px', padding: '8px', width: '80px' }}
                  />
                </label>
                <label style={{ marginLeft: '20px' }}>
                  Purchase Price:
                  <input
                    type="number"
                    name="purchase_price"
                    value={item.purchase_price}
                    onChange={(e) => handleProductChange(index, e)}
                    min="0"
                    step="0.01"
                    required
                    style={{ marginLeft: '10px', padding: '8px', width: '100px' }}
                  />
                </label>
                <label style={{ marginLeft: '20px' }}>
                  Sell Price:
                  <input
                    type="number"
                    name="sell_price"
                    value={item.sell_price}
                    onChange={(e) => handleProductChange(index, e)}
                    min="0"
                    step="0.01"
                    required
                    style={{ marginLeft: '10px', padding: '8px', width: '100px' }}
                  />
                </label>
                {requiresExpiry && (
                  <label style={{ marginLeft: '20px' }}>
                    Expiry Date:
                    <input
                      type="date"
                      name="expiry_date"
                      value={item.expiry_date}
                      onChange={(e) => handleProductChange(index, e)}
                      required={requiresExpiry}
                      style={{ marginLeft: '10px', padding: '8px', width: '150px' }}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => removeProductRow(index)}
                  style={{ marginLeft: '20px', backgroundColor: 'red', color: 'white', border: 'none', padding: '8px 12px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addProductRow}
            style={{ marginTop: '10px', padding: '10px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Add Product Row
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <strong>Total Bill Amount: ${calculateTotalBillAmount().toFixed(2)}</strong>
        </div>
        {formData.payment_method === 'cash_and_credit' && (
          <div style={{ marginBottom: '20px' }}>
            <strong>Pending Amount: ${(calculateTotalBillAmount() - (parseFloat(formData.amount_paid) || 0)).toFixed(2)}</strong>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Record Purchase
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStockPurchaseForm;