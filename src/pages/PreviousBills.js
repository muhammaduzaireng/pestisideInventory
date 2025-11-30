import React, { useState, useEffect } from "react";
import './PreviousBills.css';
import AddCustomerPage from './AddCustomerPage';

const API_BASE_URL = "https://api.devzytic.com/api";

export default function PreviousBillsPage() {
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [billNumber, setBillNumber] = useState("");
    const [diaryNumber, setDiaryNumber] = useState("");
    const [outstanding, setOutstanding] = useState("");
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
        if (!selectedCustomer || !billNumber || !diaryNumber || !outstanding) {
            setMessageType("error");
            setMessage("All fields are required!");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/customers/${selectedCustomer}/previous-bill`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    previous_bill_number: billNumber,
                    previous_diary_number: diaryNumber,
                    outstanding_amount: parseFloat(outstanding)
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to add previous bill");

            setMessageType("success");
            setMessage("Previous bill added successfully!");
            setBillNumber("");
            setDiaryNumber("");
            setOutstanding("");
        } catch (err) {
            setMessageType("error");
            setMessage(err.message || "Failed to add previous bill");
        }
    };

    // Callback after adding customer
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
            {message && <p className={messageType === "error" ? "error" : "success"}>{message}</p>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Select Customer</label>
                    <div className="customer-select-container">
                        <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                            <option value="">-- Select Customer --</option>
                            {customers.map(c => (
                                <option key={c.customer_id} value={c.customer_id}>
                                    {c.name} {c.phone ? `- ${c.phone}` : ""}
                                </option>
                            ))}
                        </select>
                        <button type="button" className="add-customer-btn" onClick={() => setView("addCustomer")}>
                            + Add Customer
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label>Bill Number</label>
                    <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Enter previous bill number" />
                </div>

                <div className="form-group">
                    <label>Diary Number</label>
                    <input type="text" value={diaryNumber} onChange={e => setDiaryNumber(e.target.value)} placeholder="Enter diary number" />
                </div>

                <div className="form-group">
                    <label>Outstanding Amount</label>
                    <input type="number" value={outstanding} onChange={e => setOutstanding(e.target.value)} placeholder="Enter amount" />
                </div>

                <button type="submit">Add Previous Bill</button>
            </form>
        </div>
    );
}
