// src/App.js

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';

// Mock authentication state (for now, just a boolean)
const isAuthenticated = true; // Set this to false to see the login page first!

function App() {
  // In a real app, this state would be managed by Redux/Context and updated on successful login
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated);

  return (
    <Router>
      <Routes>
        {/* Route for the Login Page */}
        <Route 
          path="/login" 
          element={<LoginPage onLogin={() => setIsLoggedIn(true)} />} 
        />
        
        {/* Protected Route: Navigate to Dashboard if logged in, otherwise to Login */}
        <Route 
          path="/dashboard/*" // Use /* to match nested routes within the dashboard
          element={isLoggedIn ? <DashboardLayout onLogout={() => setIsLoggedIn(false)} /> : <Navigate to="/login" replace />} 
        />

        {/* Default Route: Redirect to /dashboard if logged in, or /login if not */}
        <Route 
          path="/" 
          element={<Navigate to={isLoggedIn ? "/dashboard/sale" : "/login"} replace />} 
        />
      </Routes>
    </Router>
  );
}

export default App;