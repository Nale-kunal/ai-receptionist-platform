import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Settings,
  Phone,
  Bot,
  AlertTriangle,
  RefreshCw,
  Check,
  Shield,
} from 'lucide-react';

interface WhatsAppIntegration {
  id: string;
  publicId: string;
  phoneNumber: string;
  displayName: string;
  status: 'active' | 'inactive' | 'suspended';
  isEnabled: boolean;
  settings: {
    greeting?: string;
    personality?: string;
    bookingEnabled?: boolean;
    rescheduleEnabled?: boolean;
    cancelEnabled?: boolean;
    allowedAppointmentTypes?: string[];
    bookingHorizonDays?: number;
    minNoticePeriodHours?: number;
    handoffEnabled?: boolean;
    handoffKeywords?: string[];
    emergencyPhone?: string;
  };
  createdAt: string;
}

export const WhatsAppChannel: React.FC = () => {
  const [integrations, setIntegrations] = useState<WhatsAppIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');

  useEffect(() => {
    loadIntegrations();
  }, []);

  async function loadIntegrations() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/whatsapp/clinics/me/integrations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      } else {
        setIntegrations([]);
      }
    } catch {
      setError('Unable to load WhatsApp integrations.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateIntegration(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/whatsapp/clinics/me/integrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          phoneNumber: newPhone,
          displayName: newDisplayName,
        }),
      });
      if (res.ok) {
        setSuccess('WhatsApp Business number registered successfully! Platform admin will complete Meta setup.');
        setIsCreating(false);
        setNewPhone('');
        setNewDisplayName('');
        loadIntegrations();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Failed to connect WhatsApp number.');
      }
    } catch {
      setError('Failed to connect WhatsApp number.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(integration: WhatsAppIntegration) {
    setError(null);
    const endpoint = integration.isEnabled ? 'deactivate' : 'activate';
    try {
      const res = await fetch(`/api/v1/whatsapp/integrations/${integration.id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      if (res.ok) {
        setSuccess(`WhatsApp channel ${integration.isEnabled ? 'disabled' : 'activated'}!`);
        loadIntegrations();
      }
    } catch {
      setError('Failed to update integration status.');
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '1000px' }}>
      {/* Header card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.05) 0%, rgba(18, 140, 126, 0.08) 100%)',
          border: '1px solid rgba(37, 211, 102, 0.2)',
          borderRadius: 'var(--radius-lg, 12px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
            }}
          >
            <MessageSquare size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              WhatsApp AI Appointment Booking
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Connect your WhatsApp Business number so patients can book, reschedule, and check appointments 24/7.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsCreating(true)}
          style={{ backgroundColor: '#128C7E', borderColor: '#128C7E', padding: '10px 18px', fontWeight: 600 }}
        >
          + Register Phone Number
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Connected Numbers List */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Connected Business Numbers
        </h3>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={20} style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading WhatsApp integrations...</p>
          </div>
        ) : integrations.length === 0 ? (
          <div
            className="card"
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              border: '1px dashed var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
            }}
          >
            <Bot size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 6px' }}>No WhatsApp numbers registered</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 16px' }}>
              Register your clinic's WhatsApp phone number to activate automated AI booking for your patients.
            </p>
            <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
              Register Number
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {integrations.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: item.isEnabled ? '#25D366' : 'var(--border-color)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Phone size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.displayName}</span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: item.isEnabled ? 'rgba(37, 211, 102, 0.15)' : 'var(--bg-tertiary)',
                          color: item.isEnabled ? '#128C7E' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        {item.isEnabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                      Phone: <strong>{item.phoneNumber}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    className={`btn ${item.isEnabled ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleToggleStatus(item)}
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    {item.isEnabled ? 'Disable Channel' : 'Enable Channel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Number Modal */}
      {isCreating && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '28px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg, 12px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Register WhatsApp Business Phone Number
            </h3>

            <form onSubmit={handleCreateIntegration} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Display Name (Clinic Name)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SmileCare Dental Clinic"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Phone Number (E.164 format)
                </label>
                <input
                  type="text"
                  required
                  placeholder="+14155552671"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Must include country code, e.g. +1 for US/Canada, +44 for UK, +91 for India.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreating(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ backgroundColor: '#128C7E', borderColor: '#128C7E' }}
                >
                  {saving ? 'Registering...' : 'Register Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

