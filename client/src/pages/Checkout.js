import { CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { ethers } from 'ethers';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../components/NotificationManager';
import './Checkout.css';

function Checkout({ cart, setCart, token, axiosInstance }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { showNotification, showConfirmation } = useNotifications();

  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [address, setAddress] = useState({ 
    name: '', 
    street: '', 
    city: '', 
    state: '', 
    zip: '', 
    country: 'US' 
  });
  
  const [processing, setProcessing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [showEditItem, setShowEditItem] = useState(null);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [stripeError, setStripeError] = useState(null);
  
  // Check for affiliate ID in URL
  const [affiliateId, setAffiliateId] = useState(null);

  useEffect(() => {
    // Check for affiliate ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const affId = urlParams.get('aff');
    if (affId) {
      setAffiliateId(affId);
      showNotification(`Affiliate referral detected!`, 'info');
    }
  }, []);

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => {
      const price = parseFloat(item.promoPrice || item.price);
      return sum + (price * item.quantity);
    }, 0);
  };

  const calculateShipping = () => {
    const subtotal = calculateSubtotal();
    if (subtotal > 100) return 0;
    return 9.99;
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    return subtotal * 0.08;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const shipping = calculateShipping();
    const tax = calculateTax();
    return subtotal + shipping + tax;
  };

  const updateQuantity = (index, newQty) => {
    if (newQty <= 0) {
      removeItem(index);
      return;
    }
    
    const newCart = [...cart];
    newCart[index].quantity = newQty;
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    showNotification(`Quantity updated to ${newQty}`, 'success');
  };

  const removeItem = (index) => {
    showConfirmation(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      () => {
        const newCart = [...cart];
        const removedItem = newCart.splice(index, 1)[0];
        setCart(newCart);
        localStorage.setItem('cart', JSON.stringify(newCart));
        setShowEditItem(null);
        showNotification(`Removed ${removedItem.name} from cart`, 'info');
      },
      () => {}
    );
  };

  const editItem = (index) => {
    setShowEditItem(showEditItem === index ? null : index);
  };
  
  // Initialize payment request (Google Pay/Apple Pay)
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: 'Total',
        amount: Math.round(calculateTotal() * 100), // Amount in cents
      },
      requestPayerName: true,
      requestPayerEmail: true,
      requestShipping: true,
      shippingOptions: [
        {
          id: 'free-shipping',
          label: 'Free shipping',
          detail: 'Delivery in 5-7 days',
          amount: calculateShipping() === 0 ? 0 : Math.round(calculateShipping() * 100),
        },
      ],
    });

    // Check if payment request is available
    pr.canMakePayment().then(result => {
      if (result) {
        setPaymentRequest(pr);
        setWalletAvailable(true);
      }
    });

    pr.on('paymentmethod', async (ev) => {
      setProcessing(true);
      
      try {
        // Create payment intent on your server
        const response = await axiosInstance.post('/create-payment-intent', {
          amount: Math.round(calculateTotal() * 100),
          currency: 'usd',
          paymentMethodType: 'card',
        });

        const { clientSecret } = response.data;

        // Confirm the PaymentIntent
        const { error: confirmError } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete('fail');
          showNotification(confirmError.message, 'error');
          setProcessing(false);
        } else {
          ev.complete('success');
          
          // Submit order with wallet payment
          await submitOrder('wallet', { 
            paymentMethodId: ev.paymentMethod.id,
            walletType: ev.walletName 
          });
        }
      } catch (err) {
        ev.complete('fail');
        showNotification('Payment failed: ' + err.message, 'error');
        setProcessing(false);
      }
    });
  }, [stripe, calculateTotal]);

  const submitOrder = async (method, paymentData) => {
    setProcessing(true);
    try {
      const orderData = {
        cart,
        paymentMethod: method,
        paymentData,
        address,
        subtotal: calculateSubtotal(),
        shipping: calculateShipping(),
        tax: calculateTax(),
        total: calculateTotal(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Include affiliate ID if present
      const endpoint = affiliateId ? `/orders?affiliateId=${affiliateId}` : '/orders';
      
      const res = await axiosInstance.post(endpoint, orderData);

      if (method === 'stripe' && res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
        return;
      }

      setOrderId(res.data.order.id || `ORD-${Date.now()}`);
      setOrderPlaced(true);
      
      // Show affiliate notification if applicable
      if (affiliateId) {
        showNotification('Order placed successfully! Affiliate commission will be tracked.', 'success');
      } else {
        showNotification('Order placed successfully!', 'success');
      }
      
      setTimeout(() => {
        setCart([]);
        localStorage.removeItem('cart');
      }, 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message || 'Order failed';
      showNotification(errorMsg, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleStripe = async () => {
    if (!stripe || !elements) {
      showNotification('Payment system not ready. Please refresh the page.', 'error');
      return;
    }
    
    setProcessing(true);
    setStripeError(null);

    try {
      const cardElement = elements.getElement(CardElement);
      
      // Test Stripe connection first
      try {
        const testResponse = await axiosInstance.get('/test-stripe');
        if (!testResponse.data.connected) {
          throw new Error('Stripe not connected: ' + testResponse.data.message);
        }
      } catch (testErr) {
        showNotification('Payment system not configured properly', 'error');
        setProcessing(false);
        return;
      }

      // Create payment intent first
      const intentResponse = await axiosInstance.post('/create-payment-intent', {
        amount: Math.round(calculateTotal() * 100),
        currency: 'usd'
      });

      if (!intentResponse.data.clientSecret) {
        throw new Error('No client secret received from server');
      }

      // Use confirmCardPayment directly (simpler approach)
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        intentResponse.data.clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: address.name,
              address: {
                line1: address.street,
                city: address.city,
                state: address.state,
                postal_code: address.zip,
                country: address.country
              }
            }
          }
        }
      );

      if (error) {
        showNotification(error.message, 'error');
        setStripeError(error.message);
        setProcessing(false);
      } else if (paymentIntent.status === 'succeeded') {
        // Payment successful
        await submitOrder('stripe', { 
          paymentIntentId: paymentIntent.id,
          paymentMethod: 'card'
        });
      } else {
        showNotification('Payment not completed: ' + paymentIntent.status, 'warning');
        setProcessing(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      showNotification(err.message || 'Payment processing failed', 'error');
      setStripeError(err.message);
      setProcessing(false);
    }
  };

  const handleEth = async () => {
    if (!window.ethereum) {
      showNotification('Please install MetaMask to pay with Ethereum', 'error');
      return;
    }
    setProcessing(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: 'YOUR_MERCHANT_ETH_ADDRESS',
        value: ethers.parseEther(calculateTotal().toString()),
      });
      await tx.wait();

      await submitOrder('eth', { txHash: tx.hash });
    } catch (err) {
      showNotification('ETH Payment failed: ' + err.message, 'error');
      setProcessing(false);
    }
  };

  const handlePayment = () => {
    if (!address.name || !address.street || !address.city || !address.zip) {
      showNotification('Please fill in all required address fields', 'error');
      return;
    }
    
    if (cart.length === 0) {
      showNotification('Your cart is empty', 'warning');
      return;
    }
    
    // DEVELOPMENT MODE: Skip actual payment for testing
    if (process.env.NODE_ENV === 'development' && paymentMethod === 'stripe') {
      showNotification('DEVELOPMENT MODE: Using test payment', 'info');
      setTimeout(async () => {
        await submitOrder('test', { test: true, mode: 'development' });
      }, 1000);
      return;
    }
    
    if (paymentMethod === 'stripe') handleStripe();
    else if (paymentMethod === 'eth') handleEth();
  };

  const clearCart = () => {
    showConfirmation(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      () => {
        setCart([]);
        localStorage.removeItem('cart');
        showNotification('Cart cleared', 'info');
      },
      () => {}
    );
  };

  if (cart.length === 0 && !orderPlaced) {
    return (
      <div className="empty-cart">
        <div className="empty-cart-icon">🛒</div>
        <h2 className="empty-cart-title">Your Cart is Empty</h2>
        <p className="empty-cart-message">Add some products to your cart and they'll appear here.</p>
        <button 
          onClick={() => navigate('/')}
          className="continue-shopping-btn"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="order-confirmation">
        <div className="confirmation-icon">✓</div>
        <h2 className="confirmation-title">Order Confirmed!</h2>
        <p className="confirmation-message">
          Thank you for your purchase
        </p>
        <p className="confirmation-id">
          Order ID: <strong>{orderId}</strong>
        </p>
        {affiliateId && (
          <p className="confirmation-note" style={{ color: '#0f0' }}>
            ✅ Affiliate commission will be tracked
          </p>
        )}
        <p className="confirmation-note">
          You will receive a confirmation email shortly.
        </p>
        <button 
          onClick={() => {
            setOrderPlaced(false);
            navigate('/');
          }}
          className="continue-shopping-btn"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h1 className="checkout-title">Checkout</h1>
        <button 
          onClick={() => navigate('/')}
          className="continue-shopping-btn"
        >
          ← Continue Shopping
        </button>
      </div>
      
      {/* Stripe Error Display */}
      {stripeError && (
        <div className="stripe-error-notice">
          <div className="stripe-error-icon">⚠️</div>
          <div className="stripe-error-content">
            <strong>Payment Error:</strong>
            <p>{stripeError}</p>
            <small>Check your Stripe API keys in the .env file</small>
          </div>
        </div>
      )}
      
      {/* Development Mode Notice */}
      {process.env.NODE_ENV === 'development' && paymentMethod === 'stripe' && (
        <div className="dev-mode-notice">
          <div className="dev-mode-icon">🔧</div>
          <div className="dev-mode-content">
            <strong>Development Mode Active</strong>
            <p>Test payments are enabled. No real payment will be processed.</p>
          </div>
        </div>
      )}
      
      {/* Affiliate Notice */}
      {affiliateId && (
        <div className="affiliate-notice">
          <div className="affiliate-notice-icon">👥</div>
          <div className="affiliate-notice-content">
            <strong>Affiliate Purchase Detected</strong>
            <p>Your purchase supports an affiliate. Thank you!</p>
          </div>
        </div>
      )}
      
      <div className="checkout-grid">
        {/* Left Column: Cart Items & Address */}
        <div>
          {/* Cart Items */}
          <div className="cart-section">
            <h2 className="section-title">Cart Items ({cart.length})</h2>
            
            {cart.map((item, index) => {
              const price = parseFloat(item.promoPrice || item.price);
              const itemTotal = price * item.quantity;
              
              // Get variant image if available, otherwise use default
              const itemImage = item.displayImage || item.images?.[0] || '';
              
              return (
                <div key={index} className={`cart-item ${showEditItem === index ? 'editing' : ''}`}>
                  <div className="cart-item-content">
                    {/* Product Image */}
                    <div className="item-image-container">
                      <img 
                        src={itemImage} 
                        alt={item.name}
                        className="item-image"
                      />
                    </div>
                    
                    {/* Product Details */}
                    <div className="item-details">
                      <div className="item-header">
                        <div>
                          <h4 className="item-name">{item.name}</h4>
                          
                          {/* Display Selected Options */}
                          {item.options && Object.keys(item.options).length > 0 && (
                            <div className="selected-options">
                              {(() => {
                                if (!item.options) return null;
                                
                                const displayOptions = [];
                                
                                // Add size if exists and is not array
                                if (item.options.size && typeof item.options.size === 'string' && item.options.size !== '') {
                                  displayOptions.push(`Size: ${item.options.size}`);
                                }
                                
                                // Add color if exists and is not array
                                if (item.options.color && typeof item.options.color === 'string' && item.options.color !== '') {
                                  displayOptions.push(`Color: ${item.options.color}`);
                                }
                                
                                // Add any other non-array options
                                Object.entries(item.options).forEach(([key, value]) => {
                                  if (key === 'size' || key === 'color' || key === 'sizes' || key === 'colors') return;
                                  if (!value) return;
                                  
                                  let displayValue = value;
                                  if (Array.isArray(value)) {
                                    displayValue = value.join(', ');
                                  }
                                  
                                  displayOptions.push(`${key}: ${displayValue}`);
                                });
                                
                                // If we have options to display
                                if (displayOptions.length > 0) {
                                  return displayOptions.map((option, idx) => (
                                    <span key={idx} className="option-badge">
                                      {option}
                                    </span>
                                  ));
                                }
                                
                                return null;
                              })()}
                            </div>
                          )}
                          
                          <div className="item-price">
                            ${price.toFixed(2)} each
                          </div>
                        </div>
                        
                        <div className="item-actions">
                          <button 
                            onClick={() => editItem(index)}
                            className="edit-item-btn"
                          >
                            {showEditItem === index ? 'Cancel' : 'Edit'}
                          </button>
                          
                          <button 
                            onClick={() => removeItem(index)}
                            className="remove-item-btn"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      
                      {/* Quantity and Total */}
                      <div className="item-quantity">
                        <span className="quantity-label">Quantity:</span>
                        <div className="quantity-controls">
                          <button
                            onClick={() => updateQuantity(index, item.quantity - 1)}
                            className="quantity-btn"
                          >
                            -
                          </button>
                          
                          <span className="quantity-display">
                            {item.quantity}
                          </span>
                          
                          <button
                            onClick={() => updateQuantity(index, item.quantity + 1)}
                            className="quantity-btn"
                          >
                            +
                          </button>
                        </div>
                        
                        <div className="item-total">
                          ${itemTotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Edit Panel - Expanded when editing */}
                  {showEditItem === index && (
                    <div className="edit-panel">
                      <h5 className="edit-title">Edit Item</h5>
                      <div className="edit-grid">
                        <div className="edit-field">
                          <label className="edit-label">Size</label>
                          <select 
                            value={item.options?.size || ''}
                            onChange={(e) => {
                              const newCart = [...cart];
                              newCart[index].options = { 
                                ...newCart[index].options, 
                                size: e.target.value 
                              };
                              setCart(newCart);
                              localStorage.setItem('cart', JSON.stringify(newCart));
                              showNotification('Size updated', 'success');
                            }}
                            className="edit-select"
                          >
                            <option value="">Select Size</option>
                            {item.sizes?.map((size, idx) => (
                              <option key={idx} value={size}>{size}</option>
                            ))}
                            {/* Also check in item.options.sizes */}
                            {item.options?.sizes?.map((size, idx) => (
                              <option key={idx} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="edit-field">
                          <label className="edit-label">Color</label>
                          <select 
                            value={item.options?.color || ''}
                            onChange={(e) => {
                              const newCart = [...cart];
                              newCart[index].options = { 
                                ...newCart[index].options, 
                                color: e.target.value 
                              };
                              setCart(newCart);
                              localStorage.setItem('cart', JSON.stringify(newCart));
                              showNotification('Color updated', 'success');
                            }}
                            className="edit-select"
                          >
                            <option value="">Select Color</option>
                            {item.colors?.map((color, idx) => (
                              <option key={idx} value={color}>{color}</option>
                            ))}
                            {/* Also check in item.options.colors */}
                            {item.options?.colors?.map((color, idx) => (
                              <option key={idx} value={color}>{color}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setShowEditItem(null)}
                        className="save-changes-btn"
                      >
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {cart.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button 
                  onClick={clearCart}
                  className="clear-cart-btn"
                >
                  Clear All Items
                </button>
              </div>
            )}
          </div>

          {/* Shipping Address */}
          <div className="address-section">
            <h2 className="section-title">Shipping Address</h2>
            
            <div className="address-form">
              <div className="address-field">
                <label className="address-label">
                  Full Name <span style={{ color: '#ff4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={address.name}
                  onChange={e => setAddress({...address, name: e.target.value})}
                  placeholder="John Doe"
                  className="address-input"
                />
              </div>
              
              <div className="address-field">
                <label className="address-label">
                  Street Address <span style={{ color: '#ff4444' }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={address.street}
                  onChange={e => setAddress({...address, street: e.target.value})}
                  placeholder="123 Main St"
                  className="address-input"
                />
              </div>
              
              <div className="address-grid">
                <div className="address-field">
                  <label className="address-label">
                    City <span style={{ color: '#ff4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={address.city}
                    onChange={e => setAddress({...address, city: e.target.value})}
                    placeholder="New York"
                    className="address-input"
                  />
                </div>
                
                <div className="address-field">
                  <label className="address-label">
                    State / Province
                  </label>
                  <input 
                    type="text" 
                    value={address.state}
                    onChange={e => setAddress({...address, state: e.target.value})}
                    placeholder="NY"
                    className="address-input"
                  />
                </div>
              </div>
              
              <div className="address-grid">
                <div className="address-field">
                  <label className="address-label">
                    ZIP / Postal Code <span style={{ color: '#ff4444' }}>*</span>
                  </label>
                  <input 
                    type="text" 
                    value={address.zip}
                    onChange={e => setAddress({...address, zip: e.target.value})}
                    placeholder="10001"
                    className="address-input"
                />
                </div>
                
                <div className="address-field">
                  <label className="address-label">
                    Country
                  </label>
                  <select
                    value={address.country}
                    onChange={e => setAddress({...address, country: e.target.value})}
                    className="address-select"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="UK">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Payment */}
        <div>
          <div className="order-summary">
            <h2 className="section-title">Order Summary</h2>
            
            {/* Order Totals */}
            <div style={{ marginBottom: '24px' }}>
              <div className="summary-row">
                <span className="summary-label">Subtotal ({cart.length} items)</span>
                <span className="summary-value">${calculateSubtotal().toFixed(2)}</span>
              </div>
              
              <div className="summary-row">
                <span className="summary-label">Shipping</span>
                <span className="summary-value" style={{ color: calculateShipping() === 0 ? '#0f0' : '#fff' }}>
                  {calculateShipping() === 0 ? 'FREE' : `$${calculateShipping().toFixed(2)}`}
                </span>
              </div>
              
              <div className="summary-row">
                <span className="summary-label">Estimated Tax</span>
                <span className="summary-value">${calculateTax().toFixed(2)}</span>
              </div>
              
              <div className="summary-total">
                <span className="total-label">Total</span>
                <span className="total-value">
                  ${calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Payment Method</h3>
              
              <div className="payment-methods">
                <button
                  onClick={() => setPaymentMethod('stripe')}
                  className={`payment-method-btn ${paymentMethod === 'stripe' ? 'active' : ''}`}
                >
                  <div className="payment-method-content">
                    <span>💳</span>
                    <span>Card / Digital Wallet</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setPaymentMethod('eth')}
                  className={`payment-method-btn ${paymentMethod === 'eth' ? 'active' : ''}`}
                >
                  <div className="payment-method-content">
                    <span>Ξ</span>
                    <span>Ethereum</span>
                  </div>
                </button>
              </div>
              
              {paymentMethod === 'stripe' && (
                <div style={{ marginTop: '16px' }}>
                  {/* Digital Wallet Buttons (Google Pay/Apple Pay) */}
                  {walletAvailable && paymentRequest && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ 
                        marginBottom: '10px', 
                        color: '#aaa', 
                        fontSize: '14px',
                        textAlign: 'center'
                      }}>
                        Pay with:
                      </div>
                      <div className="wallet-buttons">
                        <PaymentRequestButtonElement
                          options={{ paymentRequest }}
                          className="wallet-button"
                          style={{
                            paymentRequestButton: {
                              theme: 'dark',
                              height: '44px',
                            },
                          }}
                        />
                      </div>
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#777', 
                        fontSize: '12px',
                        marginTop: '8px'
                      }}>
                        Apple Pay & Google Pay
                      </div>
                      <div className="wallet-icons">
                        <span>🍎</span>
                        <span>🤖</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Card Form */}
                  <div style={{ 
                    marginTop: walletAvailable ? '20px' : '0',
                    borderTop: walletAvailable ? '1px solid #333' : 'none',
                    paddingTop: walletAvailable ? '20px' : '0'
                  }}>
                    <div style={{ 
                      marginBottom: '10px', 
                      color: '#aaa', 
                      fontSize: '14px',
                      textAlign: 'center'
                    }}>
                      {walletAvailable ? 'Or enter card details:' : 'Enter card details:'}
                    </div>
                    
                    <div className="stripe-card">
                      <CardElement options={{ 
                        style: { 
                          base: { 
                            color: '#fff', 
                            fontSize: '16px',
                            fontFamily: "'Courier New', monospace",
                            '::placeholder': { color: '#888' }
                          } 
                        } 
                      }} />
                    </div>
                    <p className="payment-info">
                      We accept Visa, Mastercard, American Express, Apple Pay & Google Pay
                    </p>
                  </div>
                </div>
              )}
              
              {paymentMethod === 'eth' && (
                <div className="eth-payment">
                  <div className="eth-icon">Ξ</div>
                  <p style={{ color: '#aaa', marginBottom: '8px' }}>
                    Pay with Ethereum (ETH)
                  </p>
                  <p className="eth-amount">
                    {calculateTotal().toFixed(4)} ETH
                  </p>
                  <p className="eth-note">
                    Requires MetaMask or other Web3 wallet
                  </p>
                </div>
              )}
            </div>

            {/* Place Order Button */}
            <button 
              onClick={handlePayment}
              disabled={processing || cart.length === 0}
              className="place-order-btn"
            >
              {processing ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <div className="loading-spinner-small"></div>
                  Processing...
                </div>
              ) : `Pay $${calculateTotal().toFixed(2)}`}
            </button>
            
            <div className="security-badge">
              <p className="security-text">
                🔒 Secure checkout • 30-day return policy • Free shipping on orders over $100
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;