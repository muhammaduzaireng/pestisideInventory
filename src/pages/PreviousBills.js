import React, { useState, useEffect } from "react";
import './PreviousBills.css';
import AddCustomerPage from './AddCustomerPage';

import { API_BASE_URL } from '../config/api';

export default function PreviousBillsPage() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [previousBillNumber, setPreviousBillNumber] = useState("");
    const [diaryNumber, setDiaryNumber] = useState("");
    const [balance, setBalance] = useState("");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("success");
    const [view, setView] = useState("form");

    // Fetch customers
    useEffect(() => {
        fetch(`${API_BASE_URL}/customers`)
            .then(res => res.json())
            .then(data => setCustomers(data))
            .catch(err => console.error(err));
    }, []);

    // Add previous bill
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedCustomer || !previousBillNumber || !diaryNumber || !balance) {
            setMessageType("error");
            setMessage("All fields are required!");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/customers/${selectedCustomer}/previous-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        previous_bill_number: previousBillNumber,      // matches backend
        previous_diary_number: diaryNumber,            // matches backend
        amount: parseFloat(balance)                    // matches backend
    })
});


            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add previous bill");

            setMessageType("success");
            setMessage("Previous bill added successfully!");
            setPreviousBillNumber("");
            setDiaryNumber("");
            setBalance("");

        } catch (err) {
            setMessageType("error");
            setMessage(err.message || "Failed to add previous bill");
        }
    };

    // Callback after adding a new customer
    const handleCustomerSaved = (newCustomer) => {
        setCustomers(prev => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer.customer_id);
        setView("form");
    };

    if (view === "addCustomer") {
        return <AddCustomerPage onSaveSuccess={handleCustomerSaved} onBack={() => setView("form")} />;
    }

    return (
        <div className="previous-bills-page">
            <h2>Add Previous Bill</h2>

            {message && (
                <p className={`message ${messageType === "error" ? "error" : "success"}`}>
                    {message}
                </p>
            )}

            <form className="previous-bill-form" onSubmit={handleSubmit}>
  <div className="form-group">
    <label>Select Customer</label>
    <div className="customer-select-wrapper">
      <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
        <option value="">-- Select Customer --</option>
        {customers.map(c => (
          <option key={c.customer_id} value={c.customer_id}>
            {c.name} {c.phone ? `- ${c.phone}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="add-customer-btn"
        onClick={() => setView("addCustomer")}
      >
        + Add Customer
      </button>
    </div>
  </div>

  <div className="form-group">
    <label>Previous Bill Number</label>
    <input
      type="text"
      value={previousBillNumber}
      onChange={e => setPreviousBillNumber(e.target.value)}
      placeholder="Enter previous bill number"
      required
    />
  </div>

  <div className="form-group">
    <label>Diary Number</label>
    <input
      type="text"
      value={diaryNumber}
      onChange={e => setDiaryNumber(e.target.value)}
      placeholder="Enter diary number"
      required
    />
  </div>

  <div className="form-group">
    <label>Balance Amount</label>
    <input
      type="number"
      value={balance}
      onChange={e => setBalance(e.target.value)}
      placeholder="Enter balance amount"
      step="0.01"
      required
    />
  </div>

  <button type="submit" className="submit-btn">Add Previous Bill</button>
</form>

        </div>
    );
}
