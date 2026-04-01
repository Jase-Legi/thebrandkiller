// src/pages/NotFound.js
import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '60px' }}>
      <h1>404 - Page Not Found</h1>
      <p>The product you're looking for doesn't exist.</p>
      <Link to="/">Go back to home</Link>
    </div>
  );
}

export default NotFound;