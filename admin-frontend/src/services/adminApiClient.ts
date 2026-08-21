/**
 * Admin API Client
 *
 * Axios instance preconfigured for the Platform Super Admin Backend (port 3001).
 * Features:
 *   - Auto-attaches Bearer access token from localStorage
 *   - Auto-refreshes token on 401 via HttpOnly cookie
 *   - Clears session and redirects to /login on unrecoverable auth failure
 */

import axios from 'axios';

const ADMIN_API_BASE = (import.meta as any).env?.VITE_ADMIN_API_URL || 'http://localhost:3001/api/v1/admin';

export const adminApiClient = axios.create({
  baseURL: ADMIN_API_BASE,
  withCredentials: true, // Required for HttpOnly refresh token cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: attach Bearer token
adminApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAccessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: handle 401 & token refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle MUST_CHANGE_PASSWORD
    if (error.response?.data?.error?.code === 'MUST_CHANGE_PASSWORD') {
      if (window.location.pathname !== '/change-password') {
        window.location.href = '/change-password';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return adminApiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${ADMIN_API_BASE}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data?.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('adminAccessToken', newAccessToken);
          adminApiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);
          return adminApiClient(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('adminAccessToken');
        localStorage.removeItem('adminUser');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
