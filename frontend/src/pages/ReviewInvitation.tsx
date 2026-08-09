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
  AlertTriangle,
  ArrowRight,
  Building2,
  Mail,
  Clock,
  Loader2,
} from 'lucide-react';

const ROLE_LABEL_MAP: Record<string, string> = {
  clinic_owner: 'Practice Owner',
  doctor: 'Dentist',
  receptionist: 'Receptionist',
  admin: 'Administrator',
};

export const ReviewInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    const rawToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';

    if (!rawToken) {
      setError('Invalid or missing invitation token. Please check your invitation link.');
      setLoading(false);
      return;
    }

    sessionStorage.setItem('pending_invite_token', rawToken);
    sessionStorage.setItem('pending_invite_redirect', `/invite/review?token=${rawToken}`);

    api
      .validateInvitationToken(rawToken)
      .then((data) => {
        setInvitationData(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Invitation token is invalid, expired, or has already been used.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams]);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const activeToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
      await api.acceptInvitation({ token: activeToken });
      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');
      setActionSuccess('accepted');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Are you sure you want to decline this role invitation? Your current role will remain unchanged.')) {
      return;
    }
    setSubmitting(true);
    try {
      const activeToken = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
      await api.declineInvitation(activeToken);
      sessionStorage.removeItem('pending_invite_token');
      sessionStorage.removeItem('pending_invite_redirect');
      setActionSuccess('declined');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to decline invitation.');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Loader2 size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Validating invitation credentials…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invitationData) {
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
              <AlertTriangle size={32} style={{ color: 'var(--error, #ef4444)' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Invitation Error
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {error || 'Invitation details could not be retrieved.'}
            </p>
            <Button onClick={() => navigate('/login')} variant="primary" style={{ width: '100%' }}>
              Return to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (actionSuccess === 'accepted') {
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
              <CheckCircle2 size={36} style={{ color: 'var(--success, #22c55e)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Role Accepted!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '16px' }}>
              Your role for <strong>{invitationData.tenantName}</strong> has been updated to{' '}
              <strong>{ROLE_LABEL_MAP[invitationData.roleName] || invitationData.roleName}</strong>.
            </p>
            <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
              Redirecting to Dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

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
              background: 'rgba(100, 116, 139, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <XCircle size={36} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Invitation Declined
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '16px' }}>
              You have declined the invitation to switch roles in <strong>{invitationData.tenantName}</strong>. Your role remains unchanged as <strong>{currentRoleLabel}</strong>.
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Redirecting to Dashboard…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not logged in, prompt to log in with existing account credentials
  if (!isAuthenticated) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Building2 size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{invitationData.tenantName}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Team Membership &amp; Role Assignment</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '16px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.5 }}>
              <strong>{invitationData.inviterName || 'Practice Admin'}</strong> invited <strong>{invitationData.email}</strong> to join as{' '}
              <Badge variant="primary">{ROLE_LABEL_MAP[invitationData.roleName] || invitationData.roleName}</Badge>.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Please sign in with your existing Dental AI account to review and accept this role assignment.
            </p>
          </div>

          <Button
            onClick={() => {
              const token = searchParams.get('token') || sessionStorage.getItem('pending_invite_token') || '';
              navigate(`/login?redirect=/invite/review?token=${token}`);
            }}
            variant="primary"
            style={{ width: '100%', padding: '12px' }}
          >
            Sign In with Existing Account →
          </Button>
        </div>
      </div>
    );
  }

  const currentRoleDisplay = invitationData.currentRoleName
    ? ROLE_LABEL_MAP[invitationData.currentRoleName] || invitationData.currentRoleName
    : 'None';
  const targetRoleDisplay = ROLE_LABEL_MAP[invitationData.roleName] || invitationData.roleName;

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

        {/* Overview Banner */}
        <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', padding: '14px 16px', marginBottom: '24px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
            <strong>{invitationData.inviterName || 'Practice Admin'}</strong> has invited you to join <strong>{invitationData.tenantName}</strong>.
          </p>
        </div>

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
            onClick={handleDecline}
            disabled={submitting}
            variant="secondary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            Decline
          </Button>

          <Button
            onClick={handleAccept}
            disabled={submitting}
            variant="primary"
            style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
          >
            {submitting ? 'Processing…' : 'Accept Role & Join Practice'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewInvitation;
