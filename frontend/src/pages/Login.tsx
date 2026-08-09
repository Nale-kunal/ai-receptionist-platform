import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { LoginForm } from '../components/LoginForm';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const storedInviteRedirect = sessionStorage.getItem('pending_invite_redirect');
  const redirectPath =
    redirectParam ||
    storedInviteRedirect ||
    (location.state as any)?.from?.pathname ||
    '/';

  const handleLoginSubmit = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await login(email, pass);
      sessionStorage.removeItem('pending_invite_redirect');
      navigate(redirectPath, { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background visual graphics */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-10%',
          width: '40vw',
          height: '40vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, rgba(0, 0, 0, 0) 70%)',
          zIndex: 1,
        }}
      />

      {/* Floating Theme Toggle Switcher */}
      <button
        type="button"
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          padding: '10px',
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
        aria-label="Toggle Theme"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {/* Main card panel */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          zIndex: 5,
          boxShadow: 'var(--shadow-lg)',
          animation: 'fade-in 0.4s ease-out',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(var(--bg-primary), 0.95)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1.5rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              marginBottom: '16px',
            }}
          >
            D
          </div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', fontWeight: 700, marginBottom: '6px' }}>
            Welcome Back
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            Dental AI Receptionist SaaS Portal. Enter secure credentials.
          </p>
        </div>

        <LoginForm
          onSubmit={handleLoginSubmit}
          isLoading={loading}
          onForgotPasswordClick={() => navigate('/forgot-password')}
          onRegisterClick={() => navigate('/register')}
        />
      </div>
    </div>
  );
};
