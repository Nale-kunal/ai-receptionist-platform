import React, { useEffect, useState } from 'react';
import { Phone, Plus, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const PhoneNumbers: React.FC = () => {
  const [phoneInfo, setPhoneInfo] = useState<{ number?: string; clinicName?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPhoneInfo = async () => {
    setLoading(true);
    try {
      const settings = await api.getClinicSettings();
      setPhoneInfo({
        number: settings.contactPhone || undefined,
        clinicName: settings.clinicName || undefined,
      });
    } catch {
      setPhoneInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhoneInfo();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Telephony &amp; Phone Numbers
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage inbound phone numbers, Twilio/SIP trunking integration, and AI call routing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchPhoneInfo} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Buy / Provision Number
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Phone size={18} /> Configured Telephony Trunks
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px' }}>Phone Number</th>
              <th style={{ padding: '12px 16px' }}>Assigned Clinic</th>
              <th style={{ padding: '12px 16px' }}>Provider</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>AI Receptionist</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading telephony configuration…</td>
              </tr>
            ) : !phoneInfo?.number ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No phone numbers or telephony trunks configured.</td>
              </tr>
            ) : (
              <tr style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{phoneInfo.number}</td>
                <td style={{ padding: '12px 16px' }}>{phoneInfo.clinicName || 'Primary Practice'}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Twilio SIP Trunk</td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>ACTIVE</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600 }}>Auto-Answer Active</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
