import React from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks';
import {
  PERM_USER_READ,
  PERM_RBAC_ROLE_MANAGE,
  PERM_CLINIC_READ,
  PERM_CLINIC_SETTINGS_READ,
  PERM_BILLING_READ,
  PERM_REPORT_VIEW,
  PERM_ADMIN_TENANT_MANAGE,
  PERM_ADMIN_PLATFORM,
} from '../../auth/permissions';

// Sub-module components
import { UsersRbac } from '../UsersRbac';
import { RolesPermissions } from '../RolesPermissions';
import { ClinicsPage } from '../ClinicsPage';
import { ClinicSettings } from '../ClinicSettings';
import { Integrations } from '../Integrations';
import { BillingPage } from '../BillingPage';
import { AuditLogs } from '../AuditLogs';
import { Analytics } from '../Analytics';
import { TenantManagement } from '../TenantManagement';
import { SystemAdmin } from '../SystemAdmin';

import {
  Users,
  Shield,
  Building,
  Settings,
  Link,
  CreditCard,
  FileText,
  BarChart3,
  Building2,
  Server,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
}

export const AdminHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const tabs: TabItem[] = [
    { id: 'users', label: 'Team Management', path: '/admin/users', icon: Users, permission: PERM_USER_READ },
    { id: 'roles', label: 'Roles & Access Control', path: '/admin/roles', icon: Shield, permission: PERM_RBAC_ROLE_MANAGE },
    { id: 'clinics', label: 'Practice Locations', path: '/admin/clinics', icon: Building, permission: PERM_CLINIC_READ },
    { id: 'settings', label: 'Practice Settings', path: '/admin/settings', icon: Settings, permission: PERM_CLINIC_SETTINGS_READ },
    { id: 'integrations', label: 'EHR Integrations', path: '/admin/integrations', icon: Link, permission: PERM_CLINIC_SETTINGS_READ },
    { id: 'billing', label: 'Subscription & Billing', path: '/admin/billing', icon: CreditCard, permission: PERM_BILLING_READ },
    { id: 'audit-logs', label: 'Compliance Audit Logs', path: '/admin/audit-logs', icon: FileText, permission: PERM_REPORT_VIEW },
    { id: 'analytics', label: 'Practice Reports', path: '/admin/analytics', icon: BarChart3, permission: PERM_REPORT_VIEW },
    { id: 'tenants', label: 'Tenant Provisioning', path: '/admin/tenants', icon: Building2, permission: PERM_ADMIN_TENANT_MANAGE },
    { id: 'system', label: 'Platform Governance', path: '/admin/system', icon: Server, permission: PERM_ADMIN_PLATFORM },
  ];

  const visibleTabs = tabs.filter((t) => !t.permission || hasPermission(t.permission));

  // Determine default tab route if current tab is not accessible
  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].path : '/admin/users';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Commercial Header Banner */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Practice Administration & Governance
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Manage practice staff, locations, EHR software sync, subscriptions, and compliance logs.
        </p>
      </div>

      {/* Enterprise Tabbed Navigation Bar */}
      {visibleTabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '2px',
          }}
        >
          {visibleTabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Module Routes */}
      <Routes>
        <Route path="users" element={<UsersRbac />} />
        <Route path="roles" element={<RolesPermissions />} />
        <Route path="clinics" element={<ClinicsPage />} />
        <Route path="settings" element={<ClinicSettings />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="tenants" element={<TenantManagement />} />
        <Route path="system" element={<SystemAdmin />} />
        <Route path="*" element={<Navigate to={defaultTab.replace('/admin/', '')} replace />} />
      </Routes>
    </div>
  );
};
