import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { PasswordField } from '../components/PasswordField';
import { Button } from '../components/ui/Button';
import { validateEmail, validatePassword } from '../utils/validators';
import { api } from '../services/api';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');

  // Invitation mode state
  const [invitationMeta, setInvitationMeta] = useState<any | null>(null);
  const [validatingToken, setValidatingToken] = useState<boolean>(!!inviteToken);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If token is present, validate it on mount
  useEffect(() => {
    if (!inviteToken) return;
    setValidatingToken(true);
    api.validateInvitationToken(inviteToken)
      .then((data) => {
        setInvitationMeta(data);
        if (data.email) {
          setEmail(data.email);
        }
      })
      .catch((err) => {
        console.error('Invalid invitation token:', err);
        setGeneralError('This invitation link is invalid or has expired. Please ask your Practice Owner for a new invitation.');
      })
      .finally(() => {
        setValidatingToken(false);
      });
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setSuccessMsg(null);

    const fErr = firstName.trim() ? null : 'First name is required.';
    const lErr = lastName.trim() ? null : 'Last name is required.';
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = password === confirmPassword ? null : 'Passwords do not match.';

    setFirstNameError(fErr);
    setLastNameError(lErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmPasswordError(cErr);

    if (fErr || lErr || eErr || pErr || cErr) {
      return;
    }

    setLoading(true);
    try {
      if (inviteToken && invitationMeta) {
        // Accept invitation flow
        await api.acceptInvitation({
          token: inviteToken,
          password,
          firstName,
          lastName,
        });
        setSuccessMsg('Account created & invitation accepted! You can now log in.');
      } else {
        // Standard Practice Registration flow
        await register({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
        });
        setSuccessMsg('Account created successfully! Please check your email to verify your address.');
      }
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Registration failed.';
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (r?: string) => {
    switch (r) {
      case 'clinic_owner':
      case 'admin':
        return 'Practice Owner';
      case 'doctor':
        return 'Dentist';
      case 'receptionist':
        return 'Receptionist';
      default:
        return 'Staff Member';
    }
  };

  if (validatingToken) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Validating staff invitation link...</p>
        </div>
      </div>
    );
  }

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
          maxWidth: '500px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '6px' }}>
            {invitationMeta ? 'Complete Staff Setup' : 'Create Your Account'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
            {invitationMeta
              ? `You've been invited to join ${invitationMeta.tenantName || 'a practice'} as a ${getRoleDisplayName(invitationMeta.roleName)}.`
              : 'Start managing your dental clinic with AI receptionist.'}
          </p>

          {invitationMeta && (
            <div style={{ marginTop: '12px' }}>
              <Badge variant="primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                Assigned Role: {getRoleDisplayName(invitationMeta.roleName)}
              </Badge>
            </div>
          )}
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

        {!successMsg && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="reg-first-name"
                label="First Name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (firstNameError) setFirstNameError(null);
                }}
                error={firstNameError || undefined}
                required
                disabled={loading}
              />
              <Input
                id="reg-last-name"
                label="Last Name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (lastNameError) setLastNameError(null);
                }}
                error={lastNameError || undefined}
                required
                disabled={loading}
              />
            </div>

            <Input
              id="reg-email"
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
              disabled={loading || !!invitationMeta}
            />

            <PasswordField
              id="reg-password"
              label="Password"
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
              id="reg-confirm-password"
              label="Confirm Password"
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

            <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '12px', padding: '12px' }}>
              {loading ? 'Creating account...' : invitationMeta ? 'Accept Invitation & Complete Setup' : 'Create Account'}
            </Button>
          </form>
        )}

        {!successMsg && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Sign In
              </button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
