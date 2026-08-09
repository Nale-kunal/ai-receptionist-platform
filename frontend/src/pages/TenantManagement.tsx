import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { axiosClient } from '../services/axiosClient';

export const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/tenants');
      const data = res.data?.data?.tenants || res.data?.data || res.data || [];
      setTenants(Array.isArray(data) ? data : []);
    } catch {
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Tenant &amp; Multi-Clinic Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage platform tenants, clinic provisioning, domain mapping, and isolation policies.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchTenants} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Provision New Tenant
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={18} /> Provisioned Tenants
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Tenant Name</th>
              <th style={{ padding: '12px 16px' }}>Slug</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Plan</th>
              <th style={{ padding: '12px 16px' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading tenant records…</td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No additional tenant records provisioned.</td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{t.slug}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>{(t.status || 'ACTIVE').toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{t.subscriptionPlan || 'Free'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
