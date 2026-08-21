/**
 * Admin Clinics & Tenants Management Page (0ms Instant-Render with SWR)
 *
 * Full cross-tenant clinic table: view details, suspend, activate, search.
 * Uses real PostgreSQL database records exclusively.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Search,
  ChevronRight,
  RefreshCw,
  Users,
  Stethoscope,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';
import { adminFrontendCache } from '../services/adminCacheService';

interface ClinicItem {
  id: string;
  name: string;
  status: string; // 'active' | 'suspended' | 'pending_setup'
  createdAt: string;
  tenant: { id: string; name: string };
  _count: { doctors: number; patients: number; appointments: number };
}

function getStatusBadgeClass(status: string): string {
  if (status === 'active') return 'badge-active';
  if (status === 'suspended') return 'badge-danger';
  return 'badge-inactive';
}

function getStatusLabel(status: string): string {
  if (status === 'active') return 'Active';
  if (status === 'suspended') return 'Suspended';
  if (status === 'pending_setup') return 'Pending Setup';
  return status;
}

export const ClinicsList: React.FC<{ onSelectClinic: (id: string) => void }> = ({ onSelectClinic }) => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const cacheKey = `/clinics?page=${page}&search=${search}`;
  const cached = adminFrontendCache.get<{ clinics: ClinicItem[]; pagination: { totalPages: number } }>(cacheKey);

  const [clinics, setClinics] = useState<ClinicItem[]>(cached?.clinics ?? []);
  const [totalPages, setTotalPages] = useState(cached?.pagination?.totalPages ?? 1);
  const [loading, setLoading] = useState(!cached);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchClinics = useCallback(async (force = false) => {
    if (!clinics.length || force) {
      if (!clinics.length) setLoading(true);
    }
    setIsSyncing(true);
    setError(null);

    try {
      const res = await adminApiClient.get('/clinics', {
        params: { page, search },
      });
      const data = res.data?.data;
      if (data?.clinics) {
        setClinics(data.clinics);
        setTotalPages(data.pagination?.totalPages || 1);
        adminFrontendCache.set(cacheKey, data);
      }
    } catch (err: any) {
      if (!clinics.length) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to load clinics. Please retry.';
        setError(msg);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [page, search, clinics.length, cacheKey]);

  useEffect(() => {
    fetchClinics(true);

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        fetchClinics(false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchClinics(false);
      }
    }, 10_000);

    const unsubscribe = adminFrontendCache.subscribe(() => {
      fetchClinics(true);
    });

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(timer);
      unsubscribe();
    };
  }, [page, search, fetchClinics]);

  const handleToggleStatus = async (clinic: ClinicItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(clinic.id);
    setActionError(null);

    const nextStatus = clinic.status === 'active' ? 'suspended' : 'active';
    const endpoint = clinic.status === 'active' ? 'suspend' : 'activate';

    // Optimistic UI update (0ms instant response)
    setClinics((prev) =>
      prev.map((c) => (c.id === clinic.id ? { ...c, status: nextStatus } : c))
    );

    try {
      await adminApiClient.post(`/clinics/${clinic.id}/${endpoint}`);
      adminFrontendCache.invalidate(); // Invalidate frontend SWR cache
      await fetchClinics(true); // Re-sync from DB
    } catch (err: any) {
      // Rollback on error
      setClinics((prev) =>
        prev.map((c) => (c.id === clinic.id ? { ...c, status: clinic.status } : c))
      );
      const msg =
        err?.response?.data?.error?.message ||
        `Failed to ${endpoint} clinic.`;
      setActionError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // Provision Modal State
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await adminApiClient.post('/tenants', {
        name: formName,
        ownerEmail: formEmail,
        ownerFirstName: formFirstName,
        ownerLastName: formLastName,
        ownerPassword: formPassword,
      });
      setShowModal(false);
      setFormName('');
      setFormEmail('');
      setFormFirstName('');
      setFormLastName('');
      setFormPassword('');
      adminFrontendCache.invalidate();
      await fetchClinics(true);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || 'Failed to create tenant. Email may already be in use.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Clinics & Tenant Accounts
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Cross-tenant governance: inspect activity, manage active state, and provision new dental clinics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isSyncing && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              Live Sync
            </span>
          )}
          <button className="btn btn-primary" onClick={() => { setFormError(null); setShowModal(true); }}>
            + Provision New Clinic
          </button>
        </div>
      </div>

      {/* Action Error */}
      {actionError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#F87171',
            fontSize: '0.83rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} /> {actionError}
          <button
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: '0.8rem' }}
            onClick={() => setActionError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search clinic name…"
          className="input"
          style={{ paddingLeft: '38px' }}
        />
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && clinics.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading clinics…</p>
          </div>
        ) : error && clinics.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Unable to load clinics
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              {error}
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchClinics(true)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : clinics.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No clinics found matching your query.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Clinic Name</th>
                <th>Tenant</th>
                <th>Doctors</th>
                <th>Patients</th>
                <th>Appointments</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((clinic) => (
                <tr
                  key={clinic.id}
                  onClick={() => onSelectClinic(clinic.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Building2 size={16} />
                      </div>
                      {clinic.name}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{clinic.tenant.name}</td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Stethoscope size={14} style={{ color: 'var(--accent-purple)' }} /> {clinic._count.doctors}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={14} style={{ color: 'var(--accent-cyan)' }} /> {clinic._count.patients}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={14} style={{ color: 'var(--warning)' }} /> {clinic._count.appointments}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
                      {getStatusLabel(clinic.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className={`btn ${clinic.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm`}
                        onClick={(e) => handleToggleStatus(clinic, e)}
                        disabled={actionLoading === clinic.id}
                        title={clinic.status === 'active' ? 'Suspend this clinic' : 'Activate this clinic'}
                      >
                        {actionLoading === clinic.id
                          ? '…'
                          : clinic.status === 'active'
                            ? 'Suspend'
                            : 'Activate'}
                      </button>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {/* Provision Tenant Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
              Provision New Clinic & Owner Account
            </h2>

            {formError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171',
                  fontSize: '0.83rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                <AlertTriangle size={16} /> {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Clinic & Tenant Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Apex Dental Care"
                  className="input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Owner Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="dr.smith@apexdental.com"
                  className="input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="John"
                    className="input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Smith"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Initial Owner Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Provisioning…' : 'Provision Clinic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
