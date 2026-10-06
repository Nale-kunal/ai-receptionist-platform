/**
 * Admin Clinic Detail Page
 *
 * Full deep-dive into a single clinic:
 *   - Overview & suspend/activate/force logout controls
 *   - Tabbed view: Users (with per-user session logout), Doctors, Patients, Appointments, WhatsApp Integrations, Conversations
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
  LogOut,
  CheckCircle2,
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clinic Force Logout Modal State
  const [showClinicLogoutModal, setShowClinicLogoutModal] = useState(false);
  const [clinicLogoutReason, setClinicLogoutReason] = useState('');
  const [clinicLoggingOut, setClinicLoggingOut] = useState(false);
  const [clinicLogoutError, setClinicLogoutError] = useState<string | null>(null);

  // User Force Logout Modal State
  const [logoutUserTarget, setLogoutUserTarget] = useState<any | null>(null);
  const [userLogoutReason, setUserLogoutReason] = useState('');
  const [userLoggingOut, setUserLoggingOut] = useState(false);
  const [userLogoutError, setUserLogoutError] = useState<string | null>(null);

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

  // Tab switch
  useEffect(() => {
    fetchTabData(activeTab, false);
  }, [activeTab, clinicId]);

  // Multi-tier auto revalidation
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

  const handleClinicForceLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;
    setClinicLoggingOut(true);
    setClinicLogoutError(null);

    try {
      const res = await adminApiClient.post(`/clinics/${clinicId}/force-logout`, {
        reason: clinicLogoutReason.trim() || 'Super Admin initiated clinic force-logout',
      });
      const data = res.data?.data;
      setSuccessMessage(
        data?.message || `Successfully terminated active session(s) for ${clinic.name}.`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      setShowClinicLogoutModal(false);
      setClinicLogoutReason('');
      adminFrontendCache.invalidate();
      await fetchClinicDetail(true);
      await fetchTabData(activeTab, true);
    } catch (err: any) {
      setClinicLogoutError(
        err?.response?.data?.error?.message ||
        'Failed to log out clinic sessions. Please check server logs.'
      );
    } finally {
      setClinicLoggingOut(false);
    }
  };

  const handleUserForceLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoutUserTarget) return;
    setUserLoggingOut(true);
    setUserLogoutError(null);

    try {
      const res = await adminApiClient.post(`/clinics/${clinicId}/users/${logoutUserTarget.id}/force-logout`, {
        reason: userLogoutReason.trim() || 'Super Admin initiated user force-logout',
      });
      const data = res.data?.data;
      setSuccessMessage(
        data?.message || `Successfully terminated active session(s) for ${logoutUserTarget.email}.`
      );
      setTimeout(() => setSuccessMessage(null), 6000);
      setLogoutUserTarget(null);
      setUserLogoutReason('');
      adminFrontendCache.invalidate();
      await fetchTabData('users', true);
    } catch (err: any) {
      setUserLogoutError(
        err?.response?.data?.error?.message ||
        'Failed to log out user sessions. Please check server logs.'
      );
    } finally {
      setUserLoggingOut(false);
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

        {/* Success Notification Banner */}
        {successMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34D399',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
            <button
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#34D399', cursor: 'pointer', fontSize: '0.8rem' }}
              onClick={() => setSuccessMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

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
                <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
                  {getStatusLabel(clinic.status)}
                </span>
              </div>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Tenant: <strong>{clinic.tenant?.name}</strong> • Registered {new Date(clinic.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Action buttons: Suspend/Activate & Force Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowClinicLogoutModal(true);
                setClinicLogoutReason('');
                setClinicLogoutError(null);
              }}
              title="Force logout all active users and invalidate tokens for this clinic"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--warning)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
              }}
            >
              <LogOut size={14} />
              <span>Force Logout Clinic</span>
            </button>

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
          </div>
        </div>
      </div>

      {/* Action Error Banner */}
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
        </div>
      )}

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
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Revocation Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tabData.map((u: any) => {
                    const isRevoked = u.status === 'archived' || u.deletedAt !== null || !!u.revokedAt;
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td><span className="badge badge-active">{u.role}</span></td>
                        <td>
                          <span className={`badge ${!isRevoked && u.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                            {isRevoked ? 'revoked' : u.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {isRevoked && u.revocationReason ? (
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {u.revocationReason}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {u.revokedByName ? `By ${u.revokedByName}` : ''}
                                {u.revokedAt ? ` on ${new Date(u.revokedAt).toLocaleDateString()}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setLogoutUserTarget(u);
                              setUserLogoutReason('');
                              setUserLogoutError(null);
                            }}
                            title={`Force logout all active sessions for ${u.email}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: 'var(--warning)',
                              borderColor: 'rgba(245, 158, 11, 0.3)',
                              backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            }}
                          >
                            <LogOut size={12} />
                            <span>Logout</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* Force Logout Clinic Modal */}
      {showClinicLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !clinicLoggingOut) setShowClinicLogoutModal(false);
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LogOut size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Force Logout Entire Clinic
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Terminate all active sessions for {clinic.name}
                </p>
              </div>
            </div>

            {clinicLogoutError && (
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
                <AlertTriangle size={16} /> {clinicLogoutError}
              </div>
            )}

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#FBBF24',
                fontSize: '0.83rem',
                lineHeight: 1.4,
                marginBottom: '16px',
              }}
            >
              <strong>Warning:</strong> This will revoke all active sessions and invalidate JWT access tokens for all doctors, administrators, and staff in <strong>{clinic.name}</strong>.
            </div>

            <form onSubmit={handleClinicForceLogout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Reason for Force Logout (Optional)
                </label>
                <input
                  type="text"
                  value={clinicLogoutReason}
                  onChange={(e) => setClinicLogoutReason(e.target.value)}
                  placeholder="e.g. Credential refresh, security audit..."
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowClinicLogoutModal(false)}
                  disabled={clinicLoggingOut}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={clinicLoggingOut}
                  style={{
                    backgroundColor: '#D97706',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  {clinicLoggingOut ? 'Terminating Sessions…' : 'Confirm Force Logout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Force Logout Single User Modal */}
      {logoutUserTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !userLoggingOut) setLogoutUserTarget(null);
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: 'var(--warning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LogOut size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Force Logout User
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Terminate all active sessions for {logoutUserTarget.firstName} {logoutUserTarget.lastName} ({logoutUserTarget.email})
                </p>
              </div>
            </div>

            {userLogoutError && (
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
                <AlertTriangle size={16} /> {userLogoutError}
              </div>
            )}

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#FBBF24',
                fontSize: '0.83rem',
                lineHeight: 1.4,
                marginBottom: '16px',
              }}
            >
              This will revoke all active sessions and increment the token version for <strong>{logoutUserTarget.email}</strong>, logging them out of all active devices immediately.
            </div>

            <form onSubmit={handleUserForceLogout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Reason for Logout (Optional)
                </label>
                <input
                  type="text"
                  value={userLogoutReason}
                  onChange={(e) => setUserLogoutReason(e.target.value)}
                  placeholder="e.g. Session termination request..."
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLogoutUserTarget(null)}
                  disabled={userLoggingOut}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={userLoggingOut}
                  style={{
                    backgroundColor: '#D97706',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  {userLoggingOut ? 'Logging Out…' : 'Confirm Logout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
