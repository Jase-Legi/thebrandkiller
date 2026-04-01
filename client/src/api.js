import axios from 'axios';
import { BACKEND_URL } from './config';

export const axiosInstance = axios.create({
  baseURL: BACKEND_URL
});

// Response interceptor (handles 401 globally)
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.showNotification) {
        window.showNotification('Session expired. Please login again.', 'error');
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);