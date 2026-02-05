import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './VendorAccountsPage.css';

// --- API Configuration ---
const API_BASE_URL = 'http://api.devzytic.com/api';

// --- COMPONENTS ---

// Invoice Detail Modal Content
const InvoiceDetail = ({ invoice }) => (
  <div className="invoice-detail-box">
    <h4>Invoice #{invoice.id} Details</h4>
    <p>Date: <strong>{invoice.date}</strong> | Status: <span className={`status-${invoice.status.toLowerCase()}`}>{invoice.status}</span></p>
    
    <h5>Products</h5>
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
        {invoice.products.map((p, index) => (
          <tr key={index}>
            <td>{p.name}</td>
            <td>{p.qty} {p.unit || 'Unit'}</td>
            <td>PKR {p.price.toLocaleString()}</td>
            <td>PKR {(p.qty * p.price).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <h5>Payment History</h5>
    {invoice.payments.length > 0 ? (
      <table className="payment-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Source</th>
            <th>PR Number</th>
          </tr>
        </thead>
        <tbody>
          {invoice.payments.map((p, index) => (
            <tr key={index}>
              <td>{p.date}</td>
              <td>PKR {p.amount.toLocaleString()}</td>
              <td>{p.source}</td>
              <td>{p.prNumber || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p>No payments recorded for this invoice.</p>
    )}
    
    <div className="invoice-totals">
      <p>Total Bill: <strong>PKR {invoice.totalAmount.toLocaleString()}</strong></p>
      <p className="paid">Paid: <strong>PKR {invoice.paidAmount.toLocaleString()}</strong></p>
      <p className="credit">Credit Remaining: <strong>PKR {(invoice.totalAmount - invoice.paidAmount).toLocaleString()}</strong></p>
    </div>
  </div>
);

// Payment Modal Content
const PaymentModal = ({ invoice, onClose, onSubmit }) => {
  const remainingBalance = invoice.totalAmount - invoice.paidAmount;
  const [payment, setPayment] = useState({
    amount: remainingBalance.toFixed(2), // Default to remaining balance
    source: 'Cash',
    date: new Date().toISOString().split('T')[0],
    prNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const amount = parseFloat(payment.amount);
    if (!amount || amount <= 0) {
      setError('Amount must be a positive number.');
      setIsSubmitting(false);
      return;
    }
    if (amount > remainingBalance) {
      setError(`Payment amount (PKR ${amount.toLocaleString()}) exceeds remaining balance (PKR ${remainingBalance.toLocaleString()}).`);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/purchase_bills/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          source: payment.source,
          date: payment.date,
          prNumber: payment.prNumber || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add payment');
      }

      const updatedInvoice = await response.json();
      onSubmit(updatedInvoice); // Update invoice with new payment data
      onClose();
    } catch (err) {
      setError(err.message);
      console.error('Error adding payment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content payment-modal" onClick={e => e.stopPropagation()}>
        <h3>Add Payment for Invoice #{invoice.invoice_no}</h3>
        <p>Remaining Balance: <strong className="text-red">PKR {remainingBalance.toLocaleString()}</strong></p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Amount (PKR)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              value={payment.amount}
              onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Payment Source</label>
            <select
              value={payment.source}
              onChange={(e) => setPayment({ ...payment, source: e.target.value })}
              required
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={payment.date}
              onChange={(e) => setPayment({ ...payment, date: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>PR Number (Optional)</label>
            <input
              type="text"
              value={payment.prNumber}
              onChange={(e) => setPayment({ ...payment, prNumber: e.target.value })}
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Add Payment'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function VendorAccountsPage() {
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch vendors and invoices
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [vendorsRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/purchase_bills/vendors`),
        fetch(`${API_BASE_URL}/purchase_bills`)
      ]);

      if (!vendorsRes.ok || !invoicesRes.ok) {
        throw new Error('Failed to fetch data from API');
      }

      const vendorsData = await vendorsRes.json();
      const invoicesData = await invoicesRes.json();

      // Transform invoices to match frontend expected format
      const transformedInvoices = invoicesData.map(invoice => ({
        id: invoice.bill_id,
        invoice_no: invoice.invoice_no,
        vendorId: invoice.vendor_id,
        date: new Date(invoice.date).toISOString().split('T')[0],
        totalAmount: parseFloat(invoice.total_amount),
        paidAmount: parseFloat(invoice.paid_amount),
        status: invoice.balance === 0 ? 'Paid' : 'Credit',
        products: invoice.products.map(product => ({
          name: product.name,
          qty: product.qty,
          price: parseFloat(product.price),
          unit: product.unit || 'Unit'
        })),
        payments: invoice.payments || []
      }));

      setVendors(vendorsData);
      setInvoices(transformedInvoices);
      setSelectedVendorId(vendorsData[0]?.id || null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle payment submission
  const handlePaymentSubmit = useCallback((updatedInvoice) => {
    setInvoices(prevInvoices =>
      prevInvoices.map(inv =>
        inv.id === updatedInvoice.bill_id
          ? {
              ...inv,
              totalAmount: parseFloat(updatedInvoice.total_amount),
              paidAmount: parseFloat(updatedInvoice.paid_amount),
              status: updatedInvoice.balance === 0 ? 'Paid' : 'Credit',
              payments: updatedInvoice.payments || []
            }
          : inv
      )
    );
  }, []);

  const selectedVendor = useMemo(() => {
    return vendors.find(v => v.id === selectedVendorId);
  }, [vendors, selectedVendorId]);

  const vendorInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.vendorId === selectedVendorId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [invoices, selectedVendorId]);

  // Financial Summary Calculation
  const financialSummary = useMemo(() => {
    const totalAmount = vendorInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = vendorInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalCredit = totalAmount - totalPaid;

    return { totalAmount, totalPaid, totalCredit };
  }, [vendorInvoices]);

  // --- RENDERING ---
  if (isLoading) {
    return (
      <div className="vendor-accounts-page">
        <h1>Vendor Accounts Overview</h1>
        <p>Loading vendors and invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vendor-accounts-page">
        <h1>Vendor Accounts Overview</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
      </div>
    );
  }

  if (!selectedVendor) {
    return (
      <div className="vendor-accounts-page">
        <h1>Vendor Accounts Overview</h1>
        <p>No vendors available. Please add vendors to view their financial details.</p>
      </div>
    );
  }

  return (
    <div className="vendor-accounts-page">
      <h1>Vendor Accounts Overview</h1>

      <div className="account-master-detail">
        {/* Left Side: Vendor List */}
        <div className="vendor-list-master">
          <h2>Select Vendor</h2>
          <ul className="vendor-selector-list">
            {vendors.map(vendor => (
              <li 
                key={vendor.id} 
                className={vendor.id === selectedVendorId ? 'active' : ''}
                onClick={() => {
                  setSelectedVendorId(vendor.id);
                  setSelectedInvoice(null);
                  setPaymentInvoice(null);
                }}
              >
                {vendor.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side: Account Details */}
        <div className="vendor-account-detail">
          <h2>Account Details for {selectedVendor.name}</h2>
          
          {/* Financial Summary Box */}
          <div className="summary-cards">
            <div className="card total">
              <h3>Total Business</h3>
              <p>PKR {financialSummary.totalAmount.toLocaleString()}</p>
            </div>
            <div className="card paid">
              <h3>Total Paid</h3>
              <p>PKR {financialSummary.totalPaid.toLocaleString()}</p>
            </div>
            <div className="card credit">
              <h3>Total Credit</h3>
              <p>PKR {financialSummary.totalCredit.toLocaleString()}</p>
            </div>
          </div>

          {/* Invoice History Table */}
          <h3>Invoice History ({vendorInvoices.length})</h3>
          <table className="invoices-history-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Credit</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {vendorInvoices.length > 0 ? (
                vendorInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_no}</td>
                    <td>{inv.date}</td>
                    <td>{inv.totalAmount.toLocaleString()}</td>
                    <td>{inv.paidAmount.toLocaleString()}</td>
                    <td>{(inv.totalAmount - inv.paidAmount).toLocaleString()}</td>
                    <td><span className={`status-${inv.status.toLowerCase()}`}>{inv.status}</span></td>
                    <td>
                      <button 
                        className="view-btn" 
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        View Details
                      </button>
                      {inv.status === 'Credit' && (
                        <button
                          className="pay-btn"
                          onClick={() => setPaymentInvoice(inv)}
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="empty-row-msg">No invoices found for this vendor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <InvoiceDetail invoice={selectedInvoice} />
            <button className="modal-close-btn" onClick={() => setSelectedInvoice(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  );
}

export default VendorAccountsPage;