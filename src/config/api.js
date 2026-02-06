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
  
  // Get current hostname and protocol
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // 'http:' or 'https:'
  
  // If served from faridagri.devzytic.com, ALWAYS use relative URL (same domain)
  // This prevents CORS issues and mixed content errors
  if (hostname === 'faridagri.devzytic.com' || hostname.includes('faridagri.devzytic.com')) {
    // Use relative URL - will automatically use the same protocol and domain
    return '/api';
  }
  
  // For localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5002/api';
  }
  
  // Default fallback - but this shouldn't be reached if on faridagri.devzytic.com
  return '/api'; // Default to relative URL
};

export const API_BASE_URL = getApiBaseUrl();

// Export default for convenience
export default API_BASE_URL;
