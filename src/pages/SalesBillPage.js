import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './SalesBillPage.css';

// --- API CONFIGURATION ---
const API_BASE_URL = 'http://localhost:5002/api';

function SalesBillPage() {
  const [salesBills, setSalesBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [paymentSources, setPaymentSources] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillForCollection, setSelectedBillForCollection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch sales bills, customers, and payment sources
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [billsRes, customersRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/sale_bills`),
        fetch(`${API_BASE_URL}/customers`),
        fetch(`${API_BASE_URL}/sale_bills/payment_sources`),
      ]);

      if (!billsRes.ok || !customersRes.ok || !sourcesRes.ok) {
        throw new Error('Failed to fetch data from API');
      }

      const billsData = await billsRes.json();
      const customersData = await customersRes.json();
      const sourcesData = await sourcesRes.json();

      // Transform bills to match frontend expected format
      const transformedBills = billsData.map(bill => ({
        billId: bill.bill_id,
        invoiceNo: bill.bill_number,
        customerId: bill.customer_id,
        customerName: bill.customer_name || customersData.find(c => c.customer_id === bill.customer_id)?.name || 'Unknown',
        date: bill.date,
        totalAmount: parseFloat(bill.total_amount),
        receivedAmount: parseFloat(bill.paid_amount),
        balance: parseFloat(bill.balance),
        status: bill.balance == 0 ? 'Paid' : bill.paid_amount > 0 ? 'Partial' : 'Unpaid',
        collections: bill.payments.map(payment => ({
          amount: parseFloat(payment.amount),
          source: payment.source,
          date: payment.date,
        })),
      }));

      setSalesBills(transformedBills);
      setCustomers(customersData);
      setPaymentSources(sourcesData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Could not connect to the backend server or API failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle payment collection
  const handleCollectPayment = async (bill, collectionAmount, collectionSource) => {
    if (collectionAmount <= 0 || collectionAmount > bill.balance) {
      alert('Invalid collection amount. Must be positive and not exceed the balance.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sale_bills/${bill.billId}/payments`, {
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

      // Refetch data to update UI
      await fetchData();
      setSelectedBillForCollection(null);
    } catch (err) {
      console.error('Error adding payment:', err);
      alert('Failed to add payment: ' + err.message);
    }
  };

  // Filter bills based on search term (customer name or invoice number)
  const filteredBills = useMemo(() => {
    const lowerCaseSearch = searchTerm.toLowerCase();
    return salesBills.filter(bill =>
      bill.customerName.toLowerCase().includes(lowerCaseSearch) ||
      bill.invoiceNo.toLowerCase().includes(lowerCaseSearch)
    );
  }, [salesBills, searchTerm]);

  // --- RENDERING ---
  if (isLoading) {
    return (
      <div className="sales-bill-page">
        <h1>Sales Bill Collections (Receivables)</h1>
        <p>Loading sales bills...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sales-bill-page">
        <h1>Sales Bill Collections (Receivables)</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="sales-bill-page">
      <h1>Sales Bill Collections (Receivables)</h1>

      <div className="list-controls">
        <input
          type="text"
          placeholder="Search by Customer or Invoice No..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <SalesBillList 
        bills={filteredBills} 
        onSelectBillForCollection={setSelectedBillForCollection}
      />
      
      {selectedBillForCollection && (
        <CollectionModal
          bill={selectedBillForCollection}
          sources={paymentSources}
          onCollect={handleCollectPayment}
          onClose={() => setSelectedBillForCollection(null)}
        />
      )}
    </div>
  );
}

// --- SUB-COMPONENTS ---

// 1. Sales Bill List Component
const SalesBillList = ({ bills, onSelectBillForCollection }) => (
  <table className="sales-bill-table">
    <thead>
      <tr>
        <th>Invoice No.</th>
        <th>Customer</th>
        <th>Date</th>
        <th>Total Amount</th>
        <th>Received Amount</th>
        <th>Balance Due</th>
        <th>Status</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {bills.length > 0 ? (
        bills.sort((a, b) => new Date(b.date) - new Date(a.date)).map(bill => (
          <tr key={bill.billId}>
            <td>{bill.invoiceNo}</td>
            <td>{bill.customerName}</td>
            <td>{bill.date}</td>
            <td>{bill.totalAmount.toLocaleString()}</td>
            <td>{bill.receivedAmount.toLocaleString()}</td>
            <td><strong className={bill.balance > 0 ? 'text-red' : 'text-green'}>{bill.balance.toLocaleString()}</strong></td>
            <td><span className={`status-${bill.status.toLowerCase()}`}>{bill.status}</span></td>
            <td>
              {bill.balance > 0 && (
                <button 
                  className="collect-btn" 
                  onClick={() => onSelectBillForCollection(bill)}
                >
                  Collect Payment
                </button>
              )}
            </td>
          </tr>
        ))
      ) : (
        <tr><td colSpan="8" className="empty-row-msg">No sales bills match your criteria.</td></tr>
      )}
    </tbody>
  </table>
);

// 2. Collection Modal
const CollectionModal = ({ bill, sources, onCollect, onClose }) => {
  const [collectionAmount, setCollectionAmount] = useState(bill.balance.toFixed(2));
  const [collectionSource, setCollectionSource] = useState(sources[0] || '');
  const [error, setError] = useState(null);

  const handleCollect = () => {
    const amount = parseFloat(collectionAmount);
    if (amount <= 0 || amount > bill.balance) {
      setError(`Amount must be positive and not exceed PKR ${bill.balance.toLocaleString()}.`);
      return;
    }
    setError(null);
    onCollect(bill, amount, collectionSource);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content collection-modal" onClick={e => e.stopPropagation()}>
        <h3>Receive Payment for Bill #{bill.invoiceNo}</h3>
        <p>Customer: <strong>{bill.customerName}</strong></p>
        <p>Outstanding Balance: <strong className="text-red">PKR {bill.balance.toLocaleString()}</strong></p>
        {error && <p className="error-message">{error}</p>}
        
        <div className="form-group">
          <label>Amount to Collect (PKR):</label>
          <input 
            type="number"
            min="0.01"
            max={bill.balance}
            step="0.01"
            value={collectionAmount}
            onChange={(e) => setCollectionAmount(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Source of Collection:</label>
          <select 
            value={collectionSource} 
            onChange={(e) => setCollectionSource(e.target.value)}
            required
          >
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="submit-btn" 
            onClick={handleCollect}
            disabled={collectionAmount <= 0 || collectionAmount > bill.balance}
          >
            Confirm Collection (PKR {parseFloat(collectionAmount).toLocaleString()})
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesBillPage;