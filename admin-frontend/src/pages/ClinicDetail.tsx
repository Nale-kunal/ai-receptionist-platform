/**
 * Admin Clinic Detail Page
 *
 * Full deep-dive into a single clinic:
 *   - Overview & suspend/activate controls
 *   - Tabbed view: Users, Doctors, Patients, Appointments, WhatsApp Integrations, Conversations
 *   - Auto-revalidation on window focus, tab visibility change, and active 10s polling
 *   - Strict PostgreSQL single source of truth: UI derives data exclusively from live DB responses
 *
 * IMPORTANT: Uses clinic.status (string) — NOT clinic.isActive (boolean).
 * Doctor names use fullName / displayName — NOT firstName / lastName.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Building2,
  Users,
  Stethoscope,
  Calendar,
  MessageSquare,
  RefreshCw,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';
import { adminFrontendCache } from '../services/adminCacheService';

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

function getAppointmentBadgeClass(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'cancelled':
    case 'no_show':
      return 'badge-danger';
    case 'confirmed':
    case 'completed':
    case 'checked_in':
      return 'badge-active';
    case 'scheduled':
      return 'badge-primary';
    case 'rescheduled':
      return 'badge-inactive';
    case 'pending':
      return 'badge-warning';
    default:
      return 'badge-inactive';
  }
}

function getAppointmentStatusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'cancelled': return 'Cancelled';
    case 'scheduled': return 'Scheduled';
    case 'confirmed': return 'Confirmed';
    case 'completed': return 'Completed';
    case 'checked_in': return 'Checked In';
    case 'in_progress': return 'In Progress';
    case 'rescheduled': return 'Rescheduled';
    case 'no_show': return 'No Show';
    case 'pending': return 'Pending';
    default: return status || 'Unknown';
  }
}

export const ClinicDetail: React.FC<{ clinicId: string; onBack: () => void }> = ({ clinicId, onBack }) => {
  const clinicCacheKey = `/clinics/${clinicId}`;
  const cachedClinic = adminFrontendCache.peek<{ clinic: any }>(clinicCacheKey)?.clinic;

  const [clinic, setClinic] = useState<any>(cachedClinic ?? null);
  const [activeTab, setActiveTab] = useState<'users' | 'doctors' | 'patients' | 'appointments' | 'whatsapp' | 'conversations'>('users');

  const tabCacheKey = `/clinics/${clinicId}/${activeTab}`;
  const cachedTab = adminFrontendCache.peek<any[]>(tabCacheKey);

  const [tabData, setTabData] = useState<any[]>(cachedTab ?? []);
  const [loading, setLoading] = useState(!cachedClinic);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tabLoading, setTabLoading] = useState(!cachedTab);
  const [tabError, setTabError] = useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const fetchClinicDetail = useCallback(async (force = false) => {
    if (!clinic || force) {
      if (!clinic) setLoading(true);
    }
    setLoadError(null);
    try {
      const res = await adminApiClient.get(`/clinics/${clinicId}`);
      const data = res.data?.data;
      if (data?.clinic) {
        setClinic(data.clinic);
        adminFrontendCache.set(clinicCacheKey, data);
      }
    } catch (err: any) {
      if (!clinic) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to load clinic details.';
        setLoadError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [clinicId, clinic, clinicCacheKey]);

  const fetchTabData = useCallback(async (tab: string, force = false) => {
    const currentTabCacheKey = `/clinics/${clinicId}/${tab}`;
    const inCache = adminFrontendCache.get<any[]>(currentTabCacheKey);
    if (inCache && !force) {
      setTabData(inCache);
      setTabLoading(false);
    } else if (!tabData.length || force) {
      setTabLoading(true);
    }
    setIsRevalidating(true);
    setTabError(null);

    try {
      const res = await adminApiClient.get(`/clinics/${clinicId}/${tab}`);
      const dataKey = tab === 'whatsapp' ? 'integrations' : tab;
      const list = res.data?.data?.[dataKey] || [];
      setTabData(list);
      adminFrontendCache.set(currentTabCacheKey, list);
    } catch (err: any) {
      if (!tabData.length) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          `Unable to load ${tab} data.`;
        setTabError(msg);
      }
    } finally {
      setTabLoading(false);
      setIsRevalidating(false);
    }
  }, [clinicId, tabData.length]);

  // Initial load
  useEffect(() => {
    fetchClinicDetail(true);
  }, [clinicId]);

  useEffect(() => {
    fetchTabData(activeTab, true);
  }, [clinicId, activeTab]);

  // Controlled active polling (10s) & window focus / visibility change revalidation
  useEffect(() => {
    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        fetchClinicDetail(false);
        fetchTabData(activeTabRef.current, false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchClinicDetail(false);
        fetchTabData(activeTabRef.current, false);
      }
    }, 10_000);

    const unsubscribe = adminFrontendCache.subscribe(() => {
      fetchClinicDetail(true);
      fetchTabData(activeTabRef.current, true);
    });

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(timer);
      unsubscribe();
    };
  }, [fetchClinicDetail, fetchTabData]);

  const handleToggleStatus = async () => {
    if (!clinic) return;
    setActionLoading(true);
    setActionError(null);
    // Use clinic.status (string) — NOT isActive (boolean)
    const endpoint = clinic.status === 'active' ? 'suspend' : 'activate';
    try {
      await adminApiClient.post(`/clinics/${clinicId}/${endpoint}`);
      adminFrontendCache.invalidate();
      await fetchClinicDetail(true); // Refresh from database
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        `Failed to ${endpoint} clinic.`;
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualRefresh = () => {
    adminFrontendCache.invalidate(`/clinics/${clinicId}`);
    fetchClinicDetail(true);
    fetchTabData(activeTab, true);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin" style={{ marginRight: '12px' }} /> Loading clinic file…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={40} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Unable to load clinic
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
          {loadError}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back to Clinics</button>
          <button className="btn btn-primary btn-sm" onClick={() => fetchClinicDetail(true)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={40} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
        <p>Clinic not found.</p>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '12px' }}>
          ← Back to Clinics
        </button>
      </div>
    );
  }

  const subTabs = [
    { id: 'users', label: 'Users & Staff', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'whatsapp', label: 'WhatsApp Setup', icon: MessageSquare },
    { id: 'conversations', label: 'AI Conversations', icon: MessageCircle },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Button & Header */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={14} /> Back to Clinics List
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleManualRefresh}
            title="Fetch authoritative data from PostgreSQL"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isRevalidating ? 'spin' : ''} />
            <span>{isRevalidating ? 'Syncing DB…' : 'Sync Latest Data'}</span>
          </button>
        </div>

        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {clinic.name}
                </h1>
                {/* Use clinic.status (string) — NOT clinic.isActive */}
                <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
                  {getStatusLabel(clinic.status)}
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Tenant: <strong>{clinic.tenant?.name}</strong> • Registered {new Date(clinic.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Suspend / Activate button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <button
              className={`btn ${clinic.status === 'active' ? 'btn-danger' : 'btn-success'} btn-sm`}
              onClick={handleToggleStatus}
              disabled={actionLoading}
            >
              {actionLoading
                ? 'Processing…'
                : clinic.status === 'active'
                  ? 'Suspend Clinic'
                  : 'Activate Clinic'}
            </button>
            {actionError && (
              <span style={{ fontSize: '0.75rem', color: '#F87171' }}>{actionError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Resource Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {subTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className="btn btn-secondary btn-sm"
            style={{
              backgroundColor: activeTab === id ? 'var(--primary)' : 'transparent',
              color: activeTab === id ? 'white' : 'var(--text-secondary)',
              borderColor: activeTab === id ? 'var(--primary)' : 'transparent',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tab Data Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {tabLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="spin" style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading {activeTab}…</p>
          </div>
        ) : tabError ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <AlertTriangle size={28} style={{ color: 'var(--danger)', margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Unable to load {activeTab}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: '14px' }}>
              {tabError}
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchTabData(activeTab, true)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : tabData.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No {activeTab} records found for this clinic.
          </div>
        ) : (
          <table className="admin-table">
            {activeTab === 'users' && (
              <>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tabData.map((u: any) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td><span className="badge badge-active">{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'doctors' && (
              <>
                <thead>
                  <tr><th>Doctor Name</th><th>Specialization</th><th>License</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tabData.map((d: any) => (
                    <tr key={d.id}>
                      {/* Doctor model uses fullName / displayName — NOT firstName / lastName */}
                      <td style={{ fontWeight: 600 }}>{d.displayName || d.fullName}</td>
                      <td>{d.specialization || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{d.licenseNumber || 'N/A'}</td>
                      <td>
                        <span className={`badge ${d.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'patients' && (
              <>
                <thead>
                  <tr><th>Patient Name</th><th>Phone</th><th>Email</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {tabData.map((p: any) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.fullName || `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || '—'}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.phone || 'N/A'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.email || 'N/A'}</td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'appointments' && (
              <>
                <thead>
                  <tr><th>Patient</th><th>Doctor</th><th>Start Time</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {tabData.map((a: any) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>
                        {a.patient
                          ? (a.patient.fullName || `${a.patient.firstName ?? ''} ${a.patient.lastName ?? ''}`.trim() || 'Patient')
                          : 'Guest'}
                      </td>
                      <td>
                        {/* Doctor model uses fullName / displayName — NOT firstName / lastName */}
                        {a.doctor
                          ? `Dr. ${a.doctor.displayName || a.doctor.fullName}`
                          : 'Unassigned'}
                      </td>
                      <td>{new Date(a.startTime).toLocaleString()}</td>
                      <td>
                        <span className={`badge ${getAppointmentBadgeClass(a.status)}`}>
                          {getAppointmentStatusLabel(a.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'whatsapp' && (
              <>
                <thead>
                  <tr><th>Phone Number</th><th>Meta Phone ID</th><th>WABA ID</th><th>Status</th><th>Enabled</th></tr>
                </thead>
                <tbody>
                  {tabData.map((w: any) => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 700, color: '#25D366' }}>{w.phoneNumber}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{w.phoneNumberId}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent-purple)' }}>{w.wabaId}</td>
                      <td><span className={`badge ${w.status === 'connected' ? 'badge-active' : 'badge-inactive'}`}>{w.status}</span></td>
                      <td><span className={`badge ${w.isEnabled ? 'badge-active' : 'badge-inactive'}`}>{w.isEnabled ? 'Yes' : 'No'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {activeTab === 'conversations' && (
              <>
                <thead>
                  <tr><th>Channel</th><th>Caller / Contact</th><th>Status</th><th>Last Activity</th></tr>
                </thead>
                <tbody>
                  {tabData.map((c: any) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{c.channel || c.channelType}</td>
                      <td style={{ fontFamily: 'monospace' }}>{c.callerPhone || c.channelIdentifier || '—'}</td>
                      <td><span className="badge badge-active">{c.status}</span></td>
                      <td>{new Date(c.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        )}
      </div>
    </div>
  );
};
