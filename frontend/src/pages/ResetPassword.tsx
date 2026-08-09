import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { PasswordField } from '../components/PasswordField';
import { Button } from '../components/ui/Button';
import { validatePassword } from '../utils/validators';

export const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMsg(null);

    if (!token) {
      setGeneralError('Invalid or missing password reset token.');
      return;
    }

    const pErr = validatePassword(password);
    const cErr = password === confirmPassword ? null : 'Passwords do not match.';

    setPasswordError(pErr);
    setConfirmPasswordError(cErr);

    if (pErr || cErr) {
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        token,
        newPassword: password,
        confirmPassword,
      });
      setSuccessMsg('Your password has been reset successfully. Please log in with your new credentials.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'An error occurred during reset.';
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
            Reset Password
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            Please enter your new secure password below.
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
              <Button type="button" variant="primary" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </div>
          </div>
        )}

        {!token && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--error-light)',
              color: 'var(--error)',
              borderRadius: 'var(--radius)',
              fontSize: '0.875rem',
              border: '1px solid var(--error)',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            Reset token is missing from the link. Please request a new link from the forgot password page.
            <div style={{ marginTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => navigate('/forgot-password')}>
                Forgot Password Page
              </Button>
            </div>
          </div>
        )}

        {token && !successMsg && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PasswordField
              id="reset-pass"
              label="New Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError || undefined}
              placeholder="••••••••••••"
              required
              disabled={loading}
            />

            <PasswordField
              id="reset-confirm-pass"
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              error={confirmPasswordError || undefined}
              placeholder="••••••••••••"
              required
              disabled={loading}
            />

            <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '8px', padding: '12px' }}>
              {loading ? 'Updating password...' : 'Update Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
