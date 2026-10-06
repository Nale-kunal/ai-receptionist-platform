import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../auth/hooks';
import {
  ShieldCheck,
  User,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  X,
  Loader2,
  Building2,
  Clock,
  AlertTriangle,
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

type Phase = 'validating' | 'form' | 'submitting' | 'success' | 'declined' | 'error';

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
// Decline Reason Presets
// ---------------------------------------------------------------------------
interface DeclinePreset {
  id: string;
  label: string;
  description: string;
}

const DECLINE_PRESETS: DeclinePreset[] = [
  {
    id: 'not_interested',
    label: 'Not interested in this role',
    description: 'I am not interested in joining this practice or role at this time.',
  },
  {
    id: 'wrong_email',
    label: 'Invited by mistake / wrong email',
    description: 'This invitation was sent to the wrong email address.',
  },
  {
    id: 'scheduling',
    label: 'Schedule or commitment conflict',
    description: 'Unable to commit due to existing schedules or other practice commitments.',
  },
  {
    id: 'other',
    label: 'Other reason',
    description: 'Provide a custom reason for declining.',
  },
];

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
  const { user, logout } = useAuth();
  const rawToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';

  const [phase, setPhase] = useState<Phase>('validating');
  const [meta, setMeta] = useState<InvitationMeta | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoToLogin = async (prefillEmail?: string) => {
    if (user) {
      await logout();
    }
    const emailParam = prefillEmail ? `&email=${encodeURIComponent(prefillEmail)}` : '';
    navigate(`/login?force=true${emailParam}`, { replace: true });
  };

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

  // Decline state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReasonPreset, setDeclineReasonPreset] = useState<string>('not_interested');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declineError, setDeclineError] = useState('');
  const [recordedDeclineReason, setRecordedDeclineReason] = useState('');

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
      if (data.nextAction === 'SIGN_IN' || data.account?.exists || data.isExistingUser) {
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
  // Submit accept handler
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      await api.acceptInvitation({
        token: rawToken,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
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
  // Submit decline handler
  // ---------------------------------------------------------------------------
  const handleConfirmDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeclineSubmitting(true);
    setDeclineError('');

    const presetObj = DECLINE_PRESETS.find((p) => p.id === declineReasonPreset);
    let finalReason = '';
    if (declineReasonPreset === 'other') {
      finalReason = customDeclineReason.trim() || 'Declined without detailed explanation.';
    } else if (customDeclineReason.trim()) {
      finalReason = `${presetObj?.label || 'Declined'}: ${customDeclineReason.trim()}`;
    } else {
      finalReason = presetObj?.description || presetObj?.label || 'Declined by invitee.';
    }

    try {
      await api.declineInvitation({ token: rawToken, reason: finalReason });
      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');
      setRecordedDeclineReason(finalReason);
      setShowDeclineModal(false);
      setPhase('declined');
    } catch (err: any) {
      console.error('[AcceptInvitation] Error declining invitation:', err);
      setDeclineError(
        err?.response?.data?.error?.message ||
          err.message ||
          'Failed to decline invitation. Please try again.',
      );
    } finally {
      setDeclineSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render styles
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
              onClick={() => handleGoToLogin()}
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

  // ── Declined phase ────────────────────────────────────────────────────────
  if (phase === 'declined') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <XCircle size={36} style={{ color: 'var(--error, #ef4444)' }} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Invitation Declined
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '16px' }}>
              You have declined the invitation to join <strong>{meta?.tenantName}</strong> as <strong>{getRoleLabel(meta?.roleName ?? '')}</strong>.
            </p>
            {recordedDeclineReason && (
              <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                padding: '12px 16px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                  Reason Provided
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  "{recordedDeclineReason}"
                </p>
              </div>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '24px' }}>
              The practice administrator has been notified. If this was done in error, please contact them to send a new invitation.
            </p>
            <button
              onClick={() => handleGoToLogin()}
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
              Return to Login
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
              onClick={() => handleGoToLogin(meta?.email)}
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

          {/* Action Buttons: Accept and Decline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

            <button
              type="button"
              onClick={() => {
                setDeclineError('');
                setShowDeclineModal(true);
              }}
              disabled={phase === 'submitting'}
              style={{
                padding: '11px 20px',
                borderRadius: 'var(--radius)',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                e.currentTarget.style.color = 'var(--error, #ef4444)';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <XCircle size={16} />
              Decline Invitation
            </button>
          </div>
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

      {/* ── Decline Modal with Reason Form ──────────────────────────────────── */}
      {showDeclineModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !declineSubmitting) {
              setShowDeclineModal(false);
            }
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-2xl, 0 25px 50px -12px rgba(0, 0, 0, 0.35))',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxSizing: 'border-box',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--error, #ef4444)',
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Decline Invitation
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {meta?.tenantName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !declineSubmitting && setShowDeclineModal(false)}
                disabled={declineSubmitting}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: declineSubmitting ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to decline this invitation to join <strong>{meta?.tenantName}</strong> as <strong>{getRoleLabel(meta?.roleName ?? '')}</strong>? This invitation link will become invalid.
            </p>

            {declineError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--error, #ef4444)',
                fontSize: '0.825rem',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{declineError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDecline} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Reason Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Please select a reason:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {DECLINE_PRESETS.map((preset) => {
                    const isSelected = declineReasonPreset === preset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => !declineSubmitting && setDeclineReasonPreset(preset.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                          cursor: declineSubmitting ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          id={`preset-${preset.id}`}
                          name="declinePreset"
                          checked={isSelected}
                          onChange={() => setDeclineReasonPreset(preset.id)}
                          disabled={declineSubmitting}
                          style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label
                            htmlFor={`preset-${preset.id}`}
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              marginBottom: '2px',
                            }}
                          >
                            {preset.label}
                          </label>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {preset.description}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed reason textarea */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {declineReasonPreset === 'other' ? 'Specify your reason (required):' : 'Additional comments (optional):'}
                </label>
                <textarea
                  value={customDeclineReason}
                  onChange={(e) => setCustomDeclineReason(e.target.value.slice(0, 500))}
                  placeholder={
                    declineReasonPreset === 'other'
                      ? 'Please describe why you are declining this invitation...'
                      : 'Provide any additional details or feedback for the practice administrator...'
                  }
                  required={declineReasonPreset === 'other'}
                  rows={3}
                  disabled={declineSubmitting}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {customDeclineReason.length}/500
                  </span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  disabled={declineSubmitting}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    cursor: declineSubmitting ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Keep Invitation
                </button>

                <button
                  type="submit"
                  disabled={declineSubmitting || (declineReasonPreset === 'other' && !customDeclineReason.trim())}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--error, #ef4444)',
                    color: '#fff',
                    border: 'none',
                    cursor:
                      declineSubmitting || (declineReasonPreset === 'other' && !customDeclineReason.trim())
                        ? 'not-allowed'
                        : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: declineReasonPreset === 'other' && !customDeclineReason.trim() ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {declineSubmitting ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Declining…
                    </>
                  ) : (
                    'Confirm Decline'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
