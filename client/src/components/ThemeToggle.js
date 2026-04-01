import React from 'react';
import { useApp } from './AppContext';
import './ThemeToggle.css';

function ThemeToggle() {
  const { isDarkTheme, toggleTheme } = useApp();
  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          {isDarkTheme ? '🌙' : '☀️'}
        </div>
      </div>
      <span className="theme-label">{isDarkTheme ? 'Dark' : 'Light'}</span>
    </button>
  );
}

export default ThemeToggle;