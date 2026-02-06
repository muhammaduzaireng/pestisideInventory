import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './PurchaseBillPage.css';

// --- API Configuration ---
import { API_BASE_URL } from '../config/api';

// --- INITIAL FORM STATE ---
const initialBillState = {
    vendorId: '',
    invoiceNo: '',
    date: new Date().toISOString().substring(0, 10),
    paymentType: 'Cash',
    products: [{ productId: '', qty: 1, price: 0, total: 0 }],
    paymentSource: 'Cash',
    paymentAmount: 0,
    initialPrNumber: '',
};

function PurchaseBillPage() {
    const [purchaseBills, setPurchaseBills] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [products, setProducts] = useState([]);
    const [paymentSources, setPaymentSources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newBill, setNewBill] = useState(initialBillState);
    const [selectedBillForPayment, setSelectedBillForPayment] = useState(null);

    // --- API FETCH LOGIC ---
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [billsRes, vendorsRes, productsRes, sourcesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/purchase_bills`),
                fetch(`${API_BASE_URL}/purchase_bills/vendors`),
                fetch(`${API_BASE_URL}/purchase_bills/products`),
                fetch(`${API_BASE_URL}/purchase_bills/payment_sources`)
            ]);

            if (!billsRes.ok || !vendorsRes.ok || !productsRes.ok || !sourcesRes.ok) {
                throw new Error('Failed to fetch data from API');
            }

            setPurchaseBills(await billsRes.json());
            setVendors(await vendorsRes.json());
            setProducts(await productsRes.json());
            setPaymentSources(await sourcesRes.json());
        } catch (err) {
            setError(err.message);
            console.error('Error fetching data:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate total amount for the new bill
    const newBillTotal = useMemo(() => {
        return newBill.products.reduce((sum, item) => sum + item.total, 0);
    }, [newBill.products]);

    // Filter products based on selected vendor
    const filteredProducts = useMemo(() => {
        if (!newBill.vendorId) return [];
        return products.filter(p => p.vendor_id === parseInt(newBill.vendorId));
    }, [newBill.vendorId, products]);

    // --- HANDLERS FOR NEW BILL FORM ---
    const handleProductChange = (index, field, value) => {
        const updatedProducts = newBill.products.map((item, i) => {
            if (i !== index) return item;
            let updatedItem = { ...item, [field]: value };

            if (field === 'productId') {
                const product = products.find(p => p.id === parseInt(value));
                updatedItem.name = product ? product.name : '';
                updatedItem.price = product ? product.default_price : 0;
                updatedItem.total = updatedItem.qty * updatedItem.price;
            } else if (field === 'qty' || field === 'price') {
                updatedItem.total = updatedItem.qty * updatedItem.price;
            }
            return updatedItem;
        });
        setNewBill({ ...newBill, products: updatedProducts });
    };

    const addProductRow = () => {
        setNewBill({
            ...newBill,
            products: [...newBill.products, { productId: '', qty: 1, price: 0, total: 0 }]
        });
    };

    const removeProductRow = (index) => {
        setNewBill({
            ...newBill,
            products: newBill.products.filter((_, i) => i !== index)
        });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!newBill.vendorId || !newBill.invoiceNo || newBillTotal <= 0) {
            setError('Please fill in vendor, invoice number, and add products.');
            return;
        }

        const payment = (newBill.paymentType === 'Cash' || newBill.paymentType === 'Cash+Credit') && newBill.paymentAmount > 0
            ? {
                amount: newBill.paymentType === 'Cash' ? newBillTotal : newBill.paymentAmount,
                source: newBill.paymentSource,
                date: newBill.date,
                prNumber: newBill.initialPrNumber || 'N/A'
            }
            : null;

        const payload = {
            invoiceNo: newBill.invoiceNo,
            vendorId: parseInt(newBill.vendorId),
            date: newBill.date,
            paymentType: newBill.paymentType,
            products: newBill.products.map(p => ({
                productId: parseInt(p.productId),
                quantity: parseInt(p.qty),
                price: parseFloat(p.price)
            })),
            payment: payment
        };

        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/purchase_bills`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to create purchase bill (Status: ${response.status})`);
            }

            const newBillData = await response.json();
            setPurchaseBills([...purchaseBills, newBillData]);
            setNewBill(initialBillState);
            setIsAddingNew(false);
        } catch (err) {
            setError(err.message);
            console.error('Error creating purchase bill:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- HANDLERS FOR PAYMENT ---
    const handlePayAmount = async (bill, payAmount, paySource, prNumber) => {
        if (payAmount <= 0 || payAmount > bill.balance) {
            setError('Invalid payment amount.');
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/purchase_bills/${bill.bill_id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(payAmount),
                    source: paySource,
                    date: new Date().toISOString().substring(0, 10),
                    prNumber: prNumber || 'N/A'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to add payment (Status: ${response.status})`);
            }

            const updatedBill = await response.json();
            setPurchaseBills(purchaseBills.map(b => b.bill_id === bill.bill_id ? updatedBill : b));
            setSelectedBillForPayment(null);
        } catch (err) {
            setError(err.message);
            console.error('Error adding payment:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- RENDERING ---
    if (isLoading && purchaseBills.length === 0) {
        return <div className="purchase-bill-page"><h1>Loading Purchase Bills...</h1></div>;
    }

    if (error && !isAddingNew) {
        return <div className="purchase-bill-page"><h1 style={{ color: 'red' }}>Error: {error}</h1></div>;
    }

    if (isAddingNew) {
        return (
            <AddPurchaseBillForm
                newBill={newBill}
                setNewBill={setNewBill}
                newBillTotal={newBillTotal}
                vendors={vendors}
                products={filteredProducts}
                paymentSources={paymentSources}
                handleProductChange={handleProductChange}
                addProductRow={addProductRow}
                removeProductRow={removeProductRow}
                handleFormSubmit={handleFormSubmit}
                onCancel={() => {
                    setNewBill(initialBillState);
                    setIsAddingNew(false);
                    setError(null);
                }}
                isLoading={isLoading} // Pass isLoading as a prop
            />
        );
    }

    return (
        <div className="purchase-bill-page">
            <h1>Purchase Bills (Payables)</h1>

            {error && <p className="error-message" style={{ color: 'red', margin: '10px 0' }}>{error}</p>}

            <div className="list-actions">
                <h2>All Purchase Bills</h2>
                <button className="add-btn" onClick={() => setIsAddingNew(true)} disabled={isLoading}>
                    + Add New Purchase Bill
                </button>
            </div>

            <PurchaseBillList
                bills={purchaseBills}
                onSelectBillForPayment={setSelectedBillForPayment}
            />

            {selectedBillForPayment && (
                <PaymentModal
                    bill={selectedBillForPayment}
                    sources={paymentSources}
                    onPay={handlePayAmount}
                    onClose={() => setSelectedBillForPayment(null)}
                />
            )}
        </div>
    );
}

// 1. Purchase Bill List Component
const PurchaseBillList = ({ bills, onSelectBillForPayment }) => (
    <table className="purchase-bill-table">
        <thead>
            <tr>
                <th>Invoice No.</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>
            {bills.length > 0 ? (
                bills.sort((a, b) => new Date(b.date) - new Date(a.date)).map(bill => (
                    <tr key={bill.bill_id}>
                        <td>{bill.invoice_no}</td>
                        <td>{bill.vendor_name}</td>
                        <td>{bill.date}</td>
                        <td>{bill.total_amount.toLocaleString()}</td>
                        <td>{bill.paid_amount.toLocaleString()}</td>
                        <td><strong className={bill.balance > 0 ? 'text-red' : 'text-green'}>{bill.balance.toLocaleString()}</strong></td>
                        <td><span className={`status-${bill.balance === 0 ? 'paid' : 'credit'}`}>{bill.balance === 0 ? 'Paid' : 'Credit'}</span></td>
                        <td>
                            {bill.balance > 0 && (
                                <button
                                    className="pay-btn"
                                    onClick={() => onSelectBillForPayment(bill)}
                                >
                                    Pay Now
                                </button>
                            )}
                        </td>
                    </tr>
                ))
            ) : (
                <tr><td colSpan="8" className="empty-row-msg">No purchase bills recorded.</td></tr>
            )}
        </tbody>
    </table>
);

// 2. Add Purchase Bill Form
const AddPurchaseBillForm = ({ newBill, setNewBill, newBillTotal, vendors, products, paymentSources, handleProductChange, addProductRow, removeProductRow, handleFormSubmit, onCancel, isLoading }) => {
    const maxPayment = newBillTotal > 0 ? newBillTotal : 0;

    return (
        <div className="add-bill-container">
            <h1>Add New Purchase Bill</h1>
            <form onSubmit={handleFormSubmit} className="bill-form">
                {/* --- HEADER DETAILS --- */}
                <div className="form-group-row">
                    <div className="form-group">
                        <label>Vendor:</label>
                        <select
                            value={newBill.vendorId}
                            onChange={(e) => {
                                setNewBill({
                                    ...newBill,
                                    vendorId: e.target.value,
                                    products: [{ productId: '', qty: 1, price: 0, total: 0 }]
                                });
                            }}
                            required
                            disabled={isLoading}
                        >
                            <option value="">Select Vendor</option>
                            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Invoice No. (Manual):</label>
                        <input
                            type="text"
                            value={newBill.invoiceNo}
                            onChange={(e) => setNewBill({ ...newBill, invoiceNo: e.target.value })}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label>Bill Date:</label>
                        <input
                            type="date"
                            value={newBill.date}
                            onChange={(e) => setNewBill({ ...newBill, date: e.target.value })}
                            required
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {/* --- PRODUCTS TABLE --- */}
                <h3>Products Purchased</h3>
                <table className="products-input-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Qty</th>
                            <th>Price (Unit)</th>
                            <th>Total</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {newBill.products.map((item, index) => (
                            <tr key={index}>
                                <td>
                                    <select
                                        value={item.productId}
                                        onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                                        required
                                        disabled={!newBill.vendorId || isLoading}
                                    >
                                        <option value="">Select Product</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.qty}
                                        onChange={(e) => handleProductChange(index, 'qty', parseInt(e.target.value) || 0)}
                                        disabled={isLoading}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        min="0"
                                        value={item.price}
                                        onChange={(e) => handleProductChange(index, 'price', parseFloat(e.target.value) || 0)}
                                        disabled={isLoading}
                                    />
                                </td>
                                <td>PKR {item.total.toLocaleString()}</td>
                                <td>
                                    <button
                                        type="button"
                                        className="remove-btn"
                                        onClick={() => removeProductRow(index)}
                                        disabled={newBill.products.length === 1 || isLoading}
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button type="button" className="add-row-btn" onClick={addProductRow} disabled={!newBill.vendorId || isLoading}>
                    + Add Product Line
                </button>

                {/* --- TOTALS AND PAYMENT --- */}
                <div className="bill-summary-payment">
                    <div className="bill-summary">
                        <p>Subtotal: <strong>PKR {newBillTotal.toLocaleString()}</strong></p>
                        <p className="grand-total">GRAND TOTAL: <strong>PKR {newBillTotal.toLocaleString()}</strong></p>
                    </div>

                    <div className="payment-options">
                        <h4>Payment Mode</h4>
                        <div className="form-group-row payment-type-radios">
                            <label><input
                                type="radio"
                                name="paymentType"
                                value="Cash"
                                checked={newBill.paymentType === 'Cash'}
                                onChange={(e) => setNewBill({ ...newBill, paymentType: e.target.value, paymentAmount: newBillTotal })}
                                disabled={isLoading}
                            /> Cash (Full)</label>
                            <label><input
                                type="radio"
                                name="paymentType"
                                value="Credit"
                                checked={newBill.paymentType === 'Credit'}
                                onChange={(e) => setNewBill({ ...newBill, paymentType: e.target.value, paymentAmount: 0 })}
                                disabled={isLoading}
                            /> Credit (Full)</label>
                            <label><input
                                type="radio"
                                name="paymentType"
                                value="Cash+Credit"
                                checked={newBill.paymentType === 'Cash+Credit'}
                                onChange={(e) => setNewBill({ ...newBill, paymentType: e.target.value, paymentAmount: 0 })}
                                disabled={isLoading}
                            /> Cash + Credit</label>
                        </div>

                        {(newBill.paymentType === 'Cash' || newBill.paymentType === 'Cash+Credit') && (
                            <>
                                <div className="form-group-row">
                                    <div className="form-group half-width">
                                        <label>Source of Pay:</label>
                                        <select
                                            value={newBill.paymentSource}
                                            onChange={(e) => setNewBill({ ...newBill, paymentSource: e.target.value })}
                                            required
                                            disabled={isLoading}
                                        >
                                            {paymentSources.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>

                                    {newBill.paymentType === 'Cash+Credit' && (
                                        <div className="form-group half-width">
                                            <label>Paid Amount:</label>
                                            <input
                                                type="number"
                                                max={maxPayment}
                                                min="1"
                                                value={newBill.paymentAmount}
                                                onChange={(e) => setNewBill({ ...newBill, paymentAmount: parseFloat(e.target.value) || 0 })}
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Payment Reference No. (PR No.):</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Bank Txn ID, Cheque No., etc."
                                        value={newBill.initialPrNumber}
                                        onChange={(e) => setNewBill({ ...newBill, initialPrNumber: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* --- ACTIONS --- */}
                <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={onCancel} disabled={isLoading}>Cancel</button>
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={!newBill.vendorId || !newBill.invoiceNo || newBillTotal <= 0 || isLoading}
                    >
                        {isLoading ? 'Recording...' : 'Record Purchase Bill'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// 3. Payment Modal
const PaymentModal = ({ bill, sources, onPay, onClose }) => {
    const [payAmount, setPayAmount] = useState(bill.balance);
    const [paySource, setPaySource] = useState(sources[0] || 'Cash');
    const [prNumber, setPrNumber] = useState('');

    const handlePay = () => {
        onPay(bill, parseFloat(payAmount), paySource, prNumber);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content payment-modal" onClick={e => e.stopPropagation()}>
                <h3>Pay Outstanding Balance for Bill #{bill.invoice_no}</h3>
                <p>Vendor: <strong>{bill.vendor_name}</strong></p>
                <p>Remaining Balance: <strong className="text-red">PKR {bill.balance.toLocaleString()}</strong></p>

                <div className="form-group">
                    <label>Amount to Pay:</label>
                    <input
                        type="number"
                        min="1"
                        max={bill.balance}
                        value={payAmount}
                        onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                    />
                </div>

                <div className="form-group">
                    <label>Source of Pay:</label>
                    <select
                        value={paySource}
                        onChange={(e) => setPaySource(e.target.value)}
                    >
                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label>Payment Reference No. (PR No.):</label>
                    <input
                        type="text"
                        placeholder="e.g., Bank Txn ID, Cheque No., etc."
                        value={prNumber}
                        onChange={(e) => setPrNumber(e.target.value)}
                    />
                </div>

                <div className="modal-actions">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button
                        className="submit-btn"
                        onClick={handlePay}
                        disabled={payAmount <= 0 || payAmount > bill.balance}
                    >
                        Confirm Payment (PKR {payAmount.toLocaleString()})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseBillPage;