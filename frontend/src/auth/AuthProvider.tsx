import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { AuthContextType, User, TenantInfo, ClinicInfo, AuthState } from './types';
import { authService } from './authService';
import { tokenManager } from './tokenManager';
import { useTenant } from '../contexts/TenantContext';
import { api, invalidateApiCache } from '../services/api';
import { telemetry } from '../services/telemetry';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-scoped promise to deduplicate session recovery across React 18 StrictMode double-mounts
let activeSessionPromise: Promise<any> | null = null;

// Pre-warm data cache in background non-blocking for authorized workflows
const prewarmDataCache = (role?: string) => {
  if (role === 'doctor') {
    Promise.allSettled([
      api.getDashboardSummary(),
      api.getDoctors(),
      api.getPatients(),
    ]).catch(() => {});
    return;
  }
  Promise.allSettled([
    api.getDashboardSummary(),
    api.getClinicSettings(),
    api.getDoctors(),
    api.getPatients(),
  ]).catch(() => {});
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [authState, setAuthState] = useState<AuthState>('initializing');
  const [loading, setLoading] = useState<boolean>(true);

  const { setTenantId } = useTenant();

  const recoverSession = useCallback(async () => {
    if (activeSessionPromise) {
      try {
        await activeSessionPromise;
      } catch {
        // Ignored — handled by primary runner
      }
      return;
    }

    activeSessionPromise = (async () => {
      try {
        const sessionData = await authService.getSession();
        if (
          sessionData?.suspended ||
          sessionData?.error?.code === 'CLINIC_SUSPENDED' ||
          sessionData?.tenant?.status === 'suspended' ||
          sessionData?.clinic?.status === 'suspended'
        ) {
          tokenManager.clear();
          setUser(null);
          setRoles([]);
          setPermissions([]);
          setTenant(sessionData.tenant ?? null);
          setClinic(sessionData.clinic ?? null);
          setAuthState('suspended');
          setLoading(false);
          return;
        }

        if (sessionData && sessionData.authenticated && sessionData.accessToken && sessionData.user) {
          tokenManager.setToken(sessionData.accessToken);
          setUser(sessionData.user);
          setRoles(sessionData.roles ?? []);
          setPermissions(sessionData.permissions ?? []);
          setTenant(sessionData.tenant ?? null);
          setClinic(sessionData.clinic ?? null);
          if (sessionData.tenant?.id) {
            setTenantId(sessionData.tenant.id);
          }
          setAuthState('authenticated');
          prewarmDataCache(sessionData.user.role);
        } else {
          tokenManager.clear();
          setUser(null);
          setRoles([]);
          setPermissions([]);
          setTenant(null);
          setClinic(null);
          setAuthState('unauthenticated');
        }
      } catch (err: any) {
        const errorCode = err?.response?.data?.error?.code;
        if (errorCode === 'CLINIC_SUSPENDED' || errorCode === 'TENANT_SUSPENDED') {
          tokenManager.clear();
          setUser(null);
          setRoles([]);
          setPermissions([]);
          setTenant(null);
          setClinic(null);
          setAuthState('suspended');
          setLoading(false);
          return;
        }
        tokenManager.clear();
        setUser(null);
        setRoles([]);
        setPermissions([]);
        setTenant(null);
        setClinic(null);
        setAuthState('unauthenticated');
      } finally {
        setLoading(false);
        activeSessionPromise = null;
      }
    })();

    await activeSessionPromise;
  }, [setTenantId]);

  // Execute Auth Bootstrap EXACTLY ONCE on application startup
  useEffect(() => {
    recoverSession();

    // Listen for unauthorized session invalidation events from axios client
    const handleUnauthorized = () => {
      tokenManager.clear();
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setTenant(null);
      setClinic(null);
      setAuthState('unauthenticated');
      setLoading(false);
    };

    // Listen for clinic suspended event from axios client
    const handleClinicSuspended = () => {
      tokenManager.clear();
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setClinic((prev) => prev ? { ...prev, status: 'suspended' } : null);
      setTenant((prev) => prev ? { ...prev, status: 'suspended' } : null);
      setAuthState('suspended');
      setLoading(false);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_logout_event') {
        handleUnauthorized();
      }
    };

    window.addEventListener('auth_unauthorized', handleUnauthorized);
    window.addEventListener('auth_clinic_suspended', handleClinicSuspended);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
      window.removeEventListener('auth_clinic_suspended', handleClinicSuspended);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [recoverSession]);

  const getDefaultRolePermissions = (role: string): string[] => {
    if (role === 'super_admin' || role === 'clinic_owner' || role === 'admin' || role === 'tenant_owner') return ['*'];
    if (role === 'doctor') {
      return [
        'clinic.read',
        'appointment.read',
        'appointment.update',
        'patient.read',
        'patient.update',
        'conversation.summary',
        'calendar.read',
        'calendar.write',
        'doctor.read',
        'faq.read',
        'notification.read',
      ];
    }
    return [
      'clinic.read',
      'appointment.read',
      'appointment.update',
      'patient.read',
      'patient.update',
      'conversation.read',
      'notification.read',
      'calendar.read',
    ];
  };

  const login = async (credentialsOrEmail: any, passwordArg?: string) => {
    const email = typeof credentialsOrEmail === 'string' ? credentialsOrEmail : credentialsOrEmail?.email;
    const password = typeof credentialsOrEmail === 'string' ? passwordArg : credentialsOrEmail?.password;

    setLoading(true);
    try {
      const result = await authService.login(email, password);
      tokenManager.setToken(result.accessToken);

      const activeUser = result.user;
      const activeRoles = result.roles && result.roles.length > 0 ? result.roles : [activeUser.role];
      const activePermissions = result.permissions && result.permissions.length > 0
        ? result.permissions
        : getDefaultRolePermissions(activeUser.role);

      setUser(activeUser);
      setRoles(activeRoles);
      setPermissions(activePermissions);
      setTenant(result.tenant ?? null);
      setClinic(result.clinic ?? null);
      if (result.tenant?.id) {
        setTenantId(result.tenant.id);
      }

      setAuthState('authenticated');
      prewarmDataCache(activeUser.role);
    } catch (err: any) {
      const errorCode = err?.response?.data?.error?.code;
      if (errorCode === 'CLINIC_SUSPENDED' || errorCode === 'TENANT_SUSPENDED') {
        tokenManager.clear();
        setUser(null);
        setRoles([]);
        setPermissions([]);
        setTenant(null);
        setClinic(null);
        setAuthState('suspended');
        throw err;
      }
      setAuthState('unauthenticated');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      telemetry.track('logout', {
        module: 'auth',
        action: 'logout_successful',
        result: 'success',
      });
    } catch (err) {
      telemetry.track('logout', {
        module: 'auth',
        action: 'logout_failed',
        result: 'failure',
      });
    } finally {
      invalidateApiCache();
      tokenManager.clear();
      if (!localStorage.getItem('remember_me_optin')) {
        localStorage.removeItem('e2e_remembered_email');
      }
      setUser(null);
      setRoles([]);
      setPermissions([]);
      setTenant(null);
      setClinic(null);
      setAuthState('unauthenticated');
      setLoading(false);
      
      // Multi-tab logout broadcast
      try {
        localStorage.setItem('auth_logout_event', Date.now().toString());
      } catch (e) {}
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      return await authService.register(data);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    await authService.forgotPassword(email);
  };

  const resetPassword = async (payload: any) => {
    await authService.resetPassword(payload);
  };

  const verifyEmail = async (token: string) => {
    await authService.verifyEmail(token);
  };

  const resendVerification = async (email: string) => {
    await authService.resendVerification(email);
  };

  const hasPermission = useCallback(
    (permissionName: string): boolean => {
      if (!user) return false;
      if (user.role === 'super_admin' || user.role === 'clinic_owner') return true;
      if (permissions.length === 0) {
        const fallbackList = getDefaultRolePermissions(user.role);
        return fallbackList.includes('*') || fallbackList.includes(permissionName);
      }
      return permissions.includes(permissionName) || permissions.includes('*');
    },
    [user, permissions]
  );

  const hasRole = useCallback(
    (roleName: string): boolean => {
      if (!user) return false;
      if (user.role === roleName || user.role === 'super_admin') return true;
      return roles.includes(roleName);
    },
    [user, roles]
  );

  const updateClinicContext = useCallback((updates: Partial<ClinicInfo>) => {
    setClinic((prev) => (prev ? { ...prev, ...updates } : (updates as ClinicInfo)));
    if (updates.name) {
      setTenant((prev) => (prev ? { ...prev, name: updates.name! } : null));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const meData = await authService.fetchMe();
      if (meData?.clinic) setClinic(meData.clinic);
      if (meData?.tenant) setTenant(meData.tenant);
      if (meData?.user) setUser(meData.user);
    } catch {
      // Ignored
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      roles,
      permissions,
      tenant,
      clinic,
      loading,
      authState,
      login,
      logout,
      register,
      forgotPassword,
      resetPassword,
      verifyEmail,
      resendVerification,
      hasPermission,
      hasRole,
      updateClinicContext,
      refreshSession,
    }),
    [
      user,
      roles,
      permissions,
      tenant,
      clinic,
      loading,
      authState,
      hasPermission,
      hasRole,
      updateClinicContext,
      refreshSession,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
