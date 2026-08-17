import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useAuth } from '../auth/hooks';
import { axiosClient } from '../services/axiosClient';
import {
  MessageSquare,
  Plus,
  Power,
  PowerOff,
  Settings,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Phone,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WhatsAppIntegration {
  id: string;
  publicId?: string;
  tenantId: string;
  clinicId: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  status: 'active' | 'inactive' | 'suspended';
  isEnabled: boolean;
  settings: {
    greeting: string;
    bookingEnabled: boolean;
    rescheduleEnabled: boolean;
    cancelEnabled: boolean;
    allowedAppointmentTypes: string[];
    bookingHorizonDays: number;
    minNoticePeriodHours: number;
    handoffEnabled: boolean;
    handoffKeywords: string[];
    emergencyPhone?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CreateIntegrationForm {
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  webhookVerifyToken: string;
  greeting: string;
  bookingEnabled: boolean;
  rescheduleEnabled: boolean;
  cancelEnabled: boolean;
  emergencyPhone: string;
  bookingHorizonDays: number;
  minNoticePeriodHours: number;
}

const DEFAULT_CREATE_FORM: CreateIntegrationForm = {
  phoneNumber: '',
  phoneNumberId: '',
  wabaId: '',
  displayName: '',
  webhookVerifyToken: '',
  greeting: "Hello! I'm your dental clinic assistant. How can I help you today?",
  bookingEnabled: true,
  rescheduleEnabled: true,
  cancelEnabled: true,
  emergencyPhone: '',
  bookingHorizonDays: 30,
  minNoticePeriodHours: 2,
};

// ---------------------------------------------------------------------------
// API helpers — call backend admin API
// ---------------------------------------------------------------------------

async function listIntegrations(tenantId: string, clinicId: string): Promise<WhatsAppIntegration[]> {
  const res = await axiosClient.get(`/whatsapp/clinics/${clinicId}/integrations`);
  return (res.data as any).integrations ?? [];
}

async function createIntegration(clinicId: string, payload: any): Promise<WhatsAppIntegration> {
  const res = await axiosClient.post(`/whatsapp/clinics/${clinicId}/integrations`, payload);
  return (res.data as any).integration;
}

async function activateIntegration(id: string): Promise<WhatsAppIntegration> {
  const res = await axiosClient.post(`/whatsapp/integrations/${id}/activate`);
  return (res.data as any).integration;
}

async function deactivateIntegration(id: string): Promise<WhatsAppIntegration> {
  const res = await axiosClient.post(`/whatsapp/integrations/${id}/deactivate`);
  return (res.data as any).integration;
}

async function deleteIntegration(id: string): Promise<void> {
  await axiosClient.delete(`/whatsapp/integrations/${id}`);
}

async function updateIntegration(clinicId: string, id: string, payload: any): Promise<WhatsAppIntegration> {
  const res = await axiosClient.patch(`/whatsapp/clinics/${clinicId}/integrations/${id}`, payload);
  return (res.data as any).integration;
}

// ---------------------------------------------------------------------------
// WhatsApp Integration Panel
// ---------------------------------------------------------------------------

const WhatsAppPanel: React.FC<{ clinicId: string; tenantId: string }> = ({ clinicId, tenantId }) => {
  const [integrations, setIntegrations] = useState<WhatsAppIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState<WhatsAppIntegration | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateIntegrationForm>(DEFAULT_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listIntegrations(tenantId, clinicId);
      setIntegrations(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to load WhatsApp integrations.');
    } finally {
      setLoading(false);
    }
  }, [clinicId, tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    try {
      await createIntegration(clinicId, {
        phoneNumber: createForm.phoneNumber.trim(),
        phoneNumberId: createForm.phoneNumberId.trim(),
        wabaId: createForm.wabaId.trim(),
        displayName: createForm.displayName.trim(),
        webhookVerifyToken: createForm.webhookVerifyToken.trim(),
        settings: {
          greeting: createForm.greeting,
          bookingEnabled: createForm.bookingEnabled,
          rescheduleEnabled: createForm.rescheduleEnabled,
          cancelEnabled: createForm.cancelEnabled,
          emergencyPhone: createForm.emergencyPhone.trim() || undefined,
          bookingHorizonDays: createForm.bookingHorizonDays,
          minNoticePeriodHours: createForm.minNoticePeriodHours,
        },
      });
      setShowCreateModal(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      await load();
    } catch (err: any) {
      setCreateError(
        err?.response?.data?.error?.message
          ?? err?.response?.data?.details?.[0]?.message
          ?? 'Failed to create integration. Please check the details and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (integration: WhatsAppIntegration) => {
    setActionLoading(integration.id);
    try {
      if (integration.isEnabled) {
        await deactivateIntegration(integration.id);
      } else {
        await activateIntegration(integration.id);
      }
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to update integration status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteIntegration(id);
      setShowDeleteConfirm(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to delete integration.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSettings = async (integration: WhatsAppIntegration, updatedSettings: any) => {
    setSaving(true);
    try {
      await updateIntegration(clinicId, integration.id, { settings: updatedSettings });
      setShowSettingsModal(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (integration: WhatsAppIntegration) => {
    if (integration.isEnabled && integration.status === 'active') {
      return <Badge variant="success">Active</Badge>;
    }
    if (integration.status === 'suspended') {
      return <Badge variant="danger">Suspended</Badge>;
    }
    return <Badge variant="warning">Inactive</Badge>;
  };

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={20} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              WhatsApp Business
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Meta Cloud API — AI appointment booking via WhatsApp
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          <Plus size={14} /> Add Number
        </Button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', backgroundColor: 'var(--error-light)', color: 'var(--error)',
          borderRadius: 'var(--radius)', fontSize: '0.85rem', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
          <div>Loading integrations…</div>
        </div>
      ) : integrations.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px', border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius)', color: 'var(--text-secondary)',
        }}>
          <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '6px' }}>No WhatsApp numbers registered</p>
          <p style={{ fontSize: '0.8rem', marginBottom: '16px' }}>
            Connect a WhatsApp Business number to enable AI appointment booking via WhatsApp.
          </p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Register First Number
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {integrations.map((integration) => (
            <div
              key={integration.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '16px',
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Status indicator */}
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                backgroundColor: integration.isEnabled && integration.status === 'active'
                  ? '#25D366' : integration.status === 'suspended' ? 'var(--error)' : 'var(--text-muted)',
                boxShadow: integration.isEnabled && integration.status === 'active'
                  ? '0 0 0 3px rgba(37, 211, 102, 0.2)' : 'none',
              }} />

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {integration.displayName}
                  </span>
                  {statusBadge(integration)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px' }}>
                  <Phone size={12} />
                  <span style={{ fontFamily: 'monospace' }}>{integration.phoneNumber}</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span style={{ opacity: 0.7 }}>WABA: {integration.wabaId.slice(0, 10)}…</span>
                </div>
                {/* Feature toggles */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Booking', enabled: integration.settings.bookingEnabled },
                    { label: 'Reschedule', enabled: integration.settings.rescheduleEnabled },
                    { label: 'Cancel', enabled: integration.settings.cancelEnabled },
                  ].map(({ label, enabled }) => (
                    <span
                      key={label}
                      style={{
                        padding: '2px 8px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 600,
                        backgroundColor: enabled ? 'rgba(37, 211, 102, 0.12)' : 'var(--bg-tertiary)',
                        color: enabled ? '#128C7E' : 'var(--text-muted)',
                        border: `1px solid ${enabled ? 'rgba(37, 211, 102, 0.3)' : 'transparent'}`,
                      }}
                    >
                      {enabled ? '✓' : '✗'} {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button
                  variant="secondary"
                  onClick={() => setShowSettingsModal(integration)}
                  style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Configure settings"
                >
                  <Settings size={13} /> Settings
                </Button>
                <Button
                  variant={integration.isEnabled ? 'secondary' : 'primary'}
                  onClick={() => handleToggle(integration)}
                  disabled={actionLoading === integration.id}
                  style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title={integration.isEnabled ? 'Deactivate' : 'Activate'}
                >
                  {actionLoading === integration.id ? (
                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : integration.isEnabled ? (
                    <><PowerOff size={13} /> Deactivate</>
                  ) : (
                    <><Power size={13} /> Activate</>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(integration.id)}
                  disabled={actionLoading === integration.id}
                  style={{
                    padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px',
                    color: 'var(--error)', borderColor: 'var(--error)',
                  }}
                  title="Delete integration"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhook info box */}
      {integrations.length > 0 && (
        <div style={{
          marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius)',
          backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
          fontSize: '0.78rem', color: 'var(--text-secondary)',
        }}>
          <code style={{
            display: 'block', marginTop: '4px', wordBreak: 'break-all',
            backgroundColor: 'var(--bg-primary)', padding: '6px 10px', borderRadius: '6px',
            fontSize: '0.75rem', color: 'var(--text-primary)',
          }}>
            {(() => {
              const apiUrl = import.meta.env.VITE_API_URL;
              if (apiUrl) {
                const base = apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
                return `${base}/api/v1/webhooks/whatsapp`;
              }
              return 'http://localhost:3000/api/v1/webhooks/whatsapp';
            })()}
          </code>
          <p style={{ marginTop: '6px', marginBottom: 0 }}>
            Register this URL in your Meta App dashboard under WhatsApp → Configuration.
            Use the <code>webhookVerifyToken</code> you set when creating the integration.
          </p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setCreateForm(DEFAULT_CREATE_FORM); setCreateError(null); }}
          title="Register WhatsApp Business Number"
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {createError && (
              <div style={{
                padding: '10px 14px', backgroundColor: 'var(--error-light)', color: 'var(--error)',
                borderRadius: 'var(--radius)', fontSize: '0.83rem', display: 'flex', gap: '8px', alignItems: 'flex-start',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} /> {createError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Phone Number (E.164) *
                </label>
                <Input
                  id="wa-phone"
                  placeholder="+14155550100"
                  value={createForm.phoneNumber}
                  onChange={(e) => setCreateForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  required
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Format: +[country][number]
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Phone Number ID *
                </label>
                <Input
                  id="wa-phone-id"
                  placeholder="From Meta Business Manager"
                  value={createForm.phoneNumberId}
                  onChange={(e) => setCreateForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  WABA ID *
                </label>
                <Input
                  id="wa-waba-id"
                  placeholder="WhatsApp Business Account ID"
                  value={createForm.wabaId}
                  onChange={(e) => setCreateForm(f => ({ ...f, wabaId: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Display Name *
                </label>
                <Input
                  id="wa-display-name"
                  placeholder="City Dental Clinic WA"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Webhook Verify Token *
              </label>
              <Input
                id="wa-verify-token"
                placeholder="Secure random string (min 8 chars)"
                value={createForm.webhookVerifyToken}
                onChange={(e) => setCreateForm(f => ({ ...f, webhookVerifyToken: e.target.value }))}
                required
                minLength={8}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Enter the same value in your Meta App Webhook configuration.
              </p>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              AI Settings
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Greeting Message
              </label>
              <textarea
                id="wa-greeting"
                value={createForm.greeting}
                onChange={(e) => setCreateForm(f => ({ ...f, greeting: e.target.value }))}
                rows={2}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { key: 'bookingEnabled' as const, label: 'Enable Booking' },
                { key: 'rescheduleEnabled' as const, label: 'Enable Reschedule' },
                { key: 'cancelEnabled' as const, label: 'Enable Cancel' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.83rem' }}>
                  <input
                    type="checkbox"
                    id={`wa-${key}`}
                    checked={createForm[key]}
                    onChange={(e) => setCreateForm(f => ({ ...f, [key]: e.target.checked }))}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Emergency Phone
                </label>
                <Input
                  id="wa-emergency"
                  placeholder="+18005550911"
                  value={createForm.emergencyPhone}
                  onChange={(e) => setCreateForm(f => ({ ...f, emergencyPhone: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Booking Horizon (days)
                </label>
                <Input
                  id="wa-horizon"
                  type="number"
                  min={1}
                  max={180}
                  value={createForm.bookingHorizonDays}
                  onChange={(e) => setCreateForm(f => ({ ...f, bookingHorizonDays: parseInt(e.target.value) || 30 }))}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Min Notice (hours)
                </label>
                <Input
                  id="wa-notice"
                  type="number"
                  min={0}
                  max={168}
                  value={createForm.minNoticePeriodHours}
                  onChange={(e) => setCreateForm(f => ({ ...f, minNoticePeriodHours: parseInt(e.target.value) || 2 }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <Button
                variant="secondary"
                type="button"
                onClick={() => { setShowCreateModal(false); setCreateForm(DEFAULT_CREATE_FORM); setCreateError(null); }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Integration'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          integration={showSettingsModal}
          onSave={handleUpdateSettings}
          onClose={() => setShowSettingsModal(null)}
          saving={saving}
        />
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <Modal
          isOpen={!!showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(null)}
          title="Delete WhatsApp Integration"
        >
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <AlertCircle size={40} style={{ color: 'var(--error)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
              Are you sure you want to delete this WhatsApp integration?
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              This will disable incoming WhatsApp messages for this phone number. Existing conversation history will be preserved.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={actionLoading === showDeleteConfirm}
                style={{ backgroundColor: 'var(--error)', borderColor: 'var(--error)' }}
              >
                {actionLoading === showDeleteConfirm ? 'Deleting…' : 'Delete Integration'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Settings Modal
// ---------------------------------------------------------------------------

const SettingsModal: React.FC<{
  integration: WhatsAppIntegration;
  onSave: (integration: WhatsAppIntegration, settings: any) => void;
  onClose: () => void;
  saving: boolean;
}> = ({ integration, onSave, onClose, saving }) => {
  const [form, setForm] = useState({ ...integration.settings });

  return (
    <Modal isOpen onClose={onClose} title={`Settings — ${integration.displayName}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
            Greeting Message
          </label>
          <textarea
            id="wa-settings-greeting"
            value={form.greeting}
            onChange={(e) => setForm(f => ({ ...f, greeting: e.target.value }))}
            rows={3}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: '0.85rem', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          {[
            { key: 'bookingEnabled' as const, label: 'Booking' },
            { key: 'rescheduleEnabled' as const, label: 'Reschedule' },
            { key: 'cancelEnabled' as const, label: 'Cancellation' },
          ].map(({ key, label }) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.83rem',
              padding: '10px', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)',
              backgroundColor: form[key] ? 'rgba(37, 211, 102, 0.08)' : 'var(--bg-tertiary)',
            }}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm(f => ({ ...f, [key]: e.target.checked }))}
                style={{ width: '16px', height: '16px', accentColor: '#25D366' }}
              />
              <span style={{ fontWeight: 600 }}>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Emergency Phone
            </label>
            <Input
              id="wa-settings-emergency"
              placeholder="+18005550911"
              value={form.emergencyPhone ?? ''}
              onChange={(e) => setForm(f => ({ ...f, emergencyPhone: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
              Booking Horizon (days)
            </label>
            <Input
              id="wa-settings-horizon"
              type="number"
              min={1}
              max={180}
              value={form.bookingHorizonDays}
              onChange={(e) => setForm(f => ({ ...f, bookingHorizonDays: parseInt(e.target.value) || 30 }))}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
            Minimum Notice Period (hours)
          </label>
          <Input
            id="wa-settings-notice"
            type="number"
            min={0}
            max={168}
            value={form.minNoticePeriodHours}
            onChange={(e) => setForm(f => ({ ...f, minNoticePeriodHours: parseInt(e.target.value) || 2 }))}
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            Patients cannot book appointments with less than this many hours notice.
          </p>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
            Human Handoff Keywords
          </label>
          <Input
            id="wa-settings-handoff"
            placeholder="human, agent, speak to someone"
            value={form.handoffKeywords?.join(', ') ?? ''}
            onChange={(e) => setForm(f => ({ ...f, handoffKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) }))}
          />
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            Comma-separated. When a patient sends any of these, they are escalated to human staff.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave(integration, form)}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <CheckCircle size={14} /> {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Main Integrations Page
// ---------------------------------------------------------------------------

export const Integrations: React.FC = () => {
  const { clinic, tenant } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Integrations
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Manage communication channels and third-party integrations.
        </p>
      </div>

      {/* WhatsApp Section */}
      <Card>
        {clinic && tenant ? (
          <WhatsAppPanel clinicId={clinic.id} tenantId={tenant.id} />
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No clinic context available. Please ensure you are logged in with a clinic selected.
          </div>
        )}
      </Card>

      {/* OpenAI Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #10a37f 0%, #0d7a5f 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 900, color: 'white',
            }}>AI</div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                OpenAI Developer API
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Powers the AI receptionist and WhatsApp AI booking engine (GPT-4o-mini).
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <Badge variant="success">Connected</Badge>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              sk-proj-••••••••••••
            </span>
          </div>
        </div>
      </Card>

      {/* Twilio Card */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #f22f46 0%, #c11f34 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 900, color: 'white', letterSpacing: '0.05em',
            }}>TWL</div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Twilio Telephony Provider
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Handles inbound voice calls and media streams for the voice AI receptionist.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <Badge variant="success">Connected</Badge>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              AC••••••••••••••••
            </span>
          </div>
        </div>
      </Card>

      {/* Google Calendar — future */}
      <Card style={{ opacity: 0.7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4285F4 0%, #34A853 50%, #FBBC05 75%, #EA4335 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 900, color: 'white',
            }}>GCal</div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Google Calendar
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Doctor calendar sync — two-way appointment synchronisation (coming soon).
              </p>
            </div>
          </div>
          <Badge variant="warning">Coming Soon</Badge>
        </div>
      </Card>
    </div>
  );
};
