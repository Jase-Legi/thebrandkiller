import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import './styles.css';
import './index.css';
import Affiliate from './pages/Affiliate';
import AdminAffiliate from './pages/AdminAffiliate';
import NotificationManager from './components/NotificationManager';
import Footer from './components/Footer';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import ThemeToggle from './components/ThemeToggle';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
import { AppProvider, useApp } from './components/AppContext';
import NotFound from './pages/NotFound';

const stripePromise = loadStripe('pk_test_51YourPublishableKeyHere1234567890');

function AppContent() {
  const { cart, user, logout } = useApp();
  // Note: useNotifications cannot be called here because it's not part of the context.
  // We'll use window.showConfirmation and window.showNotification (provided by NotificationManager)
  // So we don't need to import useNotifications here.

  return (
    <div className="container">
      <NotificationManager />
      <nav className="main-nav">
        <Link to="/" className="nav-link">Home</Link>
        {user?.role === 'affiliate' && (
          <Link to="/affiliate" className="nav-link" style={{ color: '#0f0' }}>
            Affiliate Portal
          </Link>
        )}
        {user?.role === 'admin' && (
          <>
            <Link to="/admin" className="admin-nav-link">Admin Portal</Link>
            <Link to="/admin/affiliates" className="nav-link" style={{ color: '#ffaa00' }}>
              Affiliate Management
            </Link>
          </>
        )}
        <Link to="/checkout" className="nav-link cart-link">
          Cart ({cart.length})
        </Link>
        {!user ? (
          <Link to="/login" className="nav-link">Login / Register</Link>
        ) : (
          <button
            onClick={() => {
              if (window.showConfirmation) {
                window.showConfirmation('Logout', 'Are you sure you want to logout?', logout, () => {});
              }
            }}
            className="logout-btn"
          >
            Logout ({user.email})
          </button>
        )}
        <ThemeToggle />
      </nav>

      <Elements stripe={stripePromise}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/not-found" element={<NotFound />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/affiliate" element={<Affiliate />} />
          <Route path="/admin/affiliates" element={<AdminAffiliate />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Elements>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

export default App;