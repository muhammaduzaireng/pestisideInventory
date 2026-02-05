// API Configuration
// This file centralizes the API base URL configuration
// It automatically detects the environment and sets the appropriate API URL

const getApiBaseUrl = () => {
  // Check if we're in development mode
  if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    // In development, use localhost backend
    return 'http://localhost:5002/api';
  }
  
  // Check for environment variable (can be set during build)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Default to production API
  return 'https://api.devzytic.com/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Export default for convenience
export default API_BASE_URL;
