import React from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../auth/hooks';
import { Shield, User, Mail, Building, Key } from 'lucide-react';

export const UserProfile: React.FC = () => {
  const { user, tenant, clinic } = useAuth();

  if (!user) return <p style={{ color: 'var(--text-secondary)' }}>Loading user session context...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">User Profile</h1>
        <p>Manage your account credentials, security role permissions, and clinic assignments.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', maxWidth: '900px' }}>
        {/* Left Side: Avatar Card */}
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              fontWeight: 700,
              marginBottom: '16px',
            }}
          >
            {user.firstName[0]}
            {user.lastName[0]}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {user.firstName} {user.lastName}
          </h2>
          <span
            style={{
              marginTop: '6px',
              padding: '2px 10px',
              borderRadius: '9999px',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {user.role.replace('_', ' ')}
          </span>
        </Card>

        {/* Right Side: Details Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <Card>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Account Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Full Name</label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {user.firstName} {user.lastName}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email Address</label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.email}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clinic Assignment</label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {clinic?.name || 'Default Clinic Group'} ({clinic?.slug || 'default'})
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organization Tenant</label>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                    {tenant?.name || 'Default Tenant Organization'} ({tenant?.slug || 'default'})
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Security & Sessions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Shield size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Authorization Policies</label>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Standard RBAC constraints actively enforce security contexts. To modify roles or permissions, contact your clinic owner.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Key size={18} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Password Manager</label>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    To reset your secure password, sign out and request a recovery token from the Forgot Password flow.
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
