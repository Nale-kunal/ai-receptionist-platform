/**
 * Admin WhatsApp Provisioning & Credential Management
 *
 * Super Admin interface for technical Meta configuration:
 *   - List all WhatsApp integrations across all clinics
 *   - Provision new integration with Meta Phone Number ID, WABA ID, and Webhook Verify Token
 *   - Edit technical credentials
 *   - Activate / Deactivate channels
 */

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Plus,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  Phone,
  Key,
  Building2,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';

interface WhatsAppIntegrationItem {
  id: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  webhookVerifyToken: string;
  status: string;
  isEnabled: boolean;
  clinic: { id: string; name: string };
  createdAt: string;
}

import { adminFrontendCache } from '../services/adminCacheService';

const WA_CACHE_KEY = '/whatsapp';

export const WhatsAppList: React.FC = () => {
  const cached = adminFrontendCache.get<{ integrations: WhatsAppIntegrationItem[] }>(WA_CACHE_KEY);
  const [integrations, setIntegrations] = useState<WhatsAppIntegrationItem[]>(cached?.integrations ?? []);
  const [loading, setLoading] = useState(!cached);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [editItem, setEditItem] = useState<WhatsAppIntegrationItem | null>(null);

  // Form state
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [formClinicId, setFormClinicId] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPhoneId, setFormPhoneId] = useState('');
  const [formWabaId, setFormWabaId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formVerifyToken, setFormVerifyToken] = useState('');
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
    setFormVerifyToken(''); // Admin must supply their own webhook verify token — never auto-generated
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
    setFormVerifyToken(item.webhookVerifyToken);
    setError(null);
    setShowProvisionModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editItem) {
        // Update credentials
        await adminApiClient.patch(`/whatsapp/${editItem.id}`, {
          phoneNumberId: formPhoneId,
          wabaId: formWabaId,
          displayName: formDisplayName,
          webhookVerifyToken: formVerifyToken,
        });
      } else {
        // Provision new integration
        await adminApiClient.post('/whatsapp/provision', {
          clinicId: formClinicId,
          phoneNumber: formPhone,
          phoneNumberId: formPhoneId,
          wabaId: formWabaId,
          displayName: formDisplayName,
          webhookVerifyToken: formVerifyToken,
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

  const handleToggleActivate = async (item: WhatsAppIntegrationItem) => {
    const endpoint = item.isEnabled ? 'deactivate' : 'activate';
    try {
      await adminApiClient.post(`/whatsapp/${item.id}/${endpoint}`);
      adminFrontendCache.invalidate();
      await fetchIntegrations(true);
    } catch (err) {
      console.error(`Failed to ${endpoint} WhatsApp integration:`, err);
    }
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
            Platform Admin ONLY — configure Meta credentials (Phone Number ID, WABA ID, Webhook Tokens).
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
                <th>Webhook Token</th>
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
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {item.webhookVerifyToken?.slice(0, 10)}…
                  </td>
                  <td>
                    <span className={`badge ${item.isEnabled ? 'badge-active' : 'badge-inactive'}`}>
                      {item.isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className={`btn ${item.isEnabled ? 'btn-danger' : 'btn-success'} btn-sm`}
                        onClick={() => handleToggleActivate(item)}
                      >
                        {item.isEnabled ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(item)}
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

      {/* Provision Modal */}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Webhook Verify Token *
                </label>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={formVerifyToken}
                  onChange={(e) => setFormVerifyToken(e.target.value)}
                  className="input"
                  style={{ fontFamily: 'monospace' }}
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
