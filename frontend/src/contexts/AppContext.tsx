import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserSession {
  userId: string;
  email: string;
  role: 'super_admin' | 'admin' | 'receptionist' | 'doctor' | 'patient';
  tenantId: string;
}

interface AppContextType {
  user: UserSession | null;
  theme: 'light' | 'dark';
  tenantId: string;
  setTenantId: (id: string) => void;
  toggleTheme: () => void;
  login: (email: string, role: UserSession['role']) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('e2e_user_session');
    return saved ? JSON.parse(saved) : {
      userId: 'usr_receptionist',
      email: 'receptionist@clinic.com',
      role: 'receptionist',
      tenantId: 'tenant_dental_first',
    };
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('e2e_theme') as 'light' | 'dark') || 'dark';
  });

  const [tenantId, setTenantIdState] = useState<string>(() => {
    return user?.tenantId || 'tenant_dental_first';
  });

  useEffect(() => {
    localStorage.setItem('e2e_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTenantId = (id: string) => {
    setTenantIdState(id);
    if (user) {
      const updated = { ...user, tenantId: id };
      setUser(updated);
      localStorage.setItem('e2e_user_session', JSON.stringify(updated));
    }
  };

  const login = (email: string, role: UserSession['role']) => {
    const session: UserSession = {
      userId: `usr_${role}`,
      email,
      role,
      tenantId: 'tenant_dental_first',
    };
    setUser(session);
    setTenantIdState('tenant_dental_first');
    localStorage.setItem('e2e_user_session', JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('e2e_user_session');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    // Direct mapping to the RBAC matrix defined in the backend/RBAC tests
    const permissionsMap: Record<UserSession['role'], string[]> = {
      super_admin: ['*'],
      admin: [
        'clinic.view', 'clinic.update',
        'doctor.create', 'doctor.update', 'doctor.view',
        'patient.create', 'patient.update', 'patient.view',
        'appointment.create', 'appointment.update', 'appointment.view', 'appointment.delete',
        'configuration.view', 'configuration.update',
        'prompt.view', 'prompt.update',
        'audit.view', 'health.view',
      ],
      receptionist: [
        'patient.create', 'patient.update', 'patient.view',
        'appointment.create', 'appointment.update', 'appointment.view',
        'configuration.view',
        'prompt.view',
      ],
      doctor: [
        'doctor.view', 'patient.view', 'appointment.view',
      ],
      patient: [
        'patient.view', 'appointment.view', 'appointment.create',
      ],
    };

    const allowed = permissionsMap[user.role] || [];
    return allowed.includes(permission) || allowed.includes('*');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        theme,
        tenantId,
        setTenantId,
        toggleTheme,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside an AppProvider');
  }
  return context;
};
