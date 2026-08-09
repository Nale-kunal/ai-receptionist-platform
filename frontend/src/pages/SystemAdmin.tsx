import React from 'react';
import { Activity, Database, ShieldCheck } from 'lucide-react';

export const SystemAdmin: React.FC = () => {
  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Platform Infrastructure & Governance
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Global platform operational health, multi-tenant isolation status, and security compliance.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>API Gateway & Core Services</span>
            <Activity size={20} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: 'var(--text-primary)' }}>Operational (99.99%)</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multi-Region High Availability Cluster</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Encrypted Clinical Database</span>
            <Database size={20} color="var(--primary)" />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: 'var(--text-primary)' }}>Connected</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>AES-256 Storage Encryption Active</span>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Access Control & Security</span>
            <ShieldCheck size={20} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '8px', color: 'var(--text-primary)' }}>Enforcing</p>
          <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Role-Based Access Control Active</span>
        </div>
      </div>
    </div>
  );
};
