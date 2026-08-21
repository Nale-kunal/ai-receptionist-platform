import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks';
import { AppSplashScreen } from '../components/ui/AppSplashScreen';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';

interface AuthGuardProps {
  element: React.ReactElement;
  permission?: string;
  role?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ element, permission, role }) => {
  const { user, authState, clinic, tenant, hasPermission, hasRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. While Auth Bootstrap state is INITIALIZING, render App Splash Screen ONLY
  // Never make redirect or access decisions until Auth Bootstrap finishes.
  if (authState === 'initializing' || authState === 'unknown') {
    return <AppSplashScreen />;
  }

  // 2. Unauthenticated check
  if (authState === 'unauthenticated' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Clinic / Tenant Suspension Check
  if (
    authState === 'suspended' ||
    clinic?.status === 'suspended' ||
    tenant?.status === 'suspended'
  ) {
    return <ClinicSuspendedScreen onLogout={logout} />;
  }

  // 4. Permission Check
  if (permission && !hasPermission(permission)) {
    return <ForbiddenScreen onLogout={logout} onBack={() => navigate('/')} />;
  }

  // 5. Role Check
  if (role && !hasRole(role)) {
    return <ForbiddenScreen onLogout={logout} onBack={() => navigate('/')} />;
  }

  return element;
};

export interface ClinicSuspendedScreenProps {
  onLogout: () => void;
}

export const ClinicSuspendedScreen: React.FC<ClinicSuspendedScreenProps> = ({ onLogout }) => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '80vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          borderTop: '4px solid var(--warning, #f59e0b)',
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: 'var(--warning, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <ShieldAlert size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
          Clinic Access Suspended
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.6' }}>
          Your clinic account is currently suspended. Please contact your platform administrator.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-secondary"
            style={{
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ForbiddenScreenProps {
  onLogout: () => void;
  onBack: () => void;
}

const ForbiddenScreen: React.FC<ForbiddenScreenProps> = ({ onLogout, onBack }) => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '80vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '460px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
          borderTop: '4px solid var(--error)',
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <ShieldAlert size={28} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Page Not Available
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '28px', lineHeight: '1.6' }}>
          You don't have access to this page. Contact your practice owner if you need access.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            className="btn btn-primary"
            style={{
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-secondary"
            style={{
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 500,
            }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
