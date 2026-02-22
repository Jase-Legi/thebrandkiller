import React, { useEffect } from 'react';
import './Notification.css';

function Notification({ message, type = 'info', duration = 5000, onClose }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success': return '#0f0';
      case 'error': return '#ff4444';
      case 'warning': return '#ffaa00';
      default: return '#fff';
    }
  };

  return (
    <div 
      className="notification"
      style={{
        background: '#111',
        borderLeft: `4px solid ${getColor()}`,
        color: '#fff',
        padding: '16px 20px',
        marginBottom: '12px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '300px',
        maxWidth: '400px',
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <span style={{ fontSize: '20px' }}>{getIcon()}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
          {type === 'error' ? 'Error' : 
           type === 'success' ? 'Success' : 
           type === 'warning' ? 'Warning' : 'Info'}
        </div>
        <div style={{ fontSize: '13px', color: '#ccc' }}>{message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#888',
          fontSize: '20px',
          cursor: 'pointer',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>
    </div>
  );
}

export default Notification;