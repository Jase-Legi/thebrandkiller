import React from 'react';
import { useTheme } from './ThemeContext';
import './ThemeToggle.css';

function ThemeToggle() {
  const { isDarkTheme, toggleTheme } = useTheme();

  return (
    <button 
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          {isDarkTheme ? '🌙' : '☀️'}
        </div>
      </div>
      <span className="theme-label">
        {isDarkTheme ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}

export default ThemeToggle;