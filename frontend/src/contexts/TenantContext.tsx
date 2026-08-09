import React, { createContext, useContext, useState, useMemo } from 'react';

interface TenantContextType {
  tenantId: string;
  setTenantId: (id: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string>('tenant_dental_first');

  const value = useMemo(() => ({ tenantId, setTenantId }), [tenantId]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used inside a TenantProvider');
  }
  return context;
};
