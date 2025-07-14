import React, { useState, useEffect } from 'react';
import { stockPurchases } from '../services/api';
import AddStockPurchaseForm from '../components/AddStockPurchaseForm';
import PurchaseInvoiceDetailModal from '../components/PurchaseInvoiceDetailModal';
import PayCreditModal from '../components/PayCreditModal';
import EditStockEntryModal from '../components/EditStockEntryModal';

const StockPurchasesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [showPayCreditModal, setShowPayCreditModal] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState(null);
  const [showEditStockModal, setShowEditStockModal] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await stockPurchases.getAllPurchases();
      setInvoices(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching stock purchase invoices:', err);
      setError('Failed to load stock purchase invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleAddSuccess = () => {
    fetchInvoices();
  };

  const handleViewDetails = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
  };

  const handleCloseDetails = () => {
    setSelectedInvoiceId(null);
  };

  const handlePayCreditClick = (invoice) => {
    setInvoiceToPay(invoice);
    setShowPayCreditModal(true);
  };

  const handlePayCreditSuccess = () => {
    setShowPayCreditModal(false);
    setInvoiceToPay(null);
    fetchInvoices();
  };

  const handleEditStockClick = (invoiceId) => {
    setEditInvoiceId(invoiceId);
    setShowEditStockModal(true);
  };

  const handleEditStockSuccess = () => {
    setShowEditStockModal(false);
    setEditInvoiceId(null);
    fetchInvoices();
  };

  const handleCloseEditStock = () => {
    setShowEditStockModal(false);
    setEditInvoiceId(null);
  };

  if (loading) return <div>Loading Stock Purchases...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Stock Purchase Invoices</h1>
      <button
        onClick={() => setShowAddForm(true)}
        style={{
          marginBottom: '20px',
          padding: '10px 15px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Record New Stock Purchase
      </button>

      {showAddForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
              width: '80%',
              maxWidth: '900px',
            }}
          >
            <AddStockPurchaseForm onClose={() => setShowAddForm(false)} onSuccess={handleAddSuccess} />
          </div>
        </div>
      )}

      {selectedInvoiceId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
              width: '80%',
              maxWidth: '800px',
            }}
          >
            <PurchaseInvoiceDetailModal invoiceId={selectedInvoiceId} onClose={handleCloseDetails} />
          </div>
        </div>
      )}

      {showPayCreditModal && invoiceToPay && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
              width: '50%',
              maxWidth: '600px',
            }}
          >
            <PayCreditModal
              invoice={invoiceToPay}
              onClose={() => setShowPayCreditModal(false)}
              onSuccess={handlePayCreditSuccess}
            />
          </div>
        </div>
      )}

      {showEditStockModal && editInvoiceId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxHeight: '90vh',
              overflowY: 'auto',
              width: '80%',
              maxWidth: '900px',
            }}
          >
            <EditStockEntryModal
              invoiceId={editInvoiceId}
              onClose={handleCloseEditStock}
              onSuccess={handleEditStockSuccess}
            />
          </div>
        </div>
      )}

      <table
        style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
              Invoice ID
            </th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
              Vendor
            </th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
              Date
            </th>
            <th
              style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}
            >
              Total Amount
            </th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
              Payment Method
            </th>
            <th
              style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}
            >
              Amount Paid
            </th>
            <th
              style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}
            >
              Credit Due
            </th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>
              Due Date
            </th>
            <th
              style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {invoice.invoice_number}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {invoice.vendor_name}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {new Date(invoice.purchase_date).toLocaleDateString()}
              </td>
              <td
                style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}
              >
                ${invoice.total_bill_amount}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {invoice.payment_method.replace(/_/g, ' ').toUpperCase()}
              </td>
              <td
                style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}
              >
                ${invoice.amount_paid}
              </td>
              <td
                style={{
                  border: '1px solid #ddd',
                  padding: '8px',
                  textAlign: 'right',
                  color: invoice.credit_amount > 0 ? 'red' : 'green',
                }}
              >
                ${invoice.credit_amount}
              </td>
              <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                {invoice.credit_due_date
                  ? new Date(invoice.credit_due_date).toLocaleDateString()
                  : 'N/A'}
              </td>
              <td
                style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}
              >
                <button
                  onClick={() => handleViewDetails(invoice.id)}
                  style={{
                    marginRight: '5px',
                    padding: '5px 10px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View
                </button>
                {invoice.credit_amount > 0 && (
                  <button
                    onClick={() => handlePayCreditClick(invoice)}
                    style={{
                      marginRight: '5px',
                      padding: '5px 10px',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Pay Credit
                  </button>
                )}
                <button
                  onClick={() => handleEditStockClick(invoice.id)}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Edit Stock
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockPurchasesPage;