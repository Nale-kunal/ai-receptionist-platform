import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { api } from '../services/api';
import { useAuth } from '../auth/hooks';

export const ClinicSettings: React.FC = () => {
  const { updateClinicContext } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  ];

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getClinicSettings();
        setSettings(res);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Failed to load clinic settings from server.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const updated = await api.updateClinicSettings(settings);
      if (updated?.clinicName) {
        setSettings(updated);
        updateClinicContext?.({ name: updated.clinicName });
      }
      setSuccessMsg('Clinic settings updated successfully.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (day: string) => {
    const activeDays = [...settings.workingDays];
    const index = activeDays.indexOf(day);
    if (index > -1) {
      activeDays.splice(index, 1);
    } else {
      activeDays.push(day);
    }
    setSettings({ ...settings, workingDays: activeDays });
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading clinic configurations...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Clinic Settings</h1>
        <p>Configure business hours, address, and AI receptionist booking rules.</p>
      </div>

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--success-light)',
            color: 'var(--success)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            border: '1px solid var(--success)',
            maxWidth: '800px',
          }}
          role="alert"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--error-light)',
            color: 'var(--error)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            border: '1px solid var(--error)',
            maxWidth: '800px',
          }}
          role="alert"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-6" style={{ maxWidth: '800px' }}>
        {/* Section 1: Business Identity & Contact */}
        <Card>
          <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Clinic Identity & Contact
          </h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Clinic Name"
              value={settings.clinicName}
              onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Contact Phone"
                value={settings.contactPhone}
                onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                required
              />
              <Input
                label="Contact Email"
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                required
              />
            </div>
            <Input
              label="Business Address"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              required
            />
          </div>
        </Card>

        {/* Section 2: Hours & Availability */}
        <Card>
          <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Hours & Availability Rules
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="input"
                >
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="number"
                label="Default Appointment Slot (minutes)"
                value={settings.appointmentDuration}
                onChange={(e) => setSettings({ ...settings, appointmentDuration: Number(e.target.value) })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Daily Business Hours (Text)"
                value={settings.businessHours}
                onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                placeholder="e.g. 09:00 - 17:00"
                required
              />
              <Input
                label="Holiday Schedule (Text)"
                value={settings.holidaySchedule}
                onChange={(e) => setSettings({ ...settings, holidaySchedule: e.target.value })}
                placeholder="e.g. Closed on Thanksgiving"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Working Days</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
                {daysOfWeek.map((day) => {
                  const isChecked = settings.workingDays.includes(day);
                  return (
                    <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleDayToggle(day)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: AI Voice Receptionist Settings */}
        <Card>
          <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            AI Receptionist Greeting & Booking Rules
          </h3>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Voice Actor</label>
              <select
                value={settings.voiceSelection}
                onChange={(e) => setSettings({ ...settings, voiceSelection: e.target.value })}
                className="input"
              >
                <option value="alloy">Alloy (Neutral)</option>
                <option value="echo">Echo (Warm)</option>
                <option value="shimmer">Shimmer (Professional)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>AI Greeting Template</label>
              <textarea
                value={settings.aiGreeting}
                onChange={(e) => setSettings({ ...settings, aiGreeting: e.target.value })}
                className="input"
                rows={3}
                required
              />
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Scheduling & Booking Rules</label>
              <textarea
                value={settings.bookingRules}
                onChange={(e) => setSettings({ ...settings, bookingRules: e.target.value })}
                className="input"
                rows={3}
                required
              />
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Cancellation & Rescheduling Rules</label>
              <textarea
                value={settings.cancellationRules}
                onChange={(e) => setSettings({ ...settings, cancellationRules: e.target.value })}
                className="input"
                rows={3}
                required
              />
            </div>
          </div>
        </Card>

        <Button type="submit" disabled={saving} style={{ padding: '12px', fontSize: '1rem', fontWeight: 600 }}>
          {saving ? 'Saving changes...' : 'Save Clinic Settings'}
        </Button>
      </form>
    </div>
  );
};
