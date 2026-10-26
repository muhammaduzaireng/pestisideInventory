// src/App.js

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';

function App() {
  // Read initial login state from localStorage (Defaults to FALSE)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    return savedUser && token ? JSON.parse(savedUser) : null;
  });

  const isLoggedIn = !!user;

  // Handler for successful login/signup
  const handleLogin = (userData) => {
    setUser(userData);
  };

  // Handler for logging out
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        {/* Route for the Login Page */}
        <Route 
          path="/login" 
          element={
            isLoggedIn ? (
              <Navigate to="/dashboard/sale" replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          } 
        />
        
        {/* Protected Route: Navigate to Dashboard if logged in, otherwise to Login */}
        <Route 
          path="/dashboard/*" 
          element={
            isLoggedIn ? (
              <DashboardLayout user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        {/* Default Route: Redirects to /login first if not authenticated */}
        <Route 
          path="*" 
          element={<Navigate to={isLoggedIn ? "/dashboard/sale" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;