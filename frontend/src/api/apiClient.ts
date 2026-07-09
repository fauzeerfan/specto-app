import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Interceptor: catat error lalu teruskan ke pemanggil (ditangani per-halaman).
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API error:', error?.response || error?.message);
    return Promise.reject(error);
  },
);
