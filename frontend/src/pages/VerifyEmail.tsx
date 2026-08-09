import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { validateEmail } from '../utils/validators';

export const VerifyEmail: React.FC = () => {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend form states
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const runVerification = useCallback(async (tok: string) => {
    setLoading(true);
    setError(null);
    try {
      await verifyEmail(tok);
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Verification failed. The link might be expired or invalid.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [verifyEmail]);

  useEffect(() => {
    if (token) {
      runVerification(token);
    } else {
      setError('Missing verification token in request.');
    }
  }, [token, runVerification]);

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSuccess(null);

    const err = validateEmail(resendEmail);
    setResendError(err);
    if (err) return;

    setResendLoading(true);
    try {
      await resendVerification(resendEmail);
      setResendSuccess('A verification email has been resent to your address. Please verify it to log in.');
      setResendEmail('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to resend verification link.';
      setResendError(msg);
    } finally {
      setResendLoading(false);
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
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
            Email Verification
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Confirming your identity for the Dental AI Receptionist platform.
          </p>
        </div>

        {loading && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ margin: '0 auto 16px', border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Verifying your secure token...</p>
          </div>
        )}

        {success && (
          <div style={{ padding: '16px 0' }}>
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
            >
              Email address verified successfully.
            </div>
            <Button type="button" variant="primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
              Go to Sign In
            </Button>
          </div>
        )}

        {error && !loading && !success && (
          <div style={{ padding: '12px 0' }}>
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'var(--error-light)',
                color: 'var(--error)',
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem',
                border: '1px solid var(--error)',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', textAlign: 'left' }}>
              Request New Link
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'left' }}>
              If your link is expired, enter your email below to receive a new one.
            </p>

            {resendError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--error-light)',
                  color: 'var(--error)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8rem',
                  border: '1px solid var(--error)',
                  marginBottom: '12px',
                  textAlign: 'left',
                }}
              >
                {resendError}
              </div>
            )}

            {resendSuccess && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--success-light)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8rem',
                  border: '1px solid var(--success)',
                  marginBottom: '12px',
                  textAlign: 'left',
                }}
              >
                {resendSuccess}
              </div>
            )}

            <form onSubmit={handleResendSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
              <Input
                id="resend-email"
                label="Email Address"
                value={resendEmail}
                onChange={(e) => {
                  setResendEmail(e.target.value);
                  if (resendError) setResendError(null);
                }}
                placeholder="you@clinic.com"
                required
                disabled={resendLoading}
              />
              <Button type="submit" variant="primary" disabled={resendLoading} style={{ width: '100%' }}>
                {resendLoading ? 'Resending...' : 'Resend Verification Link'}
              </Button>
            </form>

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
                marginTop: '16px',
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
