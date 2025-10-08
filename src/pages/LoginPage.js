// src/pages/LoginPage.js

import React from 'react';
import './LoginPage.css'; // You'll create this CSS file

function LoginPage({ onLogin }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    // 1. In a real app, you would send credentials to an API here.
    // 2. On success, call the onLogin function to update the state.
    console.log("Login attempt...");
    onLogin(); // Mock successful login
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Farid Zari Corporation - Login</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" required />
          <input type="password" placeholder="Password" required />
          <button type="submit">Log In</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;