import React from 'react';

function ConfirmationDialog({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "warning" // success, warning, danger, info
}) {
  if (!isOpen) return null;

  const getColors = () => {
    switch (type) {
      case 'success': return { bg: '#003300', border: '#0f0', text: '#0f0' };
      case 'danger': return { bg: '#330000', border: '#ff4444', text: '#ff4444' };
      case 'warning': return { bg: '#332200', border: '#ffaa00', text: '#ffaa00' };
      default: return { bg: '#111', border: '#444', text: '#fff' };
    }
  };

  const colors = getColors();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#111',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '400px',
        width: '100%',
        border: `2px solid ${colors.border}`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <h3 style={{ 
          color: colors.text, 
          marginBottom: '16px', 
          fontSize: '22px',
          textAlign: 'center'
        }}>
          {title}
        </h3>
        
        <p style={{ 
          color: '#ccc', 
          marginBottom: '32px', 
          fontSize: '16px',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          {message}
        </p>

        <div style={{ 
          display: 'flex', 
          gap: '16px',
          justifyContent: 'center'
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: 'transparent',
              color: '#aaa',
              border: '1px solid #555',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.target.background = '#222';
              e.target.borderColor = '#777';
            }}
            onMouseLeave={(e) => {
              e.target.background = 'transparent';
              e.target.borderColor = '#555';
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '12px 24px',
              background: type === 'danger' ? '#ff4444' : colors.border,
              color: type === 'danger' ? '#fff' : '#000',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              if (type === 'danger') {
                e.target.background = '#ff6666';
              } else {
                e.target.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (type === 'danger') {
                e.target.background = '#ff4444';
              } else {
                e.target.opacity = '1';
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationDialog;