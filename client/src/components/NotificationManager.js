import React, { useState, useCallback } from 'react';
import Notification from './Notification';
import ConfirmationDialog from './ConfirmationDialog';

let notificationId = 0;

function NotificationManager() {
  const [notifications, setNotifications] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const addNotification = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++notificationId;
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const showConfirmation = useCallback((title, message, onConfirm, onCancel = () => {}) => {
    setConfirmation({
      title,
      message,
      onConfirm: () => {
        setConfirmation(null);
        onConfirm();
      },
      onCancel: () => {
        setConfirmation(null);
        onCancel();
      }
    });
  }, []);

  // Export functions to window for global access
  if (typeof window !== 'undefined') {
    window.showNotification = addNotification;
    window.removeNotification = removeNotification;
    window.clearAllNotifications = clearAllNotifications;
    window.showConfirmation = showConfirmation;
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>

      {confirmation && (
        <ConfirmationDialog
          isOpen={true}
          title={confirmation.title}
          message={confirmation.message}
          onConfirm={confirmation.onConfirm}
          onCancel={confirmation.onCancel}
        />
      )}
    </>
  );
}

export default NotificationManager;

// Export hooks for use in components
export const useNotifications = () => {
  const showNotification = useCallback((message, type = 'info', duration = 5000) => {
    if (window.showNotification) {
      return window.showNotification(message, type, duration);
    }
    return null;
  }, []);

  const removeNotification = useCallback((id) => {
    if (window.removeNotification) {
      window.removeNotification(id);
    }
  }, []);

  const clearAllNotifications = useCallback(() => {
    if (window.clearAllNotifications) {
      window.clearAllNotifications();
    }
  }, []);

  const showConfirmation = useCallback((title, message, onConfirm, onCancel) => {
    if (window.showConfirmation) {
      window.showConfirmation(title, message, onConfirm, onCancel);
    }
  }, []);

  return {
    showNotification,
    removeNotification,
    clearAllNotifications,
    showConfirmation
  };
};