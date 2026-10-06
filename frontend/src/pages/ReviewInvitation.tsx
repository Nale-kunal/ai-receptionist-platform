import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  ArrowRight,
  Building2,
  Mail,
  Clock,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

const ROLE_LABEL_MAP: Record<string, string> = {
  clinic_owner: 'Practice Owner',
  doctor: 'Dentist',
  receptionist: 'Receptionist',
  admin: 'Administrator',
};

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

export const ReviewInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAuthenticated = Boolean(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<'accepted' | 'declined' | null>(null);

  // Form fields for New User Signup (when nextAction === 'SIGN_UP')
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Decline states
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReasonPreset, setDeclineReasonPreset] = useState<string>('not_interested');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [declineError, setDeclineError] = useState('');
  const [recordedDeclineReason, setRecordedDeclineReason] = useState('');

  const validatePassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pw)) return 'Must include at least one uppercase letter.';
    if (!/[a-z]/.test(pw)) return 'Must include at least one lowercase letter.';
    if (!/\d/.test(pw)) return 'Must include at least one number.';
    return null;
  };

  const pwError = touched.password ? validatePassword(password) : null;
  const confirmError =
    touched.confirmPassword && password !== confirmPassword ? 'Passwords do not match.' : null;

  const handleGoToLogin = async (prefillEmail?: string) => {
    if (user) {
      await logout();
    }
    const emailParam = prefillEmail ? `&email=${encodeURIComponent(prefillEmail)}` : '';
    navigate(`/login?force=true${emailParam}`, { replace: true });
  };

  const loadInvitation = (rawToken: string) => {
    if (!rawToken) {
      setError('Invalid or missing invitation token. Please check your invitation link.');
      setErrorCode('INVALID_INVITATION_TOKEN');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('pending_invite_token', rawToken);
    sessionStorage.setItem('pending_invite_redirect', `/invite/review?token=${rawToken}`);

    setLoading(true);
    setError(null);
    setErrorCode(null);

    api
      .validateInvitationToken(rawToken)
      .then((data) => {
        setInvitationData(data);
        setError(null);
        setErrorCode(null);
      })
      .catch((err) => {
        console.error(err);
        const code = err?.response?.data?.error?.code || 'VALIDATION_FAILED';
        const msg =
          err?.response?.data?.error?.message ||
          err.message ||
          'Invitation token is invalid, expired, or has already been used.';
        setErrorCode(code);
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    const rawToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
    loadInvitation(rawToken);
  }, [searchParams]);

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, password: true, confirmPassword: true });

    if (!firstName.trim() || !lastName.trim()) return;
    const pwErr = validatePassword(password);
    if (pwErr || password !== confirmPassword) return;

    setSubmitting(true);
    setError(null);
    setErrorCode(null);

    try {
      const activeToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
      await api.acceptInvitation({
        token: activeToken,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');

      setActionSuccess('accepted');
    } catch (err: any) {
      console.error(err);
      const code = err?.response?.data?.error?.code || 'SIGNUP_FAILED';
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to complete account registration.';
      setErrorCode(code);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    setErrorCode(null);

    try {
      const activeToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
      await api.acceptInvitation({ token: activeToken });

      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');

      if (user) {
        setActionSuccess('accepted');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        setActionSuccess('accepted');
      }
    } catch (err: any) {
      console.error(err);
      const code = err?.response?.data?.error?.code || 'ACCEPTANCE_FAILED';
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to accept invitation.';
      setErrorCode(code);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
      const activeToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
      await api.declineInvitation({ token: activeToken, reason: finalReason });
      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');
      setRecordedDeclineReason(finalReason);
      setShowDeclineModal(false);
      setActionSuccess('declined');
      if (isAuthenticated) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to decline invitation.';
      setDeclineError(msg);
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    width: '100vw',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily: 'Inter, system-ui, sans-serif',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    borderRadius: '20px',
    boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.25))',
    padding: '40px',
    width: '100%',
    maxWidth: '520px',
    border: '1px solid var(--border-color)',
    boxSizing: 'border-box',
  };

  const isNewUser = Boolean(
    invitationData &&
      (invitationData.nextAction === 'SIGN_UP' ||
        (!invitationData.account?.exists && !invitationData.isExistingUser)),
  );

  // 1. Loading State
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}>
              Checking invitation…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error && !invitationData) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <XCircle size={32} style={{ color: 'var(--error, #ef4444)' }} />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Invitation Unavailable
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {error}
            </p>
            <Button
              onClick={() => handleGoToLogin()}
              variant="primary"
              style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Accepted Success View
  if (actionSuccess === 'accepted') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle2 size={36} style={{ color: 'var(--success, #22c55e)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {isNewUser ? 'Account Created & Joined!' : 'Role Updated Successfully!'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {isNewUser
                ? `You have joined ${invitationData.clinicName || invitationData.tenantName} as ${ROLE_LABEL_MAP[invitationData.roleName] || invitationData.roleName}.`
                : `You are now a ${ROLE_LABEL_MAP[invitationData.roleName] || invitationData.roleName} in ${invitationData.clinicName || invitationData.tenantName}.`}
            </p>
            {user ? (
              <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                Redirecting to Dashboard…
              </p>
            ) : (
              <Button
                onClick={() => handleGoToLogin(invitationData.email)}
                variant="primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                Sign In to Your Account →
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. Declined View
  if (actionSuccess === 'declined') {
    const currentRoleLabel = invitationData.currentRoleName
      ? ROLE_LABEL_MAP[invitationData.currentRoleName] || invitationData.currentRoleName
      : 'current role';

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <XCircle size={36} style={{ color: 'var(--error, #ef4444)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Invitation Declined
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '16px' }}>
              You have declined the invitation to join <strong>{invitationData.clinicName || invitationData.tenantName}</strong>.{' '}
              {isAuthenticated ? `Your role remains unchanged as ${currentRoleLabel}.` : ''}
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
              {isAuthenticated ? 'Redirecting to Dashboard…' : 'The practice administrator has been notified.'}
            </p>
            {!isAuthenticated && (
              <Button
                onClick={() => handleGoToLogin()}
                variant="primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                Back to Login
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 5. Case B — No Existing Account (SIGN_UP Flow with Password + Confirm Password)
  if (isNewUser) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {invitationData.clinicName || invitationData.tenantName}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team Membership &amp; Role Assignment</span>
            </div>
          </div>

          <div style={{ background: 'rgba(99, 102, 241, 0.06)', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.5 }}>
              <strong>{invitationData.inviterName || invitationData.invitedByName || 'Practice Owner'}</strong> invited <strong>{invitationData.email}</strong> to join <strong>{invitationData.clinicName || invitationData.tenantName}</strong> as a{' '}
              <Badge variant="primary">{ROLE_LABEL_MAP[invitationData.roleName] || invitationData.role || invitationData.roleName}</Badge>.
            </p>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
              Create your Dental AI account to continue.
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--error, #ef4444)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--error, #ef4444)' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignupAndAccept} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  First Name <span style={{ color: 'var(--error, #ef4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: touched.firstName && !firstName.trim() ? '1px solid var(--error, #ef4444)' : '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Last Name <span style={{ color: 'var(--error, #ef4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: touched.lastName && !lastName.trim() ? '1px solid var(--error, #ef4444)' : '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  value={invitationData.email}
                  readOnly
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary, rgba(0,0,0,0.05))',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    cursor: 'not-allowed',
                    boxSizing: 'border-box',
                  }}
                />
                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Invitation is bound to this email address.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password <span style={{ color: 'var(--error, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="Min. 8 chars, uppercase, lowercase, number"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    borderRadius: '8px',
                    border: pwError ? '1px solid var(--error, #ef4444)' : '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwError && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>
                  {pwError}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Confirm Password <span style={{ color: 'var(--error, #ef4444)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                  placeholder="Re-enter password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 36px 10px 12px',
                    borderRadius: '8px',
                    border: confirmError ? '1px solid var(--error, #ef4444)' : '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmError && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error, #ef4444)', marginTop: '4px', display: 'block' }}>
                  {confirmError}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                {submitting ? 'Creating Account…' : 'Create Account →'}
              </Button>

              <Button
                type="button"
                onClick={() => {
                  setDeclineError('');
                  setShowDeclineModal(true);
                }}
                disabled={submitting}
                variant="secondary"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                <XCircle size={16} />
                Decline Invitation
              </Button>
            </div>
          </form>
        </div>

        {/* Decline Modal */}
        {renderDeclineModal()}
      </div>
    );
  }

  // 6. Case A — Existing Account (Unauthenticated Prompt)
  if (!isAuthenticated) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {invitationData.clinicName || invitationData.tenantName}
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team Membership &amp; Role Assignment</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.5 }}>
              <strong>{invitationData.inviterName || invitationData.invitedByName || 'Practice Admin'}</strong> invited <strong>{invitationData.email}</strong> to join <strong>{invitationData.clinicName || invitationData.tenantName}</strong> as a{' '}
              <Badge variant="primary">{ROLE_LABEL_MAP[invitationData.roleName] || invitationData.role || invitationData.roleName}</Badge>.
            </p>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0 }}>
              You already have a Dental AI account with this email address. Sign in to continue and review this invitation.
            </p>
          </div>

          <Button
            onClick={() => handleGoToLogin(invitationData.email)}
            variant="primary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            Sign In with Existing Account →
          </Button>
        </div>
      </div>
    );
  }

  // 7. Case A — Existing Account (Authenticated Role Review)
  const currentRoleDisplay = invitationData.currentRoleName
    ? ROLE_LABEL_MAP[invitationData.currentRoleName] || invitationData.currentRoleName
    : 'None';
  const targetRoleDisplay = ROLE_LABEL_MAP[invitationData.roleName] || invitationData.role || invitationData.roleName;

  const isEmailMismatch = Boolean(
    user && invitationData && user.email.toLowerCase() !== invitationData.email.toLowerCase(),
  );

  function renderDeclineModal() {
    if (!showDeclineModal) return null;
    return (
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
          }}
        >
          {/* Header */}
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
                  {invitationData?.clinicName || invitationData?.tenantName}
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
            Are you sure you want to decline this invitation to join <strong>{invitationData?.clinicName || invitationData?.tenantName}</strong> as <strong>{ROLE_LABEL_MAP[invitationData?.roleName] || invitationData?.roleName}</strong>?
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
                        id={`review-preset-${preset.id}`}
                        name="reviewDeclinePreset"
                        checked={isSelected}
                        onChange={() => setDeclineReasonPreset(preset.id)}
                        disabled={declineSubmitting}
                        style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label
                          htmlFor={`review-preset-${preset.id}`}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
              <Button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                disabled={declineSubmitting}
                variant="secondary"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                Keep Invitation
              </Button>

              <Button
                type="submit"
                disabled={declineSubmitting || (declineReasonPreset === 'other' && !customDeclineReason.trim())}
                variant="danger"
                style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
              >
                {declineSubmitting ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Declining…
                  </>
                ) : (
                  'Confirm Decline'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>Review Role Invitation</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enterprise Access Governance</span>
            </div>
          </div>
          <Badge variant="primary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
            {invitationData.type === 'role_change' ? 'Role Change' : 'Practice Invitation'}
          </Badge>
        </div>

        {/* Account Mismatch Notice */}
        {isEmailMismatch && (
          <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: '#eab308', flexShrink: 0 }} />
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                Currently signed in as <strong>{user?.email}</strong>. This invitation was sent to <strong>{invitationData.email}</strong>.
              </span>
            </div>
            <button
              onClick={async () => { await logout(); }}
              style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Overview Banner */}
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
            <strong>{invitationData.inviterName || invitationData.invitedByName || 'Practice Admin'}</strong> has invited you to join <strong>{invitationData.clinicName || invitationData.tenantName}</strong>.
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--error, #ef4444)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--error, #ef4444)' }}>{error}</span>
          </div>
        )}

        {/* Role Comparison Card */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '14px', padding: '18px 20px', marginBottom: '24px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Role</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{currentRoleDisplay}</span>
          </div>

          <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            <ArrowRight size={22} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Proposed New Role</span>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)' }}>{targetRoleDisplay}</span>
          </div>
        </div>

        {/* Details & Expiry */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '28px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Mail size={15} style={{ color: 'var(--text-muted)' }} /> Invited Email:
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{invitationData.email}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Clock size={15} style={{ color: 'var(--text-muted)' }} /> Expiration:
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {new Date(invitationData.expiresAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
          <Button
            onClick={() => {
              setDeclineError('');
              setShowDeclineModal(true);
            }}
            disabled={submitting}
            variant="secondary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            Decline
          </Button>

          <Button
            onClick={handleAccept}
            disabled={submitting || isEmailMismatch}
            variant="primary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            {submitting ? 'Processing…' : 'Accept Role & Join Practice'}
          </Button>
        </div>

        {/* Decline Modal */}
        {renderDeclineModal()}
      </div>
    </div>
  );
};

export default ReviewInvitation;
