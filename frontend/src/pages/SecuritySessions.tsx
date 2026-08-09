import React from 'react';
import { Shield, Key, Laptop, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../auth/hooks';

export const SecuritySessions: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Security
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Manage your active sessions and sign out of devices.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Security Overview */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} />
            Security Profile
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Signed in as:</span>
              <span style={{ fontWeight: 600 }}>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role:</span>
              <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                {user?.role === 'admin' || user?.role === 'clinic_owner' ? 'Practice Owner' : user?.role === 'doctor' ? 'Dentist' : user?.role === 'receptionist' ? 'Receptionist' : 'Staff'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Session:</span>
              <span style={{ fontWeight: 600 }}>Secure session active</span>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Laptop size={18} />
            Active Session
          </h3>
          <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Current Web Browser</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session active</span>
              </div>
              <span className="badge" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>THIS DEVICE</span>
            </div>
          </div>
          <button onClick={logout} className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <LogOut size={16} />
            Sign Out of All Devices
          </button>
        </div>
      </div>
    </div>
  );
};
