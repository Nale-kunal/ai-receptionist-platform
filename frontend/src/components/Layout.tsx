import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { useTheme } from '../contexts/ThemeContext';
import {
  PERM_CLINIC_READ,
  PERM_APPOINTMENT_READ,
  PERM_CALENDAR_READ,
  PERM_PATIENT_READ,
  PERM_CONVERSATION_READ,
  PERM_USER_READ,
  PERM_CLINIC_SETTINGS_READ,
} from '../auth/permissions';
import { LogoutConfirmationModal } from './auth/LogoutConfirmationModal';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCircle,
  Bot,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

interface PrimaryNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  matchPrefix?: string;
  permission?: string;
  /** If set, only these roles will see this item */
  showForRoles?: string[];
  /** If set, these roles will NOT see this item */
  hideForRoles?: string[];
}

// Human-readable page titles for breadcrumb
const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/appointments': 'Appointments',
  '/calendar': 'Calendar',
  '/patients': 'Patients',
  '/ai-receptionist': 'AI Receptionist',
  '/ai-receptionist/overview': 'AI Receptionist',
  '/ai-receptionist/live': 'Live Calls',
  '/ai-receptionist/history': 'Call History',
  '/ai-receptionist/knowledge': 'Knowledge Base',
  '/ai-receptionist/hours': 'Business Hours',
  '/ai-receptionist/assistant': 'AI Assistant',
  '/ai-receptionist/advanced': 'Advanced',
  '/settings': 'Settings',
  '/settings/practice': 'Practice',
  '/settings/team': 'Team',
  '/settings/hours': 'Business Hours',
  '/settings/billing': 'Billing',
  '/settings/integrations': 'Integrations',
  '/settings/security': 'Security',
  '/settings/advanced': 'Advanced',
  '/profile': 'Profile',
  '/onboarding': 'Setup',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match prefixes for nested routes
  for (const [key, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key) && key !== '/') return title;
  }
  return 'Dashboard';
}

// Simplified role display — customer-facing only
function getRoleDisplayName(role?: string): string {
  switch (role) {
    case 'clinic_owner':
    case 'admin':
    case 'tenant_owner':
      return 'Practice Owner';
    case 'doctor':
      return 'Dentist';
    case 'receptionist':
      return 'Receptionist';
    case 'super_admin':
      return 'Administrator';
    default:
      return 'Staff';
  }
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, clinic, tenant, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const userRole = user?.role || '';

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  // Role-aware primary navigation — max 6 items visible per role
  const primaryMenuItems: PrimaryNavItem[] = [
    {
      id: 'dashboard',
      label: userRole === 'doctor' ? "Today's Schedule" : 'Dashboard',
      icon: LayoutDashboard,
      path: '/',
      permission: PERM_CLINIC_READ,
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: Calendar,
      path: '/appointments',
      permission: PERM_APPOINTMENT_READ,
      hideForRoles: ['doctor'],
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: Users,
      path: '/patients',
      permission: PERM_PATIENT_READ,
    },
    {
      id: 'ai-receptionist',
      label: 'AI Receptionist',
      icon: Bot,
      path: '/ai-receptionist/overview',
      matchPrefix: '/ai-receptionist',
      permission: PERM_CONVERSATION_READ,
      hideForRoles: ['doctor'],
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      path: '/calendar',
      permission: PERM_CALENDAR_READ,
      showForRoles: ['doctor', 'receptionist'],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings/practice',
      matchPrefix: '/settings',
      permission: PERM_CLINIC_SETTINGS_READ,
      hideForRoles: ['doctor', 'receptionist'],
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserCircle,
      path: '/profile',
    },
  ];

  // Filter nav items by role and permission
  const visibleMenuItems = primaryMenuItems.filter((item) => {
    // Permission check
    if (item.permission && !hasPermission(item.permission)) return false;
    // Role whitelist
    if (item.showForRoles && !item.showForRoles.includes(userRole)) return false;
    // Role blacklist
    if (item.hideForRoles && item.hideForRoles.includes(userRole)) return false;
    return true;
  });

  const clinicName = clinic?.name || tenant?.name || 'Clinic';
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="flex w-full" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)' }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: '240px',
          backgroundColor: 'var(--bg-primary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 10,
        }}
      >
        {/* Brand Header */}
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
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.1rem',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
              flexShrink: 0,
            }}
          >
            {clinicName.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
            >
              {clinicName}
            </h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI Receptionist</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ flexGrow: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {visibleMenuItems.map((item) => {
              const isActive = item.matchPrefix
                ? location.pathname.startsWith(item.matchPrefix)
                : location.pathname === item.path;

              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(item.path)}
                    onMouseEnter={() => {
                      if (item.path.startsWith('/appointments')) import('../pages/Appointments');
                      else if (item.path.startsWith('/patients')) import('../pages/Patients');
                      else if (item.path.startsWith('/calendar')) import('../pages/CalendarPage');
                      else if (item.path.startsWith('/ai-receptionist')) import('../pages/ai/AiReceptionistHub');
                      else if (item.path.startsWith('/settings')) import('../pages/settings/SettingsHub');
                      else if (item.path.startsWith('/profile')) import('../pages/UserProfile');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 12px',
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

        {/* User Account Footer */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <p
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                margin: 0,
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                color: 'var(--text-primary)',
              }}
            >
              {user?.firstName
                ? `${user.firstName} ${user.lastName || ''}`
                : user?.email || 'User'}
            </p>
            <span
              style={{
                fontSize: '0.65rem',
                padding: '1px 6px',
                marginTop: '3px',
                display: 'inline-block',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                fontWeight: 600,
                borderRadius: '10px',
              }}
            >
              {getRoleDisplayName(userRole)}
            </span>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Sign Out"
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '56px',
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>{clinicName}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pageTitle}</span>
          </div>

          <button
            onClick={toggleTheme}
            style={{
              padding: '7px',
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Dynamic Page Body */}
        <div style={{ padding: '24px', flexGrow: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutConfirm}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
};
