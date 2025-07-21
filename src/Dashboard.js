import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  CssBaseline, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Toolbar,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Sell, 
  Inventory, 
  ShoppingCart, 
  People, 
  Store, 
  CreditCard, 
  SellSharp, 
  AccountBalance 
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const drawerWidth = 240;
const API_URL = 'https://faridagri.devzytic.com/api';

const DashboardHome = () => {
  const [productData, setProductData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch Top Selling Products
        
        const topProductsRes = await axios.get(`${API_URL}/reports/top-selling-products`);
      setProductData(topProductsRes.data);

        // Fetch Sales Trend (last 6 months)
        // const salesTrendRes = await axios.get(`${API_URL}/reports/sales-trend`);
        // setSalesData(salesTrendRes.data);
        const salesTrendRes = await axios.get(`${API_URL}/reports/sale-invoices/sales-trend?months=6`);
        setSalesData(salesTrendRes.data);

        // Fetch Monthly Sales (July 2025)
        const monthlySalesRes = await axios.get(`${API_URL}/reports/monthly-total`);
        setMonthlySales(monthlySalesRes.data.totalSales);

        // Fetch Total Products
        const productsRes = await axios.get(`${API_URL}/reports/products/count`);
        setTotalProducts(productsRes.data.totalProducts);

        // Fetch Total Customers
        const customersRes = await axios.get(`${API_URL}/customers/count`);
        setTotalCustomers(customersRes.data.totalCustomers);

        // Fetch Active Vendors
        const vendorsRes = await axios.get(`${API_URL}/vendors/count`);
        setTotalVendors(vendorsRes.data.totalVendors);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF4560'];

  if (loading) return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>
      
      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="div">
                {totalProducts.toLocaleString()}
              </Typography>
              <Typography color="text.secondary">
                Total Products
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="div">
                {totalCustomers.toLocaleString()}
              </Typography>
              <Typography color="text.secondary">
                Total Customers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="div">
                {totalVendors.toLocaleString()}
              </Typography>
              <Typography color="text.secondary">
                Active Vendors
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Typography variant="h5" component="div">
                PKR {monthlySales.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
              </Typography>
              <Typography color="text.secondary">
                Monthly Sales (July 2025)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Top Selling Products
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Monthly Sales Trend
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `PKR ${value.toLocaleString()}`} />
                <Tooltip formatter={(value) => `PKR ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="sales" fill="#8884d8" name="Sales (PKR)" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <Sell />, path: '/dashboard' },
    { text: 'Sell', icon: <Sell />, path: '/dashboard/sell' },
    { text: 'Stock', icon: <Inventory />, path: '/dashboard/stock' },
    { text: 'Products', icon: <ShoppingCart />, path: '/dashboard/products' },
    { text: 'Vendors', icon: <Store />, path: '/dashboard/vendors' },
    { text: 'Customers', icon: <People />, path: '/dashboard/customers' },
    { text: 'Sell Records', icon: <SellSharp />, path: '/dashboard/sell-records' },
    { text: 'Credit Records', icon: <CreditCard />, path: '/dashboard/credit-records' },
    // { text: 'Customer Credit Records', icon: <AccountBalance />, path: '/dashboard/customer-credit-records' },
    // { text: 'Add Credit Payment', icon: <AccountBalance />, path: '/dashboard/add-credit-payment' },
    { text: 'Stock Purchases', icon: <Inventory />, path: '/dashboard/stock-purchases' },
    { text: 'Vendor Credit Records', icon: <AccountBalance />, path: '/dashboard/vendor-credit-records' }
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    backgroundColor: location.pathname === item.path ? 'lightgray' : 'inherit',
                    '&:hover': {
                      backgroundColor: 'lightgray',
                    },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {location.pathname === '/dashboard' ? <DashboardHome /> : <Outlet />}
      </Box>
    </Box>
  );
};

export default Dashboard;