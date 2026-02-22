import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import axios from 'axios';
import './styles.css';
import './index.css';
import Affiliate from './pages/Affiliate';
import AdminAffiliate from './pages/AdminAffiliate';
import NotificationManager, { useNotifications } from './components/NotificationManager';
import Footer from './components/Footer';
import Home from './pages/Home';
import Admin from './pages/Admin';
import Checkout from './pages/Checkout';
import ThemeToggle from './components/ThemeToggle';
import Login from './pages/Login';
import ProductDetail from './pages/ProductDetail';
import { ThemeProvider } from './components/ThemeContext';

const stripePromise = loadStripe('pk_test_51YourPublishableKeyHere1234567890');

const axiosInstance = axios.create({
  baseURL: 'http://localhost:5000'
});

axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      if (window.showNotification) {
        window.showNotification('Session expired. Please login again.', 'error');
      }
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const loadState = (key, defaultValue) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const saveState = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

function App() {
  const [token, setToken] = useState(() => loadState('token', null));
  const [cart, setCart] = useState(() => loadState('cart', []));
  const [user, setUser] = useState(() => loadState('user', null));
  // const [selectedOptions, setSelectedOptions] = useState(() => loadState('selectedOptions', {}));
  // const [selectedImages, setSelectedImages] = useState(() => loadState('selectedImages', {}));
  const [selectedOptions, setSelectedOptions] = useState({}); // Don't load from localStorage
  const [selectedImages, setSelectedImages] = useState({}); // Don't load from localStorage
  const { showNotification, showConfirmation } = useNotifications();

  useEffect(() => {
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    saveState('token', token);
  }, [token]);

  useEffect(() => {
    saveState('cart', cart);
  }, [cart]);

  useEffect(() => {
    saveState('user', user);
  }, [user]);

  useEffect(() => {
    // Clear selected options when app starts
    setSelectedOptions({});
    setSelectedImages({});
  }, []);

  const handleLogin = (tok, usr) => {
    setToken(tok);
    setUser(usr);
    showNotification(`Welcome back, ${usr.email}!`, 'success');
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    showNotification('Logged out successfully', 'info');
  };

  const addToCart = useCallback((product, qty = 1, options = {}) => {
    // Get variant image based on selected options
    let variantImage = null;
    
    // Check for color variant image
    if (options.color && product.variantImages?.color?.[options.color]) {
      variantImage = product.variantImages.color[options.color];
    }
    // Check for size variant image
    else if (options.size && product.variantImages?.size?.[options.size]) {
      variantImage = product.variantImages.size[options.size];
    }
    
    // Use variant image if available, otherwise use first product image
    const displayImage = variantImage || product.images?.[0] || '';
    
    const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
    const promoPrice = product.promoPrice ? 
      (typeof product.promoPrice === 'string' ? parseFloat(product.promoPrice) : product.promoPrice) : 
      null;
    
    const item = {
      ...product,
      price,
      promoPrice,
      quantity: qty,
      options: {
        ...options, // Selected options (size, color)
        sizes: product.options?.sizes || [], // Available sizes
        colors: product.options?.colors || [] // Available colors
      },
      displayImage
    };
    
    const optionsStr = JSON.stringify(options);
    const newCart = [...cart];
    const existingIndex = newCart.findIndex(i => 
      i.id === product.id && JSON.stringify(i.options) === optionsStr
    );

    if (existingIndex !== -1) {
      newCart[existingIndex].quantity += qty;
      showNotification(`Updated quantity of ${product.name} in cart`, 'success');
    } else {
      newCart.push(item);
      showNotification(`Added ${product.name} to cart`, 'success');
    }

    setCart(newCart);
  }, [cart, showNotification]);

  const updateCartItem = useCallback((index, updates) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], ...updates };
    setCart(newCart);
  }, [cart]);

  const removeCartItem = useCallback((index) => {
    const newCart = [...cart];
    const removedItem = newCart.splice(index, 1)[0];
    setCart(newCart);
    showNotification(`Removed ${removedItem.name} from cart`, 'info');
  }, [cart, showNotification]);

  const clearCart = useCallback(() => {
    setCart([]);
    showNotification('Cart cleared', 'info');
  }, [showNotification]);

  const updateSelectedOptions = useCallback((productId, options) => {
    setSelectedOptions(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...options }
    }));
  }, []);

  const updateSelectedImage = useCallback((productId, imageUrl) => {
    setSelectedImages(prev => ({
      ...prev,
      [productId]: imageUrl
    }));
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <div className="container">
          <NotificationManager />
          
          <nav className="main-nav">
            <Link to="/" className="nav-link">Home</Link>

            {/* {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="admin-nav-link"
              >
                Admin Portal
              </Link>
            )} */}

            {user?.role === 'affiliate' && (
              <Link
                to="/affiliate"
                className="nav-link"
                style={{ color: '#0f0' }}
              >
                Affiliate Portal
              </Link>
            )}
            {user?.role === 'admin' && (
              <>
                <Link to="/admin" className="admin-nav-link">
                  Admin Portal
                </Link>
                <Link 
                  to="/admin/affiliates" 
                  className="nav-link"
                  style={{ color: '#ffaa00' }}
                >
                  Affiliate Management
                </Link>
              </>
            )}
            <Link to="/checkout" className="nav-link cart-link">
              Cart ({cart.length})
            </Link>

            {!user ? (
              <Link to="/login" className="nav-link">
                Login / Register
              </Link>
            ) : (
              <button
                onClick={() => {
                  showConfirmation(
                    'Logout',
                    'Are you sure you want to logout?',
                    handleLogout,
                    () => {}
                  );
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
              <Route path="/" element={
                <Home 
                  addToCart={addToCart}
                  selectedOptions={selectedOptions}
                  selectedImages={selectedImages}
                  updateSelectedOptions={updateSelectedOptions}
                  updateSelectedImage={updateSelectedImage}
                />
              } />
              <Route path="/product/:id" element={
                <ProductDetail 
                  addToCart={addToCart}
                  selectedOptions={selectedOptions}
                  selectedImages={selectedImages}
                  updateSelectedOptions={updateSelectedOptions}
                  updateSelectedImage={updateSelectedImage}
                />
              } />

              <Route
                path="/admin"
                element={<Admin token={token} user={user} axiosInstance={axiosInstance} />}
              />
              <Route
                path="/checkout"
                element={
                  <Checkout 
                    cart={cart} 
                    setCart={setCart}
                    updateCartItem={updateCartItem}
                    removeCartItem={removeCartItem}
                    clearCart={clearCart}
                    token={token} 
                    axiosInstance={axiosInstance}
                  />
                }
              />
              <Route 
                path="/affiliate"
                element={<Affiliate 
                  user={user} 
                  token={token} 
                  axiosInstance={axiosInstance} 
                />}
              />

              <Route 
                path="/admin/affiliates"
                element={<AdminAffiliate 
                  token={token} 
                  user={user} 
                  axiosInstance={axiosInstance} 
                />}
              />
              <Route path="/login" element={<Login onLogin={handleLogin} axiosInstance={axiosInstance} />} />
            </Routes>
          </Elements>

          <Footer user={user} />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
export { axiosInstance };