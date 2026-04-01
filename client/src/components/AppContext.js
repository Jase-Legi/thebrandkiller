// client/src/components/AppContext.js
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { axiosInstance } from '../api';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);






export const AppProvider = ({ children }) => {
  // ========== Theme State ==========
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) setUser(JSON.parse(saved));
    setLoadingUser(false);
  }, []);
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
      setIsDarkTheme(false);
      document.body.classList.add('light-theme');
    } else {
      setIsDarkTheme(true);
      document.body.classList.remove('light-theme');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDarkTheme = !isDarkTheme;
    setIsDarkTheme(newIsDarkTheme);
    if (newIsDarkTheme) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  // ========== Products ==========
// ========== Products ==========
const [products, setProducts] = useState([]);
const [loadingProducts, setLoadingProducts] = useState(true); // <-- start as true

const fetchProducts = useCallback(async () => {
  setLoadingProducts(true);
  try {
    const res = await axiosInstance.get('/products');
    setProducts(res.data);
  } catch (err) {
    console.error('Failed to fetch products:', err);
    if (window.showNotification) window.showNotification('Failed to load products', 'error');
  } finally {
    setLoadingProducts(false);
  }
}, []);

useEffect(() => {
  fetchProducts();
}, []);

  // ========== Cart ==========
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = useCallback((productId, variantId, quantity = 1) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      window.showNotification('Product not found', 'error');
      return;
    }
    const variant = product.variants?.find(v => v.variantId === variantId);
    if (!variant) {
      window.showNotification('Variant not found', 'error');
      return;
    }

    const cartItem = {
      productId: product.id,
      productName: product.name,
      variantId: variant.variantId,
      size: variant.size,
      color: variant.color,
      price: variant.price,
      image: variant.image || product.images?.[0],
      quantity,
    };

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.variantId === variantId);
      if (existingIndex !== -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].quantity += quantity;
        return newCart;
      }
      return [...prevCart, cartItem];
    });

    window.showNotification(`Added ${product.name} (${variant.size} ${variant.color}) to cart`, 'success');
  }, [products]);

  const updateCartItem = useCallback((index, newVariantId) => {
    const item = cart[index];
    const product = products.find(p => p.id === item.productId);
    const newVariant = product?.variants?.find(v => v.variantId === newVariantId);
    if (newVariant) {
      const newCart = [...cart];
      newCart[index] = {
        ...item,
        variantId: newVariantId,
        size: newVariant.size,
        color: newVariant.color,
        price: newVariant.price,
        image: newVariant.image || product.images[0],
      };
      setCart(newCart);
      window.showNotification('Cart item updated', 'success');
    } else {
      window.showNotification('Selected variant not available', 'error');
    }
  }, [cart, products]);

  const removeCartItem = useCallback((index) => {
    const newCart = [...cart];
    const removedItem = newCart.splice(index, 1)[0];
    setCart(newCart);
    window.showNotification(`Removed ${removedItem.productName} from cart`, 'info');
  }, [cart]);

  const clearCart = useCallback(() => {
    setCart([]);
    window.showNotification('Cart cleared', 'info');
  }, []);

  // ========== User & Auth ==========
  const [token, setToken] = useState(() => localStorage.getItem('token'));


  useEffect(() => {
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
  }, [user]);

  const login = useCallback((newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.showNotification('Logged out successfully', 'info');
  }, []);

  // ========== Product Customization (selected options & images) ==========
  const [selectedOptions, setSelectedOptions] = useState({});
  const [selectedImages, setSelectedImages] = useState({});

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

  // ========== Provide all values ==========
  const value = {
    isDarkTheme,
    toggleTheme,
    products,
    loadingProducts,
    cart,
    addToCart,
    updateCartItem,
    setCart,
    removeCartItem,
    clearCart,
    token,
    user,
    login,
    logout,
    selectedOptions,
    selectedImages,
    updateSelectedOptions,
    updateSelectedImage,
    axiosInstance,   // expose if needed
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};