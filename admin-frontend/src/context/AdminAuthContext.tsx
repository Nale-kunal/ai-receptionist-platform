/**
 * Admin Auth Context
 *
 * State management for Platform Super Admin authentication.
 * Stores admin user state, handles login, logout, and token session check.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminApiClient } from '../services/adminApiClient';

export interface SuperAdminUser {
  id: string;
  email: string;
  displayName: string;
  mustChangePassword: boolean;
}

interface AdminAuthContextType {
  admin: SuperAdminUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<SuperAdminUser>) => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<SuperAdminUser | null>(() => {
    const cached = localStorage.getItem('adminUser');
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminAccessToken');
    if (token) {
      adminApiClient.get('/auth/me')
        .then((res) => {
          if (res.data?.data?.admin) {
            setAdmin(res.data.data.admin);
            localStorage.setItem('adminUser', JSON.stringify(res.data.data.admin));
          }
        })
        .catch(() => {
          setAdmin(null);
          localStorage.removeItem('adminAccessToken');
          localStorage.removeItem('adminUser');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<{ mustChangePassword: boolean }> => {
    const res = await adminApiClient.post('/auth/login', { email, password });
    const { accessToken, admin: adminData } = res.data.data;

    localStorage.setItem('adminAccessToken', accessToken);
    localStorage.setItem('adminUser', JSON.stringify(adminData));
    setAdmin(adminData);

    return { mustChangePassword: adminData.mustChangePassword };
  };

  const logout = async (): Promise<void> => {
    try {
      await adminApiClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('adminAccessToken');
      localStorage.removeItem('adminUser');
      setAdmin(null);
    }
  };

  const updateUser = (partial: Partial<SuperAdminUser>) => {
    setAdmin((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      localStorage.setItem('adminUser', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        loading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
