import axios from 'axios';
import { tokenManager } from '../auth/tokenManager';
import { AUTH_ENDPOINTS } from '../auth/constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const axiosClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // critical for HttpOnly cookies (refresh_token)
  timeout: 10000,
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
  headers: {
    'Content-Type': 'application/json',
  },
});

import { telemetry } from './telemetry';

// Request Interceptor: Attach bearer token, correlation headers, and start timer
axiosClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const requestId = telemetry.generateId();
    const correlationId = telemetry.getCorrelationId();
    
    if (config.headers) {
      config.headers['X-Request-Id'] = requestId;
      config.headers['X-Correlation-Id'] = correlationId;
      config.headers['X-Trace-Id'] = requestId;
    }

    (config as any)._startTime = performance.now();
    (config as any)._requestId = requestId;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle 401 and rotate access tokens with request queueing
axiosClient.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any)._startTime;
    if (startTime) {
      const durationMs = Math.round(performance.now() - startTime);
      telemetry.track('api_latency', {
        module: 'api_client',
        action: response.config.url,
        durationMs,
        result: 'success',
        httpStatus: response.status,
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const startTime = (originalRequest as any)?._startTime;
    if (startTime) {
      const durationMs = Math.round(performance.now() - startTime);
      telemetry.track('api_latency', {
        module: 'api_client',
        action: originalRequest?.url,
        durationMs,
        result: 'failure',
        httpStatus: error.response?.status || 500,
        errorCode: error.code || 'ERR_NETWORK',
      });
    }

    // If backend reports clinic or tenant is suspended, immediately clear token and dispatch auth_clinic_suspended
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === 'CLINIC_SUSPENDED' || errorCode === 'TENANT_SUSPENDED') {
        tokenManager.clear();
        window.dispatchEvent(new Event('auth_clinic_suspended'));
      }
      return Promise.reject(error);
    }

    // Avoid token refresh loops if authentication endpoints fail or if originalRequest was already retried.
    // SECURITY: Only dispatch auth_unauthorized on genuine 401 responses — never on 500, 403, or network
    // errors, which would cause spurious logouts when the backend has an unrelated failure.
    if (
      originalRequest.url === AUTH_ENDPOINTS.REFRESH ||
      originalRequest.url === AUTH_ENDPOINTS.ME ||
      originalRequest.url === AUTH_ENDPOINTS.SESSION ||
      originalRequest.url === AUTH_ENDPOINTS.LOGIN ||
      originalRequest.url === AUTH_ENDPOINTS.REGISTER ||
      originalRequest._retry
    ) {
      const isAuth401 = error.response?.status === 401;
      if (
        isAuth401 &&
        originalRequest.url !== AUTH_ENDPOINTS.ME &&
        originalRequest.url !== AUTH_ENDPOINTS.SESSION &&
        originalRequest.url !== AUTH_ENDPOINTS.LOGIN &&
        originalRequest.url !== AUTH_ENDPOINTS.REGISTER
      ) {
        // A retried request or the refresh endpoint itself returned 401 — the session is truly invalid.
        tokenManager.clear();
        window.dispatchEvent(new Event('auth_unauthorized'));
      }
      // For non-401 errors (500, 400, 403, network errors) on retried requests, simply reject
      // without logging out — the failure is not an authentication issue.
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const sessionId = tokenManager.getSessionId() || 'auto-restore';
        // Trigger silent token rotation using raw axios instance with credentials to prevent interceptor loops
        const res = await axios.post(`${API_URL}${AUTH_ENDPOINTS.REFRESH}`, { sessionId }, {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        });
        const data = res.data?.data || res.data;
        const newAccessToken = data.accessToken;

        if (!newAccessToken) {
          throw new Error('Refresh request did not return an access token.');
        }

        tokenManager.setToken(newAccessToken);
        isRefreshing = false;
        processQueue(null, newAccessToken);

        // Retry original request with the new access token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return axiosClient(originalRequest);
      } catch (refreshError: any) {
        isRefreshing = false;
        processQueue(refreshError, null);

        // Only clear tokens and dispatch unauthorized if it was an actual 401 unauthenticated failure
        if (refreshError?.response?.status === 401) {
          tokenManager.clear();
          window.dispatchEvent(new Event('auth_unauthorized'));
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
