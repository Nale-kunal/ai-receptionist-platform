/**
 * Admin WhatsApp Provisioning & Credential Management
 *
 * Super Admin interface for technical Meta configuration:
 *   - List all WhatsApp integrations across all clinics
 *   - Provision new integration with Meta Phone Number ID, WABA ID, and Display Name
 *   - Edit technical Meta IDs
 *   - Test Meta Connectivity & Webhook Subscription without sending patient messages
 *   - Verify & Activate / Deactivate channels
 */

import React, { useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building2,
  AlertCircle,
  AlertTriangle,
  Edit2,
  Activity,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';
import { adminFrontendCache } from '../services/adminCacheService';

interface WhatsAppIntegrationItem {
  id: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  status: string;
  isEnabled: boolean;
  wabaSubscribed: boolean;
  clinic: { id: string; name: string };
  createdAt: string;
}

interface DiagnosticResult {
  title: string;
  success: boolean;
  message?: string;
  checks?: {
    credentials?: string;
    waba?: string;
    phoneNumber?: string;
    webhookSubscription?: string;
  };
  details?: any;
}

const WA_CACHE_KEY = '/whatsapp';

export const WhatsAppList: React.FC = () => {
  const cached = adminFrontendCache.get<{ integrations: WhatsAppIntegrationItem[] }>(WA_CACHE_KEY);
  const [integrations, setIntegrations] = useState<WhatsAppIntegrationItem[]>(cached?.integrations ?? []);
  const [loading, setLoading] = useState(!cached);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [editItem, setEditItem] = useState<WhatsAppIntegrationItem | null>(null);

  // Diagnostic / Activation Result Modal
  const [diagModal, setDiagModal] = useState<DiagnosticResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Form state
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [formClinicId, setFormClinicId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPhoneId, setFormPhoneId] = useState('');
  const [formWabaId, setFormWabaId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchIntegrations = async (force = false) => {
    if (!integrations.length || force) {
      if (!integrations.length) setLoading(true);
    }
    setFetchError(null);
    try {
      const res = await adminApiClient.get('/whatsapp');
      const data = res.data?.data;
      if (data?.integrations) {
        setIntegrations(data.integrations);
        adminFrontendCache.set(WA_CACHE_KEY, data);
      }
    } catch (err: any) {
      if (!integrations.length) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to load WhatsApp integrations.';
        setFetchError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClinicsList = async () => {
    try {
      const res = await adminApiClient.get('/clinics');
      if (res.data?.data?.clinics) {
        setClinics(res.data.data.clinics.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch (err) {
      console.error('Failed to load clinics list:', err);
    }
  };

  useEffect(() => {
    fetchIntegrations(true);
    fetchClinicsList();

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        fetchIntegrations(false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchIntegrations(false);
      }
    }, 10_000);

    const unsubscribe = adminFrontendCache.subscribe(() => {
      fetchIntegrations(true);
    });

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  const handleOpenProvision = () => {
    setEditItem(null);
    setFormClinicId(clinics[0]?.id || '');
    setFormPhone('');
    setFormPhoneId('');
    setFormWabaId('');
    setFormDisplayName('');
    setError(null);
    setShowProvisionModal(true);
  };

  const handleOpenEdit = (item: WhatsAppIntegrationItem) => {
    setEditItem(item);
    setFormClinicId(item.clinic.id);
    setFormPhone(item.phoneNumber);
    setFormPhoneId(item.phoneNumberId);
    setFormWabaId(item.wabaId);
    setFormDisplayName(item.displayName);
    setError(null);
    setShowProvisionModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editItem) {
        await adminApiClient.patch(`/whatsapp/${editItem.id}`, {
          phoneNumberId: formPhoneId,
          wabaId: formWabaId,
          displayName: formDisplayName,
        });
      } else {
        await adminApiClient.post('/whatsapp/provision', {
          clinicId: formClinicId,
          phoneNumber: formPhone,
          phoneNumberId: formPhoneId,
          wabaId: formWabaId,
          displayName: formDisplayName,
        });
      }

      setShowProvisionModal(false);
      adminFrontendCache.invalidate();
      await fetchIntegrations(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Provisioning failed. Please check Meta inputs.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (item: WhatsAppIntegrationItem) => {
    setTestingId(item.id);
    try {
      const res = await adminApiClient.post(`/whatsapp/${item.id}/test-connection`);
      const data = res.data?.data;
      setDiagModal({
        title: `Diagnostic Results — ${item.clinic?.name || item.phoneNumber}`,
        success: data?.healthy ?? false,
        message: data?.healthy
          ? 'Meta Cloud API connectivity and WABA configuration are healthy and verified.'
          : data?.error || 'One or more Meta checks failed.',
        checks: data?.checks,
        details: data?.details,
      });
      adminFrontendCache.invalidate();
      await fetchIntegrations(true);
    } catch (err: any) {
      const errData = err?.response?.data;
      setDiagModal({
        title: `Diagnostic Failed — ${item.clinic?.name || item.phoneNumber}`,
        success: false,
        message: errData?.error?.message || err?.message || 'Connection test failed.',
        checks: errData?.error?.checks,
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActivate = async (item: WhatsAppIntegrationItem) => {
    if (item.isEnabled) {
      // Deactivate
      try {
        await adminApiClient.post(`/whatsapp/${item.id}/deactivate`);
        adminFrontendCache.invalidate();
        await fetchIntegrations(true);
      } catch (err: any) {
        console.error('Failed to deactivate WhatsApp integration:', err);
      }
      return;
    }

    // Activate — runs complete Meta verification pipeline
    setActivatingId(item.id);
    try {
      const res = await adminApiClient.post(`/whatsapp/${item.id}/activate`);
      const data = res.data?.data;
      if (data?.success) {
        setDiagModal({
          title: `WhatsApp Activated — ${item.clinic?.name || item.phoneNumber}`,
          success: true,
          message: 'All Meta verification checks passed. WABA webhook subscribed and channel is now ACTIVE.',
          checks: data?.checks,
        });
      }
      adminFrontendCache.invalidate();
      await fetchIntegrations(true);
    } catch (err: any) {
      const errData = err?.response?.data;
      setDiagModal({
        title: `Activation Failed — ${item.clinic?.name || item.phoneNumber}`,
        success: false,
        message:
          errData?.error?.message ||
          err?.message ||
          'Verification failed. WhatsApp channel could not be activated.',
        checks: errData?.error?.checks,
      });
      await fetchIntegrations(true);
    } finally {
      setActivatingId(null);
    }
  };

  const renderCheckBadge = (status?: string) => {
    if (status === 'passed') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '0.8rem', fontWeight: 600 }}>
          <Check size={14} /> Passed
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#EF4444', fontSize: '0.8rem', fontWeight: 600 }}>
          <X size={14} /> Failed
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {status || 'Not run'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            WhatsApp Technical Provisioning
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Platform Admin ONLY — configure Meta credentials (Phone Number ID, WABA ID), verify connectivity, and manage webhook subscriptions.
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenProvision}>
          <Plus size={16} /> Provision WhatsApp Channel
        </button>
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading WhatsApp integrations…</p>
          </div>
        ) : fetchError ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertCircle size={32} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Unable to load integrations</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>{fetchError}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchIntegrations(true)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : integrations.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No WhatsApp integrations provisioned yet. Click "Provision WhatsApp Channel" to set up the first number.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Clinic</th>
                <th>Phone Number</th>
                <th>Meta Phone ID</th>
                <th>WABA ID</th>
                <th>Webhook Subscription</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={14} style={{ color: 'var(--primary)' }} />
                      {item.clinic?.name}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#25D366' }}>{item.phoneNumber}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--primary)' }}>
                    {item.phoneNumberId}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
                    {item.wabaId}
                  </td>
                  <td>
                    {item.wabaSubscribed ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10B981', fontSize: '0.78rem', fontWeight: 600 }}>
                        <ShieldCheck size={13} /> Subscribed
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#F59E0B', fontSize: '0.78rem', fontWeight: 600 }}>
                        <AlertTriangle size={13} /> Not Subscribed
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${item.isEnabled ? 'badge-active' : 'badge-inactive'}`}>
                      {item.isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleTestConnection(item)}
                        disabled={testingId === item.id || activatingId === item.id}
                        title="Run safe Meta Cloud API connectivity and ownership checks"
                      >
                        {testingId === item.id ? (
                          <RefreshCw size={12} className="spin" />
                        ) : (
                          <Activity size={12} />
                        )}
                        Test Connection
                      </button>

                      <button
                        className={`btn ${item.isEnabled ? 'btn-danger' : 'btn-success'} btn-sm`}
                        onClick={() => handleToggleActivate(item)}
                        disabled={testingId === item.id || activatingId === item.id}
                      >
                        {activatingId === item.id ? (
                          <>
                            <RefreshCw size={12} className="spin" /> Verifying…
                          </>
                        ) : item.isEnabled ? (
                          'Deactivate'
                        ) : (
                          'Verify & Activate'
                        )}
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(item)}
                        disabled={testingId === item.id || activatingId === item.id}
                      >
                        <Edit2 size={12} /> Edit Meta IDs
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diagnostic & Activation Modal */}
      {diagModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {diagModal.success ? (
                <CheckCircle size={28} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <XCircle size={28} style={{ color: '#EF4444', flexShrink: 0 }} />
              )}
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {diagModal.title}
              </h2>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: diagModal.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${diagModal.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: diagModal.success ? '#34D399' : '#F87171',
                fontSize: '0.85rem',
                marginBottom: '20px',
                lineHeight: 1.5,
              }}
            >
              {diagModal.message}
            </div>

            {diagModal.checks && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Verification Checks Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>Meta Credentials</span>
                    {renderCheckBadge(diagModal.checks.credentials)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>WABA Account Access</span>
                    {renderCheckBadge(diagModal.checks.waba)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>Phone Number Ownership</span>
                    {renderCheckBadge(diagModal.checks.phoneNumber)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.83rem', color: 'var(--text-primary)' }}>WABA Webhook Subscription</span>
                    {renderCheckBadge(diagModal.checks.webhookSubscription)}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setDiagModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision / Edit Modal */}
      {showProvisionModal && (
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
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '32px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
              {editItem ? `Edit Meta IDs — ${editItem.clinic.name}` : 'Provision WhatsApp Channel'}
            </h2>

            {error && (
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
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editItem && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Select Clinic
                  </label>
                  <select
                    value={formClinicId}
                    onChange={(e) => setFormClinicId(e.target.value)}
                    className="input"
                    required
                  >
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id} style={{ backgroundColor: '#111827' }}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  WhatsApp Phone Number (E.164)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editItem}
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+14155550100"
                  className="input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Meta Phone Number ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formPhoneId}
                    onChange={(e) => setFormPhoneId(e.target.value)}
                    placeholder="100609346382103"
                    className="input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    WABA Account ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={formWabaId}
                    onChange={(e) => setFormWabaId(e.target.value)}
                    placeholder="108492048501923"
                    className="input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="City Dental Clinic WA"
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProvisionModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editItem ? 'Update Meta Credentials' : 'Provision Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
