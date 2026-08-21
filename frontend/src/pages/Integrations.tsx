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
  // Note: phoneNumberId, wabaId, webhookVerifyToken are intentionally
  // excluded from this type — they are managed by the Platform Admin only.
  phoneNumber: string;
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

// Clinic-facing form — only collects business-level info.
// Technical Meta credentials (phoneNumberId, wabaId, webhookVerifyToken)
// are set exclusively by the Platform Admin via the admin console.
interface CreateIntegrationForm {
  phoneNumber: string;
  displayName: string;
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
  displayName: '',
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
      // Only send clinic-configurable fields.
      // phoneNumberId, wabaId, webhookVerifyToken are provisioned by the Platform Admin.
      await createIntegration(clinicId, {
        phoneNumber: createForm.phoneNumber.trim(),
        displayName: createForm.displayName.trim(),
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
          ?? 'Failed to register. Please check the phone number and try again.'
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
                  {(integration as any).wabaId && (
                    <>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ opacity: 0.7 }}>WABA: {(integration as any).wabaId.slice(0, 10)}…</span>
                    </>
                  )}
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

      {/* Status info — shown when connected numbers exist */}
      {integrations.length > 0 && (
        <div style={{
          marginTop: '16px', padding: '12px 16px', borderRadius: 'var(--radius)',
          backgroundColor: 'rgba(37, 211, 102, 0.06)', border: '1px solid rgba(37, 211, 102, 0.2)',
          fontSize: '0.8rem', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle size={14} style={{ color: '#25D366', flexShrink: 0 }} />
          <span>
            Your WhatsApp channel is managed by the platform. Contact support if you experience any issues.
          </span>
        </div>
      )}

      {/* Create Modal — Clinic-facing: no Meta credentials */}
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

            {/* Info banner — explain the setup process */}
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)',
              backgroundColor: 'rgba(37, 211, 102, 0.06)', border: '1px solid rgba(37, 211, 102, 0.2)',
              fontSize: '0.8rem', color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong> Register your WhatsApp phone number
              and AI settings below. Our team will complete the technical connection to Meta within 24 hours.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  WhatsApp Phone Number (E.164) *
                </label>
                <Input
                  id="wa-phone"
                  placeholder="+14155550100"
                  value={createForm.phoneNumber}
                  onChange={(e) => setCreateForm(f => ({ ...f, phoneNumber: e.target.value }))}
                  required
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Include country code, e.g. +1 (US), +44 (UK), +91 (India).
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                  Display Name *
                </label>
                <Input
                  id="wa-display-name"
                  placeholder="City Dental Clinic"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
                  required
                />
              </div>
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

  const effectiveClinicId = clinic?.id || tenant?.id || '';
  const effectiveTenantId = tenant?.id || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Communication Channels
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Configure WhatsApp, notification email preferences, and AI Receptionist channels for your clinic.
        </p>
      </div>

      {/* WhatsApp Business Channel Section */}
      <Card>
        {effectiveClinicId && effectiveTenantId ? (
          <WhatsAppPanel clinicId={effectiveClinicId} tenantId={effectiveTenantId} />
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <RefreshCw className="spin" size={20} style={{ margin: '0 auto 8px' }} />
            Loading communication channels…
          </div>
        )}
      </Card>

      {/* Voice & AI Receptionist Channel */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', color: 'white',
            }}>
              <Phone size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Voice & AI Receptionist
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Answers incoming clinic calls 24/7, handles appointment booking, FAQs, and emergency call routing.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Badge variant="success">Active</Badge>
            <Button
              variant="secondary"
              onClick={() => window.location.href = '/ai-receptionist/assistant'}
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              Configure AI Behavior
            </Button>
          </div>
        </div>
      </Card>

      {/* Clinic Email Notifications */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
            }}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Notification Email Channel
              </h3>
              <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>
                Receives appointment confirmations, daily schedule digests, and staff alert emails.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Badge variant="success">Configured</Badge>
            <Button
              variant="secondary"
              onClick={() => window.location.href = '/settings/practice'}
              style={{ fontSize: '0.8rem', padding: '8px 14px' }}
            >
              Update Email Settings
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
