import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './CustomerAccountsPage.css';
import AddCustomerPage from './AddCustomerPage';

// --- API CONFIGURATION ---
import { API_BASE_URL } from '../config/api';

// --- HELPER: CLEAN DATE FORMATTER ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

// --- COMPONENTS ---

const OrderDetail = ({ order }) => (
    <div className="order-detail-box">
        <h4>Sales Order #{order.bill_number} Details</h4>
        <p>
            Bill Number: <strong>{order.bill_number || 'N/A'}</strong>
            {order.diary_number && (
                <> | Diary Number: <strong>{order.diary_number}</strong></>
            )}
        </p>
        <p>
            Date: <strong>{formatDate(order.date)}</strong> | Status:{' '}
            <span className={`status-${order.status.toLowerCase()}`}>{order.status}</span>
        </p>

        {order.products && order.products.length > 0 ? (
            <table className="product-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {order.products.map((p, index) => (
                        <tr key={index}>
                            <td>{p.name}</td>
                            <td>{p.qty} {p.unit}</td>
                            <td>PKR {parseFloat(p.sale_price).toLocaleString()}</td>
                            <td>PKR {(p.qty * p.sale_price).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) : (
            <p style={{ fontStyle: 'italic', color: '#666', margin: '10px 0' }}>
                Previous / Manual Bill Entry
            </p>
        )}

        <div className="order-totals">
            <p>Total Sale: <strong>PKR {parseFloat(order.total_amount).toLocaleString()}</strong></p>
            <p className="paid">Amount Received: <strong>PKR {parseFloat(order.paid_amount).toLocaleString()}</strong></p>
            <p className="credit">Outstanding Balance: <strong>PKR {parseFloat(order.balance).toLocaleString()}</strong></p>
        </div>

        {order.payments && order.payments.length > 0 && (
            <div className="collection-history">
                <h5>Collection History</h5>
                {order.payments.map((c, index) => (
                    <p key={index} className="collection-item">
                        {formatDate(c.date)}: PKR {parseFloat(c.amount).toLocaleString()} ({c.source})
                    </p>
                ))}
            </div>
        )}
    </div>
);

const CollectionModal = ({ order, sources, onCollect, onClose, customers }) => {
    const balance = parseFloat(order.balance);
    const [collectionAmount, setCollectionAmount] = useState('');
    const [collectionSource, setCollectionSource] = useState(sources[0] || '');
    const [isCollecting, setIsCollecting] = useState(false);

    const customerName = customers.find(c => c.customer_id === order.customer_id)?.name || 'N/A';
    const numericAmount = parseFloat(collectionAmount) || 0;

    const handleCollect = async () => {
        if (isCollecting) return;
        setIsCollecting(true);
        await onCollect(order, numericAmount, collectionSource);
        setIsCollecting(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content collection-modal" onClick={e => e.stopPropagation()}>
                <h3>Receive Payment for Order #{order.bill_number}</h3>
                <p>Customer: <strong>{customerName}</strong></p>
                <p>Outstanding Balance: <strong className="text-red">PKR {balance.toLocaleString()}</strong></p>

                <div className="form-group">
                    <label>Amount to Collect:</label>
                    <input
                        type="number"
                        min="1"
                        max={balance}
                        step="0.01"
                        placeholder="0"
                        value={collectionAmount}
                        onChange={(e) => setCollectionAmount(e.target.value)}
                        disabled={isCollecting}
                    />
                </div>

                <div className="form-group">
                    <label>Source of Collection:</label>
                    <select
                        value={collectionSource}
                        onChange={(e) => setCollectionSource(e.target.value)}
                        disabled={isCollecting}
                    >
                        {sources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="cancel-btn" onClick={onClose} disabled={isCollecting}>Cancel</button>
                    <button
                        className="submit-btn"
                        onClick={handleCollect}
                        disabled={isCollecting || numericAmount <= 0 || numericAmount > balance}
                    >
                        {isCollecting ? 'Saving...' : `Confirm Collection (PKR ${numericAmount.toLocaleString()})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* --- ADD BILL POPUP MODAL (Uses Selected Customer Automatically, Loading Lock) --- */
const AddBillModal = ({ customer, onSuccess, onClose }) => {
    const [previousBillNumber, setPreviousBillNumber] = useState('');
    const [diaryNumber, setDiaryNumber] = useState('');
    const [balance, setBalance] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;

        if (!previousBillNumber.trim() || !diaryNumber.trim() || !balance) {
            setErrorMessage('All fields are required!');
            return;
        }

        const numericBalance = parseFloat(balance);
        if (isNaN(numericBalance) || numericBalance <= 0) {
            setErrorMessage('Please enter a valid positive balance amount!');
            return;
        }

        setErrorMessage('');
        setIsSaving(true);

        try {
            const res = await fetch(`${API_BASE_URL}/customers/${customer.customer_id}/previous-bill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    previous_bill_number: previousBillNumber.trim(),
                    previous_diary_number: diaryNumber.trim(),
                    amount: numericBalance,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add bill');

            onSuccess();
        } catch (err) {
            setErrorMessage(err.message || 'Failed to add bill');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={() => !isSaving && onClose()}>
            <div className="modal-content collection-modal" onClick={e => e.stopPropagation()}>
                <h3>Add Previous Bill</h3>
                <p>
                    Customer: <strong>{customer.name}</strong>
                    {customer.phone ? ` (${customer.phone})` : ''}
                </p>

                {errorMessage && (
                    <p style={{ color: '#c62828', backgroundColor: '#fde0e0', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {errorMessage}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Previous Bill Number *</label>
                        <input
                            type="text"
                            value={previousBillNumber}
                            onChange={(e) => setPreviousBillNumber(e.target.value)}
                            placeholder="Enter previous bill number"
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Diary Number *</label>
                        <input
                            type="text"
                            value={diaryNumber}
                            onChange={(e) => setDiaryNumber(e.target.value)}
                            placeholder="Enter diary number"
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Balance Amount (PKR) *</label>
                        <input
                            type="number"
                            value={balance}
                            onChange={(e) => setBalance(e.target.value)}
                            placeholder="Enter balance amount"
                            step="0.01"
                            min="0.01"
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onClose}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={isSaving}
                            style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        >
                            {isSaving ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* --- EDIT CUSTOMER MODAL --- */
const EditCustomerModal = ({ customer, onSave, onClose }) => {
    const [name, setName] = useState(customer.name || '');
    const [phone, setPhone] = useState(customer.phone || '');
    const [address, setAddress] = useState(customer.address || '');
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;

        if (!name.trim() || !phone.trim() || !address.trim()) {
            setValidationError('Name, Phone, and Address are all required.');
            return;
        }

        setValidationError('');
        setIsSaving(true);
        await onSave({
            ...customer,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim()
        });
        setIsSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content collection-modal" onClick={e => e.stopPropagation()}>
                <h3>Edit Customer Details</h3>

                {validationError && (
                    <p style={{ color: '#c62828', backgroundColor: '#fde0e0', padding: '8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                        {validationError}
                    </p>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Customer Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSaving}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Phone Number *</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={isSaving}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Address *</label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            disabled={isSaving}
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="cancel-btn" onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={isSaving || !name.trim() || !phone.trim() || !address.trim()}
                        >
                            {isSaving ? 'Saving...' : 'Update Details'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function CustomerAccountsPage() {
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [paymentSources, setPaymentSources] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedOrderForCollection, setSelectedOrderForCollection] = useState(null);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [isAddBillOpen, setIsAddBillOpen] = useState(false);

    const [view, setView] = useState('list');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter states
    const [customerSearch, setCustomerSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // --- FETCH DATA (FIXED: Removed selectedCustomerId dependency so clicking a customer does not reload) ---
    const fetchData = useCallback(async (selectNewId = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const [customersRes, ordersRes, sourcesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/customers`),
                fetch(`${API_BASE_URL}/sale_bills`),
                fetch(`${API_BASE_URL}/sale_bills/payment_sources`),
            ]);

            if (!customersRes.ok || !ordersRes.ok || !sourcesRes.ok) {
                throw new Error('Failed to fetch data from API');
            }

            const customersData = await customersRes.json();
            const ordersData = await ordersRes.json();
            const sourcesData = await sourcesRes.json();

            setCustomers(customersData);
            setOrders(ordersData.map(order => {
                const total = parseFloat(order.total_amount) || 0;
                const paid = parseFloat(order.paid_amount) || 0;
                const bal = parseFloat(order.balance) || 0;
            
                return {
                    id: order.bill_id,
                    // Prioritizes the entered previous_bill_number, falls back to standard bill_number
                    bill_number: order.previous_bill_number || order.bill_number,
                    diary_number: order.previous_diary_number || order.diary_number || null,
                    customer_id: order.customer_id,
                    customerId: order.customer_id,
                    date: order.date,
                    total_amount: total,
                    paid_amount: paid,
                    balance: bal,
                    status: bal > 0 ? 'Balance' : 'Paid',
                    products: (order.products || []).map(p => ({
                        name: p.name,
                        qty: p.qty,
                        sale_price: parseFloat(p.sale_price),
                        unit: p.unit || 'Unit',
                    })),
                    payments: order.payments || [],
                };
            }));
            setPaymentSources(sourcesData);

            setSelectedCustomerId(prevId => {
                if (selectNewId) return selectNewId;
                if (customersData.length === 0) return null;
                if (prevId && customersData.some(c => c.customer_id === prevId)) {
                    return prevId;
                }
                return customersData[0].customer_id;
            });
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Could not connect to the backend server or API failed.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCustomerSaved = useCallback((newCustomer) => {
        fetchData(newCustomer.customer_id);
        setView('list');
    }, [fetchData]);

    // --- UPDATE CUSTOMER API CALL ---
    const handleUpdateCustomer = async (updatedCustomer) => {
        try {
            const response = await fetch(`${API_BASE_URL}/customers/${updatedCustomer.customer_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: updatedCustomer.name,
                    phone: updatedCustomer.phone,
                    address: updatedCustomer.address
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update customer');
            }

            setCustomers(prev => prev.map(c =>
                c.customer_id === updatedCustomer.customer_id ? updatedCustomer : c
            ));
            setEditingCustomer(null);
        } catch (err) {
            console.error('Error updating customer:', err);
            alert('Failed to update customer: ' + err.message);
        }
    };

    const handleCollectPayment = async (order, collectionAmount, collectionSource) => {
        const balance = parseFloat(order.balance);
        if (collectionAmount <= 0 || collectionAmount > balance) {
            alert('Invalid collection amount.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/sale_bills/${order.id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: collectionAmount,
                    source: collectionSource,
                    date: new Date().toISOString().substring(0, 10),
                    pr_number: null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to add payment');
            }

            await fetchData(selectedCustomerId);
            setSelectedOrderForCollection(null);
        } catch (err) {
            console.error('Error adding payment:', err);
            alert('Failed to add payment: ' + err.message);
        }
    };

    // --- FILTERED DATA MEMOS ---
    const filteredCustomers = useMemo(() => {
        const query = customerSearch.toLowerCase().trim();
        if (!query) return customers;
        return customers.filter(c =>
            c.name?.toLowerCase().includes(query) ||
            c.phone?.toString().includes(query)
        );
    }, [customers, customerSearch]);

    const dateFilteredOrders = useMemo(() => {
        return orders.filter(ord => {
            if (!ord.date) return true;
            const orderDateStr = new Date(ord.date).toISOString().substring(0, 10);
            if (startDate && orderDateStr < startDate) return false;
            if (endDate && orderDateStr > endDate) return false;
            return true;
        });
    }, [orders, startDate, endDate]);

    const overallFinancialSummary = useMemo(() => {
        const totalSales = dateFilteredOrders.reduce((sum, ord) => sum + ord.total_amount, 0);
        const totalReceived = dateFilteredOrders.reduce((sum, ord) => sum + ord.paid_amount, 0);
        const totalOutstanding = dateFilteredOrders.reduce((sum, ord) => sum + ord.balance, 0);

        return { totalSales, totalReceived, totalOutstanding };
    }, [dateFilteredOrders]);

    const selectedCustomer = useMemo(() => {
        return customers.find(c => c.customer_id === selectedCustomerId);
    }, [customers, selectedCustomerId]);

    const customerOrders = useMemo(() => {
        return dateFilteredOrders
            .filter(ord => ord.customer_id === selectedCustomerId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [dateFilteredOrders, selectedCustomerId]);

    const customerFinancialSummary = useMemo(() => {
        const totalSales = customerOrders.reduce((sum, ord) => sum + ord.total_amount, 0);
        const totalReceived = customerOrders.reduce((sum, ord) => sum + ord.paid_amount, 0);
        const totalOutstanding = customerOrders.reduce((sum, ord) => sum + ord.balance, 0);

        return { totalSales, totalReceived, totalOutstanding };
    }, [customerOrders]);

    // --- RENDERING ---
    if (view === 'add') {
        return (
            <AddCustomerPage
                onSaveSuccess={handleCustomerSaved}
                onBack={() => setView('list')}
            />
        );
    }

    if (isLoading && customers.length === 0 && orders.length === 0) {
        return <div className="customer-accounts-page"><h1>Loading Accounts...</h1></div>;
    }

    if (error) {
        return <div className="customer-accounts-page"><h1 style={{ color: 'red' }}>Error: {error}</h1></div>;
    }

    return (
        <div className="customer-accounts-page">
            <h1>Customer Accounts Overview (Receivables)</h1>

            {/* Filter Toolbar */}
            <div className="filter-summary-toolbar">
                <div className="date-filter-group">
                    <div className="form-group">
                        <label>From Date:</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>To Date:</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    {(startDate || endDate) && (
                        <button className="clear-btn" onClick={() => { setStartDate(''); setEndDate(''); }}>
                            Clear Filter
                        </button>
                    )}
                </div>

                <div className="summary-cards">
                    <div className="card total">
                        <h3>Overall Total Sales</h3>
                        <p>PKR {overallFinancialSummary.totalSales.toLocaleString()}</p>
                    </div>
                    <div className="card paid">
                        <h3>Overall Total Received</h3>
                        <p>PKR {overallFinancialSummary.totalReceived.toLocaleString()}</p>
                    </div>
                    <div className="card credit">
                        <h3>Overall Outstanding</h3>
                        <p>PKR {overallFinancialSummary.totalOutstanding.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="account-master-detail">
                {/* Left Side: Customer List */}
                <div className="vendor-list-master">
                    <div className="list-header">
                        <h2>Customers ({filteredCustomers.length})</h2>
                        <button className="add-btn" onClick={() => setView('add')}>+ Add New</button>
                    </div>

                    <div className="customer-search-box">
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                    </div>

                    <ul className="vendor-selector-list">
                        {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => (
                                <li
                                    key={customer.customer_id}
                                    className={customer.customer_id === selectedCustomerId ? 'active' : ''}
                                    onClick={() => {
                                        setSelectedCustomerId(customer.customer_id);
                                        setSelectedOrder(null);
                                        setSelectedOrderForCollection(null);
                                    }}
                                >
                                    {customer.name}
                                    <small>{customer.phone}</small>
                                </li>
                            ))
                        ) : (
                            <li className="empty-row-msg">No matching customers found.</li>
                        )}
                    </ul>
                </div>

                {/* Right Side: Details for Selected Customer */}
                <div className="vendor-account-detail">
                    {selectedCustomer ? (
                        <>
                            <div className="customer-detail-header">
                                <div>
                                    <h2>Sales Details for {selectedCustomer.name}</h2>
                                    <p>
                                        Phone: <strong>{selectedCustomer.phone || 'N/A'}</strong> | Address:{' '}
                                        <strong>{selectedCustomer.address || 'N/A'}</strong>
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        className="add-btn"
                                        onClick={() => setIsAddBillOpen(true)}
                                    >
                                        + Add Bill
                                    </button>
                                    <button
                                        className="edit-customer-btn"
                                        onClick={() => setEditingCustomer(selectedCustomer)}
                                    >
                                        ✏️ Edit Customer
                                    </button>
                                </div>
                            </div>

                            <div className="summary-cards">
                                <div className="card total">
                                    <h3>Customer Total Sales</h3>
                                    <p>PKR {customerFinancialSummary.totalSales.toLocaleString()}</p>
                                </div>
                                <div className="card paid">
                                    <h3>Customer Total Received</h3>
                                    <p>PKR {customerFinancialSummary.totalReceived.toLocaleString()}</p>
                                </div>
                                <div className="card credit">
                                    <h3>Customer Outstanding</h3>
                                    <p>PKR {customerFinancialSummary.totalOutstanding.toLocaleString()}</p>
                                </div>
                            </div>

                            <h3>Order History ({customerOrders.length})</h3>
                            <table className="invoices-history-table">
                                <thead>
                                    <tr>
                                        <th>Order #</th>
                                        <th>Date</th>
                                        <th>Sale Total</th>
                                        <th>Received</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerOrders.length > 0 ? (
                                        customerOrders.map(ord => (
                                            <tr key={ord.id}>
                                                <td>{ord.bill_number}</td>
                                                <td>{formatDate(ord.date)}</td>
                                                <td>{parseFloat(ord.total_amount).toLocaleString()}</td>
                                                <td>{parseFloat(ord.paid_amount).toLocaleString()}</td>
                                                <td className={ord.balance > 0 ? 'text-red' : 'text-green'}>
                                                    {parseFloat(ord.balance).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span className={`status-${ord.status.toLowerCase()}`}>
                                                        {ord.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="view-btn"
                                                        onClick={() => setSelectedOrder(ord)}
                                                    >
                                                        View
                                                    </button>
                                                    {ord.balance > 0 && (
                                                        <button
                                                            className="collect-btn"
                                                            onClick={() => setSelectedOrderForCollection(ord)}
                                                        >
                                                            Collect
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="empty-row-msg">
                                                No sales orders found for this customer.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <div className="empty-detail-msg">
                            <p>Select a customer to view account details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {selectedOrder && (
                <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <OrderDetail order={selectedOrder} />
                        <button className="modal-close-btn" onClick={() => setSelectedOrder(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {selectedOrderForCollection && (
                <CollectionModal
                    order={selectedOrderForCollection}
                    sources={paymentSources}
                    onCollect={handleCollectPayment}
                    onClose={() => setSelectedOrderForCollection(null)}
                    customers={customers}
                />
            )}

            {editingCustomer && (
                <EditCustomerModal
                    customer={editingCustomer}
                    onSave={handleUpdateCustomer}
                    onClose={() => setEditingCustomer(null)}
                />
            )}

            {isAddBillOpen && selectedCustomer && (
                <AddBillModal
                    customer={selectedCustomer}
                    onSuccess={() => {
                        setIsAddBillOpen(false);
                        fetchData(selectedCustomer.customer_id);
                    }}
                    onClose={() => setIsAddBillOpen(false)}
                />
            )}
        </div>
    );
}

export default CustomerAccountsPage;