import { axiosClient } from '../services/axiosClient';
import { AUTH_ENDPOINTS } from './constants';
import { tokenManager } from './tokenManager';

export const authService = {
  login: async (email: string, password: string): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.LOGIN, { email, password });
    const data = res.data?.data || res.data;
    if (data && data.accessToken) {
      tokenManager.setToken(data.accessToken);
    }
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await axiosClient.post(AUTH_ENDPOINTS.LOGOUT);
    } finally {
      tokenManager.clear();
    }
  },

  refresh: async (sessionId: string): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.REFRESH, { sessionId });
    const data = res.data?.data || res.data;
    if (data && data.accessToken) {
      tokenManager.setToken(data.accessToken);
    }
    return data;
  },

  register: async (payload: any): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.REGISTER, payload);
    return res.data?.data || res.data;
  },

  forgotPassword: async (email: string): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, { email });
    return res.data?.data || res.data;
  },

  resetPassword: async (payload: any): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.RESET_PASSWORD, payload);
    return res.data?.data || res.data;
  },

  verifyEmail: async (token: string): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.VERIFY_EMAIL, { token });
    return res.data?.data || res.data;
  },

  resendVerification: async (email: string): Promise<any> => {
    const res = await axiosClient.post(AUTH_ENDPOINTS.RESEND_VERIFICATION, { email });
    return res.data?.data || res.data;
  },

  fetchMe: async (): Promise<any> => {
    const res = await axiosClient.get(AUTH_ENDPOINTS.ME);
    return res.data?.data || res.data;
  },

  getSession: async (): Promise<any> => {
    const res = await axiosClient.get(AUTH_ENDPOINTS.SESSION);
    const data = res.data?.data || res.data;
    if (data && data.authenticated && data.accessToken) {
      tokenManager.setToken(data.accessToken);
    }
    return data;
  },
};
