/**
 * Admin Layout
 *
 * Premium dark side-navigation layout for Super Admin Console.
 * Features a fixed static 100vh height sidebar with pinned footer controls.
 */

import React from 'react';
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  ShieldCheck,
  Activity,
  LogOut,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { adminFrontendCache } from '../services/adminCacheService';

interface AdminLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ currentTab, onSelectTab, children }) => {
  const { admin, logout } = useAdminAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clinics', label: 'Clinics & Tenants', icon: Building2 },
    { id: 'whatsapp', label: 'WhatsApp Provisioning', icon: MessageSquare },
    { id: 'audit', label: 'Platform Audit Logs', icon: ShieldCheck },
    { id: 'health', label: 'System Health', icon: Activity },
  ];

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-dark)',
      }}
    >
      {/* Static Fixed Height Sidebar */}
      <aside
        style={{
          width: '260px',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '20px 16px',
          flexShrink: 0,
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Top Section: Brand + Password Notice + Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Brand */}
          <div style={{ padding: '4px 8px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px var(--primary-glow)',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                SUPER ADMIN
              </h1>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Platform Console
              </span>
            </div>
          </div>

          {/* Must Change Password Warning Banner */}
          {admin?.mustChangePassword && (
            <div
              style={{
                margin: '0 0 16px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: '0.78rem',
                color: '#F87171',
              }}
            >
              ⚠️ Password change required!
            </div>
          )}

          {/* Nav Items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = currentTab === id;

              const handleMouseEnter = () => {
                if (id === 'dashboard') adminFrontendCache.prefetch('/dashboard');
                else if (id === 'clinics') adminFrontendCache.prefetch('/clinics', { page: 1, search: '' });
                else if (id === 'whatsapp') adminFrontendCache.prefetch('/whatsapp');
                else if (id === 'audit') adminFrontendCache.prefetch('/audit', { page: 1, action: '' });
              };

              return (
                <button
                  key={id}
                  onClick={() => onSelectTab(id)}
                  onMouseEnter={handleMouseEnter}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'white' : 'var(--text-secondary)',
                    backgroundColor: active ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 4px 12px var(--primary-glow)' : 'none',
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Admin User Card — Fixed at bottom of sidebar viewport */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginTop: '16px',
            flexShrink: 0,
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {admin?.displayName || 'Super Admin'}
            </div>
            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {admin?.email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button
              onClick={() => onSelectTab('change-password')}
              title="Change Password"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={() => logout()}
              title="Sign Out"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area — Scrollable independently */}
      <main
        style={{
          flex: 1,
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          padding: '32px 40px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>
    </div>
  );
};
