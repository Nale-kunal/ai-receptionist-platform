import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import {
  LayoutDashboard,
  PhoneCall,
  Calendar,
  Users,
  UserCheck,
  History,
  FileCode,
  Sliders,
  BookOpen,
  Bell,
  Settings,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
  Search,
  Activity,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, theme, toggleTheme, logout, tenantId, setTenantId, hasPermission } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Dashboard Home', icon: LayoutDashboard, path: '/', permission: 'clinic.view' },
    { id: 'live-calls', label: 'Live Call Center', icon: PhoneCall, path: '/live-calls', permission: 'clinic.view' },
    { id: 'appointments', label: 'Appointments', icon: Calendar, path: '/appointments', permission: 'appointment.view' },
    { id: 'patients', label: 'Patients', icon: Users, path: '/patients', permission: 'patient.view' },
    { id: 'doctors', label: 'Doctors', icon: UserCheck, path: '/doctors', permission: 'doctor.view' },
    { id: 'calendar', label: 'Calendar Grid', icon: Calendar, path: '/calendar', permission: 'appointment.view' },
    { id: 'history', label: 'Call Histories', icon: History, path: '/history', permission: 'clinic.view' },
    { id: 'prompts', label: 'Prompt Engine', icon: FileCode, path: '/prompts', permission: 'prompt.view' },
    { id: 'ai-config', label: 'AI Settings', icon: Sliders, path: '/ai-config', permission: 'configuration.view' },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, path: '/knowledge', permission: 'configuration.view' },
    { id: 'notifications', label: 'Reminder Rules', icon: Bell, path: '/notifications', permission: 'configuration.view' },
    { id: 'integrations', label: 'Integrations Link', icon: Settings, path: '/integrations', permission: 'configuration.view' },
    { id: 'users-rbac', label: 'Users & RBAC', icon: Settings, path: '/users-rbac', permission: 'rbac.role.manage' },
    { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert, path: '/audit-logs', permission: 'audit.view' },
    { id: 'health', label: 'System Health', icon: Activity, path: '/health', permission: 'health.view' },
  ];

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    if (paths.length === 0) return ['Dashboard', 'Home'];
    return ['Dashboard', ...paths.map((p) => p.charAt(0).toUpperCase() + p.slice(1))];
  };

  const activeTenantName = tenantId === 'tenant_dental_first' ? 'Dental First Clinic' : 'Metro Orthodontics';

  return (
    <div className="flex w-full" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
      {/* 1. Left Sidebar Navigation */}
      <aside
        style={{
          width: '260px',
          backgroundColor: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            D
          </div>
          <div>
            <h4 style={{ fontSize: '0.925rem', fontWeight: 600 }}>Dental AI SaaS</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enterprise v1.0</span>
          </div>
        </div>

        {/* Tenant Switcher Section */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Tenant
          </label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="input"
            style={{ marginTop: '4px', padding: '4px 8px', fontSize: '0.8rem' }}
          >
            <option value="tenant_dental_first">Dental First Clinic</option>
            <option value="tenant_metro_ortho">Metro Orthodontics</option>
          </select>
        </div>

        {/* Navigation list */}
        <nav style={{ flexGrow: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {menuItems.map((item) => {
              if (!hasPermission(item.permission)) return null;
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(item.path)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User logout section */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.email}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'capitalize', fontWeight: 500 }}>
                {user?.role.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary w-full"
            style={{ padding: '6px 12px', fontSize: '0.825rem', display: 'flex', gap: '8px', justifyContent: 'center' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Right Main Layout Window */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Navbar */}
        <header
          style={{
            height: '60px',
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2" style={{ fontSize: '0.875rem' }}>
            {getBreadcrumbs().map((crumb, idx, arr) => (
              <React.Fragment key={idx}>
                <span
                  style={{
                    color: idx === arr.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: idx === arr.length - 1 ? 600 : 400,
                  }}
                >
                  {crumb}
                </span>
                {idx < arr.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
              </React.Fragment>
            ))}
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-4">
            {/* Global Search Simulator */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Global search..."
                className="input"
                style={{ paddingLeft: '32px', height: '32px' }}
              />
            </div>

            {/* Notification Drawer Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  position: 'relative',
                  padding: '4px',
                }}
              >
                <Bell size={20} />
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--error)',
                  }}
                />
              </button>

              {/* Notification drop menu */}
              {showNotifications && (
                <div
                  className="card"
                  style={{
                    position: 'absolute',
                    top: '36px',
                    right: 0,
                    width: '280px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 20,
                  }}
                >
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '12px' }}>Recent Notifications</h4>
                  <ul style={{ listStyle: 'none', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                      <p style={{ fontWeight: 500 }}>Appointment Confirmed</p>
                      <span style={{ color: 'var(--text-secondary)' }}>Alice Green - Dr. House</span>
                    </li>
                    <li>
                      <p style={{ fontWeight: 500 }}>System Status Alert</p>
                      <span style={{ color: 'var(--text-secondary)' }}>All voice servers are running.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div
              style={{
                height: '32px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'var(--bg-tertiary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              {activeTenantName}
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main style={{ flexGrow: 1, padding: '32px', overflowY: 'auto' }}>{children}</main>
      </div>
    </div>
  );
};
