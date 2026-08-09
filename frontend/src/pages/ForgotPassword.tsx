import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { validateEmail } from '../utils/validators';

export const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMsg(null);

    const err = validateEmail(email);
    setEmailError(err);

    if (err) {
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email);
      // Even if email is not found, display successful message to prevent enumeration
      setSuccessMsg('If an account with that email exists, a password reset link has been sent to it.');
      setEmail('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'An error occurred. Please try again.';
      setGeneralError(msg);
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
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
            Forgot Password
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            Enter your email address and we'll send you a password reset link.
          </p>
        </div>

        {generalError && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--error-light)',
              color: 'var(--error)',
              borderRadius: 'var(--radius)',
              fontSize: '0.875rem',
              border: '1px solid var(--error)',
              marginBottom: '16px',
            }}
            role="alert"
          >
            {generalError}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--success-light)',
              color: 'var(--success)',
              borderRadius: 'var(--radius)',
              fontSize: '0.875rem',
              border: '1px solid var(--success)',
              marginBottom: '16px',
            }}
            role="alert"
          >
            {successMsg}
            <div style={{ marginTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => navigate('/login')}>
                Back to Login
              </Button>
            </div>
          </div>
        )}

        {!successMsg && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input
              id="forgot-email"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              error={emailError || undefined}
              placeholder="you@clinic.com"
              required
              disabled={loading}
            />

            <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '8px', padding: '12px' }}>
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        {!successMsg && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
