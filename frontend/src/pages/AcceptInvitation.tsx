import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  ShieldCheck,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Building2,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface InvitationMeta {
  id: string;
  tenantId: string;
  tenantName: string;
  email: string;
  roleName: string;
  expiresAt: string;
  inviterName?: string;
}

type Phase = 'validating' | 'form' | 'submitting' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Role display helpers
// ---------------------------------------------------------------------------
const ROLE_LABELS: Record<string, string> = {
  clinic_owner: 'Practice Owner',
  doctor: 'Dentist',
  receptionist: 'Receptionist',
};

const ROLE_COLORS: Record<string, string> = {
  clinic_owner: 'var(--primary)',
  doctor: 'var(--success)',
  receptionist: 'var(--warning)',
};

function getRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

function getRoleColor(role: string) {
  return ROLE_COLORS[role] ?? 'var(--primary)';
}

function formatExpiry(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffHours < 0) return 'Expired';
  if (diffHours < 24) return `${diffHours}h remaining`;
  const days = Math.floor(diffHours / 24);
  return `${days}d ${diffHours % 24}h remaining`;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Must include at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Must include at least one lowercase letter.';
  if (!/\d/.test(pw)) return 'Must include at least one number.';
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const AcceptInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';

  const [phase, setPhase] = useState<Phase>('validating');
  const [meta, setMeta] = useState<InvitationMeta | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Field-level validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const pwError = touched.password ? validatePassword(password) : null;
  const confirmError =
    touched.confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : null;

  // ---------------------------------------------------------------------------
  // Validate token on mount
  // ---------------------------------------------------------------------------
  const validateToken = useCallback(async () => {
    if (!rawToken) {
      setPhase('error');
      setErrorMsg('No invitation token found in the URL. Please use the full link from your invitation email.');
      return;
    }

    sessionStorage.setItem('pending_invite_token', rawToken);
    sessionStorage.setItem('pending_invite_redirect', `/invite/accept?token=${rawToken}`);

    try {
      const data = await api.validateInvitationToken(rawToken);
      if (data.isExistingUser || (data.type && data.type !== 'new_user')) {
        navigate(`/invite/review?token=${rawToken}`, { replace: true });
        return;
      }
      setMeta(data);
      setPhase('form');
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(
        err?.response?.data?.error?.message ||
          err.message ||
          'This invitation link is invalid or has expired.',
      );
    }
  }, [rawToken, navigate]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Touch all fields to trigger validation display
    setTouched({ firstName: true, lastName: true, password: true, confirmPassword: true });

    if (!firstName.trim() || !lastName.trim()) {
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr || password !== confirmPassword) {
      return;
    }

    setPhase('submitting');
    try {
      await api.acceptInvitation({ token: rawToken, password, firstName: firstName.trim(), lastName: lastName.trim() });
      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');
      setPhase('success');
    } catch (err: any) {
      setPhase('error');
      setErrorMsg(
        err?.response?.data?.error?.message ||
          err.message ||
          'Failed to create your account. Please try again or contact support.',
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
    padding: '24px',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.15))',
    padding: '40px',
    width: '100%',
    maxWidth: '440px',
    border: '1px solid var(--border-color)',
  };

  // ── Validating phase ──────────────────────────────────────────────────────
  if (phase === 'validating') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Validating your invitation link…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error phase ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--error-light, rgba(239,68,68,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <XCircle size={32} style={{ color: 'var(--error, #ef4444)' }} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Invitation Invalid
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '10px 24px',
                borderRadius: 'var(--radius)',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success phase ─────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--success-light, rgba(34,197,94,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={36} style={{ color: 'var(--success, #22c55e)' }} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Welcome to {meta?.tenantName}!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '8px' }}>
              Your account has been created successfully.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '28px' }}>
              You've been added as <strong>{getRoleLabel(meta?.roleName ?? '')}</strong>.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 32px',
                borderRadius: 'var(--radius)',
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.95rem',
                width: '100%',
              }}
            >
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form / Submitting phases ──────────────────────────────────────────────
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #4f46e5))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(var(--primary-rgb, 99,102,241),0.3)',
          }}>
            <ShieldCheck size={32} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Accept Invitation
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Complete your account setup for <strong>{meta?.tenantName}</strong>
          </p>
        </div>

        {/* Invitation Info Card */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            {/* Clinic */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>{meta?.tenantName}</strong>
              </span>
            </div>

            {/* Email */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Mail size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {meta?.email}
              </span>
            </div>

            {/* Role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: getRoleColor(meta?.roleName ?? ''),
                background: `${getRoleColor(meta?.roleName ?? '')}18`,
                padding: '2px 10px',
                borderRadius: '99px',
              }}>
                {getRoleLabel(meta?.roleName ?? '')}
              </span>
            </div>

            {/* Expiry */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {meta ? formatExpiry(meta.expiresAt) : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                placeholder="Jane"
                style={inputStyle(touched.firstName && !firstName.trim())}
                disabled={phase === 'submitting'}
              />
              {touched.firstName && !firstName.trim() && (
                <p style={fieldErrorStyle}>First name is required.</p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                placeholder="Smith"
                style={inputStyle(touched.lastName && !lastName.trim())}
                disabled={phase === 'submitting'}
              />
              {touched.lastName && !lastName.trim() && (
                <p style={fieldErrorStyle}>Last name is required.</p>
              )}
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder="Min 8 chars, A-Z, a-z, 0-9"
                style={{ ...inputStyle(!!pwError), paddingRight: '44px' }}
                disabled={phase === 'submitting'}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pwError && <p style={fieldErrorStyle}>{pwError}</p>}

            {/* Password strength bars */}
            {password && (
              <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                {[1, 2, 3, 4].map((i) => {
                  const strength = getPasswordStrength(password);
                  const active = i <= strength;
                  const color = strength === 1 ? 'var(--error)' : strength === 2 ? 'var(--warning)' : strength === 3 ? 'var(--primary)' : 'var(--success)';
                  return (
                    <div key={i} style={{ height: '3px', flex: 1, borderRadius: '4px', background: active ? color : 'var(--border-color)', transition: 'background 0.2s' }} />
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                placeholder="Repeat your password"
                style={{ ...inputStyle(!!confirmError), paddingRight: '44px' }}
                disabled={phase === 'submitting'}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmError && <p style={fieldErrorStyle}>{confirmError}</p>}
          </div>

          {/* Terms notice */}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            By accepting, you agree to the platform's terms of service and privacy policy.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={phase === 'submitting'}
            style={{
              padding: '13px 24px',
              borderRadius: 'var(--radius)',
              background: phase === 'submitting' ? 'var(--border-color)' : 'var(--primary)',
              color: phase === 'submitting' ? 'var(--text-muted)' : '#fff',
              border: 'none',
              cursor: phase === 'submitting' ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '0.95rem',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            {phase === 'submitting' ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Creating Account…
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Accept &amp; Join {meta?.tenantName}
              </>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
          >
            Sign in
          </button>
        </p>
      </div>

      {/* Keyframe for spin */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius)',
  border: `1px solid ${hasError ? 'var(--error, #ef4444)' : 'var(--border-color)'}`,
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
});

const fieldErrorStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--error, #ef4444)',
  marginTop: '4px',
  margin: '4px 0 0',
};

function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /\d/.test(pw)) score++;
  if (pw.length >= 12 && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, score);
}

export default AcceptInvitation;
