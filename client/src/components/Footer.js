import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Footer({ user }) {
  const location = useLocation();

  return (
    <footer style={{
      borderTop: '1px solid var(--border-color, #000)',
      padding: '16px',
      marginTop: '32px',
      textAlign: 'center',
      fontSize: '0.9em',
      color: 'var(--text-secondary, #aaa)',
      background: 'var(--background-secondary, transparent)'
    }}>
      <p>© 2025 TBK Shop. All rights reserved.</p>
      <div style={{ marginTop: '8px' }}>
        <Link to="/" style={{ margin: '0 12px', color: 'var(--link-color, #fff)' }}>Home</Link>
        <Link to="/checkout" style={{ margin: '0 12px', color: 'var(--link-color, #fff)' }}>Cart</Link>
        
        {/* Only show Admin Login link if not logged in */}
        {!user && (
          <Link 
            to="/login?mode=admin" 
            style={{ 
              margin: '0 12px', 
              color: '#ff4444', 
              fontWeight: 'bold' 
            }}
          >
            Admin Login
          </Link>
        )}
        
        {/* Show user status if logged in */}
        {user && (
          <span style={{ color: '#0f0' }}>
            Logged in as: {user.email} ({user.role.toUpperCase()})
          </span>
        )}
      </div>
      <p style={{ marginTop: '8px', color: 'var(--text-secondary, #aaa)' }}>powered by awbyn</p>
    </footer>
  );
}

export default Footer;