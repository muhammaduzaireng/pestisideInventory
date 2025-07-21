import axios from 'axios';

const API_BASE_URL = 'https://faridagri.devzytic.com/api'; // Backend port

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getToken = () => localStorage.getItem('token'); // Assuming token is stored in localStorage

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const auth = {
  login: (credentials) => api.post('/login', credentials),
};

export const products = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
  create: (productData) => api.post('/products', productData),
  updatePrices: (id, priceData) => api.put(`/products/${id}/prices`, priceData),
  getRecentPrices: (productId) => api.get(`/stock-entries/recent/${productId}`),
};

export const vendors = {
  getAll: () => api.get('/vendors'),
  create: (vendorData) => api.post('/vendors', vendorData),
  update: (id, vendorData) => api.put(`/vendors/${id}`, vendorData),
  delete: (id) => api.delete(`/vendors/${id}`),
};

export const stockPurchases = {
  addPurchase: (purchaseData) => api.post('/stock-purchases', purchaseData),
  getAllPurchases: () => api.get('/stock-purchases'),
  getPurchaseById: (id) => api.get(`/stock-purchases/${id}`),
  payCredit: (id, paymentData) => {
    // paymentData should contain { amount_paid, payment_date, new_credit_due_date (optional) }
    return api.put(`/stock-purchases/${id}/pay-credit`, paymentData);
  },
  updateStockEntry: (id, stockEntryData) => {
    return api.put(`/stock-entries/${id}`, stockEntryData);
  },
};

export const customers = {
  getAll: () => api.get('/customers'),
  create: (customerData) => api.post('/customers', customerData),
};

// DEPRECATED: Legacy sales endpoints (uses 'sales' table)
export const sales = {
  addSale: (saleData) => {
    console.warn('WARNING: /api/sell is deprecated. Use saleInvoices.addSale instead.');
    return api.post('/sell', saleData);
  },
  getAllSales: () => {
    console.warn('WARNING: /api/sell is deprecated. Use sellRecords or saleInvoices instead.');
    return api.get('/sell');
  },
};

export const sellRecords = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/sell-records?${query}`);
  },
  getByCustomerId: (customerId, startDate, endDate) => {
    const params = new URLSearchParams();
    if (customerId) params.append('customer_id', customerId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return api.get(`/sell-records?${params.toString()}`);
  },
  getById: (id) => api.get(`/sell-records/${id}`),
  payCredit: (recordId, paymentData) => {
    // paymentData should contain { payment_amount, payment_date, new_credit_due_date (optional) }
    return api.post('/sell-records/pay-credit', {
      record_id: recordId,
      ...paymentData,
    });
  },
};

export const saleInvoices = {
  addSale: (saleData) => api.post('/sale-invoices', saleData),
  getAll: () => api.get('/sale-invoices'),
  getById: (id) => api.get(`/sale-invoices/${id}`),
};

// DEPRECATED: Legacy credit records (uses 'sales' table)
export const creditRecords = {
  getAll: (params) => {
    console.warn('WARNING: /api/credit-records is deprecated. Use sellRecords with payment_type filter.');
    const query = new URLSearchParams(params).toString();
    return api.get(`/credit-records?${query}`);
  },
  addPayment: (saleId, paymentData) => {
    console.warn('WARNING: /api/credit-payment is deprecated. Use sellRecords.payCredit instead.');
    return api.post('/credit-payment', { sale_id: saleId, ...paymentData });
  },
};


export default api;