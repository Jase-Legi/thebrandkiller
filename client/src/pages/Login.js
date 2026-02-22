import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Login.css';

function Login({ onLogin, axiosInstance }) {
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [mode, setMode] = useState('user');
  const [accountType, setAccountType] = useState('user'); // 'user' or 'affiliate'
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'admin') {
      setMode('admin');
    }
  }, [location]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      if (isRegister) {
        // Handle registration
        await handleRegistration();
      } else {
        // Handle login
        await handleLogin();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message || 'Request failed';
      setErrors({ general: errorMsg });
      
      if (window.showNotification) {
        window.showNotification(errorMsg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const res = await axiosInstance.post('/login', {
      email: form.email,
      password: form.password,
      roleRequested: mode
    });

    onLogin(res.data.token, { email: form.email, role: res.data.role });
    navigate('/');
  };

  const handleRegistration = async () => {
    if (mode === 'admin') {
      // Admin registration - use existing route
      const res = await axiosInstance.post('/register', {
        email: form.email,
        password: form.password,
        roleRequested: 'admin'
      });
      
      // Login after registration
      const loginRes = await axiosInstance.post('/login', {
        email: form.email,
        password: form.password,
        roleRequested: 'admin'
      });
      
      onLogin(loginRes.data.token, { email: form.email, role: loginRes.data.role });
      navigate('/');
      
    } else if (mode === 'user') {
      // Regular user or affiliate registration
      const roleRequested = accountType === 'affiliate' ? 'affiliate' : 'user';
      
      const res = await axiosInstance.post('/register', {
        email: form.email,
        password: form.password,
        roleRequested: roleRequested
      });
      
      // If affiliate registration, create affiliate record
      if (accountType === 'affiliate') {
        try {
          // Get token for affiliate registration
          const loginRes = await axiosInstance.post('/login', {
            email: form.email,
            password: form.password,
            roleRequested: 'user' // Temporary role for affiliate registration
          });
          
          // Save token temporarily
          const tempToken = loginRes.data.token;
          const tempAxios = axiosInstance;
          tempAxios.defaults.headers.common['Authorization'] = `Bearer ${tempToken}`;
          
          // Register as affiliate
          await tempAxios.post('/register-affiliate');
          
          showNotification('Affiliate registration submitted for approval!', 'success');
        } catch (affiliateErr) {
          console.error('Affiliate registration error:', affiliateErr);
          // Continue with regular registration even if affiliate registration fails
        }
      }
      
      // Login after registration
      const loginRes = await axiosInstance.post('/login', {
        email: form.email,
        password: form.password,
        roleRequested: roleRequested
      });
      
      onLogin(loginRes.data.token, { email: form.email, role: loginRes.data.role });
      
      // Show appropriate message
      if (accountType === 'affiliate') {
        showNotification(`Welcome! Your ${roleRequested} account has been created. Affiliate status pending approval.`, 'success');
      } else {
        showNotification(`Welcome! Your ${roleRequested} account has been created.`, 'success');
      }
      
      navigate('/');
    }
  };

  const showNotification = (message, type) => {
    if (window.showNotification) {
      window.showNotification(message, type);
    }
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">
          {mode === 'admin' ? '🔐 ' : ''}
          {isRegister ? 'Create Account' : 'Login'}
          <span className={`mode-indicator ${mode}`}>
            {mode === 'admin' ? 'ADMIN MODE' : 'USER MODE'}
          </span>
        </h2>
        
        {mode === 'admin' && (
          <p className="admin-notice">
            ⚠️ Admin Access Mode Activated
          </p>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {errors.general && (
            <div className="error-message" style={{ 
              color: '#ff4444', 
              background: '#330000', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {errors.general}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="your.email@example.com"
              value={form.email}
              onChange={e => handleInputChange('email', e.target.value)}
              disabled={loading}
              required
            />
            {errors.email && <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>{errors.email}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => handleInputChange('password', e.target.value)}
              disabled={loading}
              required
            />
            {errors.password && <p style={{ color: '#ff4444', fontSize: '12px', marginTop: '4px' }}>{errors.password}</p>}
          </div>

          {/* Account Type Selection for User Registration */}
          {mode === 'user' && isRegister && (
            <div className="form-group">
              <label className="form-label">Account Type</label>
              <div className="account-type-selector">
                <div 
                  className={`account-type-option ${accountType === 'user' ? 'selected' : ''}`}
                  onClick={() => setAccountType('user')}
                >
                  <div className="account-type-icon">🛒</div>
                  <div className="account-type-info">
                    <h4>Regular User</h4>
                    <p>Shop and purchase products</p>
                  </div>
                </div>
                
                <div 
                  className={`account-type-option ${accountType === 'affiliate' ? 'selected' : ''}`}
                  onClick={() => setAccountType('affiliate')}
                >
                  <div className="account-type-icon">💰</div>
                  <div className="account-type-info">
                    <h4>Affiliate</h4>
                    <p>Earn commissions on referrals</p>
                    <small className="affiliate-note">Requires approval</small>
                  </div>
                </div>
              </div>
              
              {accountType === 'affiliate' && (
                <div className="affiliate-benefits">
                  <h5>Affiliate Benefits:</h5>
                  <ul>
                    <li>Earn 10% commission on referred sales</li>
                    <li>Custom tracking links for all products</li>
                    <li>Real-time dashboard with earnings</li>
                    <li>Monthly payouts via PayPal/Stripe</li>
                    <li>30-day cookie tracking</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                {isRegister ? 'Creating Account...' : 'Logging in...'}
              </>
            ) : (
              isRegister ? 'Create Account' : 'Login'
            )}
          </button>
        </form>

        <div className="form-divider">
          <span>OR</span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button 
            type="button" 
            onClick={() => setIsRegister(!isRegister)}
            className="toggle-btn"
            disabled={loading}
          >
            {isRegister 
              ? 'Already have an account? Login here' 
              : "Don't have an account? Register here"}
          </button>
          
          {mode === 'admin' && (
            <p className="admin-note">
              <strong>Note:</strong> Only authorized administrators can create admin accounts.
              Contact your system administrator for access credentials.
            </p>
          )}
          
          {mode === 'user' && (
            <>
              <button
                type="button"
                onClick={() => navigate('/')}
                style={{
                  background: 'transparent',
                  border: '1px solid #444',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginTop: '16px',
                  width: '100%',
                  fontSize: '14px'
                }}
              >
                ← Back to Store
              </button>
              
              {isRegister && accountType === 'affiliate' && (
                <div className="affiliate-terms">
                  <p style={{ fontSize: '12px', color: '#777', marginTop: '12px' }}>
                    By registering as an affiliate, you agree to our 
                    <a href="#" style={{ color: '#0f0' }}> Affiliate Terms & Conditions</a>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;