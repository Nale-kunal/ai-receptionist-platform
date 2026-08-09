import React from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks';
import {
  PERM_USER_READ,
  PERM_CLINIC_SETTINGS_READ,
  PERM_BILLING_READ,
  PERM_REPORT_VIEW,
  PERM_ADMIN_TENANT_MANAGE,
  PERM_ADMIN_PLATFORM,
} from '../../auth/permissions';

// Sub-pages
import { UsersRbac } from '../UsersRbac';
import { ClinicSettings } from '../ClinicSettings';
import { Integrations } from '../Integrations';
import { BillingPage } from '../BillingPage';
import { SecuritySessions } from '../SecuritySessions';
import { AuditLogs } from '../AuditLogs';
import { Analytics } from '../Analytics';
import { PhoneNumbers } from '../PhoneNumbers';
import { Notifications } from '../Notifications';
import { KnowledgeBase } from '../KnowledgeBase';
import { TenantManagement } from '../TenantManagement';
import { SystemAdmin } from '../SystemAdmin';
import { SystemHealth } from '../SystemHealth';

import {
  Building,
  Users,
  Clock,
  CreditCard,
  Link,
  Shield,
  Wrench,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
}

export const SettingsHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission, hasRole } = useAuth();

  const tabs: TabItem[] = [
    { id: 'practice', label: 'Practice', path: '/settings/practice', icon: Building, permission: PERM_CLINIC_SETTINGS_READ },
    { id: 'team', label: 'Team', path: '/settings/team', icon: Users, permission: PERM_USER_READ },
    { id: 'hours', label: 'Business Hours', path: '/settings/hours', icon: Clock, permission: PERM_CLINIC_SETTINGS_READ },
    { id: 'billing', label: 'Billing', path: '/settings/billing', icon: CreditCard, permission: PERM_BILLING_READ },
    { id: 'integrations', label: 'Integrations', path: '/settings/integrations', icon: Link, permission: PERM_CLINIC_SETTINGS_READ },
    { id: 'security', label: 'Security', path: '/settings/security', icon: Shield },
    { id: 'advanced', label: 'Advanced', path: '/settings/advanced', icon: Wrench, permission: PERM_CLINIC_SETTINGS_READ },
  ];

  const visibleTabs = tabs.filter((t) => !t.permission || hasPermission(t.permission));
  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].path : '/settings/practice';

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Manage your practice, team, and integrations.
        </p>
      </div>

      {/* Tab Navigation */}
      {visibleTabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '2px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '0',
          }}
        >
          {visibleTabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Routes */}
      <Routes>
        <Route path="practice" element={<SettingsPractice />} />
        <Route path="team" element={<UsersRbac />} />
        <Route path="hours" element={<SettingsHours />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="security" element={<SecuritySessions />} />
        <Route path="advanced" element={
          <SettingsAdvanced
            isSuperAdmin={hasRole('super_admin')}
            hasReportPermission={hasPermission(PERM_REPORT_VIEW)}
            hasTenantPermission={hasPermission(PERM_ADMIN_TENANT_MANAGE)}
            hasPlatformPermission={hasPermission(PERM_ADMIN_PLATFORM)}
          />
        } />
        {/* Super admin sub-routes within advanced */}
        <Route path="advanced/analytics" element={<Analytics />} />
        <Route path="advanced/activity-log" element={<AuditLogs />} />
        <Route path="advanced/phone-numbers" element={<PhoneNumbers />} />
        <Route path="advanced/notifications" element={<Notifications />} />
        <Route path="advanced/diagnostics" element={<SystemHealth />} />
        <Route path="advanced/tenants" element={<TenantManagement />} />
        <Route path="advanced/platform" element={<SystemAdmin />} />
        <Route path="*" element={<Navigate to={defaultTab.replace('/settings/', '')} replace />} />
      </Routes>
    </div>
  );
};

// --- Inline Sub-Components ---

const SettingsPractice: React.FC = () => {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const { api } = await import('../../services/api');
        const res = await api.getClinicSettings();
        setSettings(res);
      } catch {
        setMessage({ type: 'error', text: 'Failed to load practice information.' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { api } = await import('../../services/api');
      await api.updateClinicSettings(settings);
      setMessage({ type: 'success', text: 'Practice information saved.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;
  if (!settings) return null;

  return (
    <form onSubmit={handleSave} style={{ width: '100%' }}>
      {message && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: message.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
            color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            marginBottom: '16px',
            border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          }}
          role="alert"
        >
          {message.text}
        </div>
      )}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Practice Information</h3>

        <div className="flex flex-col gap-2 w-full">
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Practice Name</label>
          <input className="input" value={settings.clinicName} onChange={(e) => setSettings({ ...settings, clinicName: e.target.value })} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Phone Number</label>
            <input className="input" value={settings.contactPhone} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} required />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email Address</label>
            <input className="input" type="email" value={settings.contactEmail} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} required />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Address</label>
          <input className="input" value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} required />
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '16px', padding: '10px 20px', fontWeight: 600 }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

const SettingsHours: React.FC = () => {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Berlin', label: 'Central Europe (CET)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'America/Toronto', label: 'Toronto (ET)' },
    { value: 'UTC', label: 'UTC' },
  ];

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /** Ensure all 7 days always appear in detailedSchedule — fill in any gaps */
  const ensureFullSchedule = (schedule: any[]): any[] => {
    return daysOfWeek.map((day, idx) => {
      const existing = schedule.find((s: any) => s.day === day);
      if (existing) return existing;
      return {
        day,
        startTime: '09:00',
        endTime: '17:00',
        isClosed: idx === 0 || idx === 6,
      };
    });
  };

  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { api } = await import('../../services/api');
      const res = await api.getClinicSettings();

      // Ensure detailedSchedule has all 7 days
      const safeSchedule = ensureFullSchedule(
        Array.isArray(res?.detailedSchedule) && res.detailedSchedule.length > 0
          ? res.detailedSchedule
          : []
      );

      const derivedWorkingDays = safeSchedule
        .filter((s: any) => !s.isClosed)
        .map((s: any) => s.day);

      setSettings({
        ...res,
        timezone: res?.timezone || 'America/New_York',
        appointmentDuration: res?.appointmentDuration ?? 30,
        businessHours: res?.businessHours || '09:00 - 17:00',
        workingDays: res?.workingDays?.length > 0 ? res.workingDays : derivedWorkingDays,
        holidaySchedule: res?.holidaySchedule || 'Closed on national holidays',
        detailedSchedule: safeSchedule,
      });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load business hours. Please try refreshing.';
      setMessage({ type: 'error', text: errMsg });

      // Provide safe default schedule so UI is still usable
      const defaultSchedule = ensureFullSchedule([]);
      setSettings({
        timezone: 'America/New_York',
        appointmentDuration: 30,
        businessHours: '09:00 - 17:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        holidaySchedule: 'Closed on national holidays',
        detailedSchedule: defaultSchedule,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { api } = await import('../../services/api');
      // Sync workingDays from detailedSchedule before save (source of truth)
      const syncedWorkingDays = (settings?.detailedSchedule || [])
        .filter((s: any) => !s.isClosed)
        .map((s: any) => s.day);

      await api.updateClinicSettings({
        ...settings,
        workingDays: syncedWorkingDays,
        detailedSchedule: settings?.detailedSchedule || [],
      });
      setSettings((prev: any) => ({ ...prev, workingDays: syncedWorkingDays }));
      setMessage({ type: 'success', text: 'Business hours saved and will now reflect in appointment scheduling.' });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save. Please try again.';
      setMessage({ type: 'error', text: `Save failed: ${errMsg}` });
    } finally {
      setSaving(false);
    }
  };

  /** Toggle a day open/closed — keeps all 7 days in schedule */
  const handleDayToggle = (day: string) => {
    const currentSchedule: any[] = Array.isArray(settings?.detailedSchedule) ? settings.detailedSchedule : [];
    const fullSchedule = ensureFullSchedule(currentSchedule);

    const updatedSchedule = fullSchedule.map((s: any) => {
      if (s.day === day) return { ...s, isClosed: !s.isClosed };
      return s;
    });

    const updatedWorkingDays = updatedSchedule.filter((s: any) => !s.isClosed).map((s: any) => s.day);
    setSettings({ ...settings, workingDays: updatedWorkingDays, detailedSchedule: updatedSchedule });
  };

  const handleScheduleTimeChange = (day: string, field: 'startTime' | 'endTime', value: string) => {
    const currentSchedule: any[] = Array.isArray(settings?.detailedSchedule) ? settings.detailedSchedule : [];
    const fullSchedule = ensureFullSchedule(currentSchedule);
    const updatedSchedule = fullSchedule.map((s: any) => {
      if (s.day === day) return { ...s, [field]: value };
      return s;
    });
    setSettings({ ...settings, detailedSchedule: updatedSchedule });
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading practice business hours...</p>;

  const scheduleList: any[] = Array.isArray(settings?.detailedSchedule) ? settings.detailedSchedule : [];

  return (
    <form onSubmit={handleSave} style={{ width: '100%' }}>
      {message && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: message.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
            color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
            borderRadius: 'var(--radius)',
            fontSize: '0.85rem',
            marginBottom: '16px',
            border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          }}
          role="alert"
        >
          {message.text}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Clinic Operating Hours &amp; Schedule</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Practice Timezone</label>
            <select className="input" value={settings?.timezone || 'America/New_York'} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
              {timezones.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Default Slot Duration (mins)</label>
            <input className="input" type="number" min={5} max={240} value={settings?.appointmentDuration ?? 30} onChange={(e) => setSettings({ ...settings, appointmentDuration: Number(e.target.value) })} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Hours Display Label</label>
            <input className="input" value={settings?.businessHours || ''} onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })} placeholder="e.g. Mon-Fri 09:00-17:00" />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Holiday &amp; Closure Policy</label>
            <input className="input" value={settings?.holidaySchedule || ''} onChange={(e) => setSettings({ ...settings, holidaySchedule: e.target.value })} placeholder="e.g. Closed on national holidays" />
          </div>
        </div>

        {/* Weekly schedule header & quick actions */}
        <div className="flex flex-col gap-3" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Day-by-Day Clinic Schedule
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                (Check = Open · Uncheck = Closed · Changes reflect in appointment booking)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const currentSchedule: any[] = Array.isArray(settings?.detailedSchedule) ? settings.detailedSchedule : [];
                  const fullSchedule = ensureFullSchedule(currentSchedule);
                  const updatedSchedule = fullSchedule.map((s: any) => ({ ...s, isClosed: false, startTime: '00:00', endTime: '23:59' }));
                  const updatedWorkingDays = updatedSchedule.map((s: any) => s.day);
                  setSettings({ ...settings, workingDays: updatedWorkingDays, detailedSchedule: updatedSchedule });
                }}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  border: '1px solid var(--primary)',
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-light)',
                  transition: 'all 0.15s',
                }}
              >
                Set 24 / 7
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentSchedule: any[] = Array.isArray(settings?.detailedSchedule) ? settings.detailedSchedule : [];
                  const fullSchedule = ensureFullSchedule(currentSchedule);
                  const updatedSchedule = fullSchedule.map((s: any) => ({
                    ...s,
                    startTime: '09:00',
                    endTime: '17:00',
                    isClosed: s.day === 'Sunday' || s.day === 'Saturday',
                  }));
                  const updatedWorkingDays = updatedSchedule.filter((s: any) => !s.isClosed).map((s: any) => s.day);
                  setSettings({ ...settings, workingDays: updatedWorkingDays, detailedSchedule: updatedSchedule });
                }}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Reset 9 AM – 5 PM
              </button>
            </div>
          </div>

          {daysOfWeek.map((day) => {
            const dayItem = scheduleList.find((s: any) => s.day === day) || {
              day,
              startTime: '09:00',
              endTime: '17:00',
              isClosed: day === 'Sunday' || day === 'Saturday',
            };
            const isClosed = Boolean(dayItem.isClosed);
            const is24h = !isClosed && dayItem.startTime === '00:00' && (dayItem.endTime === '23:59' || dayItem.endTime === '23:30');

            return (
              <div
                key={day}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: isClosed ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  border: `1px solid ${isClosed ? 'var(--border-color)' : 'var(--primary)'}`,
                  opacity: isClosed ? 0.65 : 1,
                  transition: 'all 0.15s ease',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', minWidth: '120px' }}>
                  <input
                    type="checkbox"
                    checked={!isClosed}
                    onChange={() => handleDayToggle(day)}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{day}</span>
                </label>

                {isClosed ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Closed / Off Day</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="time"
                      className="input"
                      style={{ padding: '5px 8px', fontSize: '0.85rem', width: '120px' }}
                      value={dayItem.startTime || '09:00'}
                      onChange={(e) => handleScheduleTimeChange(day, 'startTime', e.target.value)}
                    />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="time"
                      className="input"
                      style={{ padding: '5px 8px', fontSize: '0.85rem', width: '120px' }}
                      value={dayItem.endTime || '17:00'}
                      onChange={(e) => handleScheduleTimeChange(day, 'endTime', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleScheduleTimeChange(day, 'startTime', '00:00');
                        handleScheduleTimeChange(day, 'endTime', '23:59');
                      }}
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        border: `1px solid ${is24h ? 'var(--primary)' : 'var(--border-color)'}`,
                        color: is24h ? 'var(--primary)' : 'var(--text-muted)',
                        backgroundColor: is24h ? 'var(--primary-light)' : 'transparent',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                      title="Set this day to 24 hours"
                    >
                      24 hrs
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDayToggle(day)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    border: '1px solid',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: isClosed ? 'var(--bg-tertiary)' : 'var(--success-light)',
                    color: isClosed ? 'var(--text-muted)' : 'var(--success)',
                    borderColor: isClosed ? 'var(--border-color)' : 'var(--success)',
                    minWidth: '58px',
                  }}
                >
                  {isClosed ? 'Closed' : 'Open'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '16px', padding: '10px 24px', fontWeight: 600, fontSize: '0.9rem' }}>
        {saving ? 'Saving Changes...' : 'Save Practice Hours'}
      </button>
    </form>
  );
};



interface SettingsAdvancedProps {
  isSuperAdmin: boolean;
  hasReportPermission: boolean;
  hasTenantPermission: boolean;
  hasPlatformPermission: boolean;
}

const SettingsAdvanced: React.FC<SettingsAdvancedProps> = ({ isSuperAdmin, hasReportPermission, hasTenantPermission, hasPlatformPermission }) => {
  const navigate = useNavigate();

  interface AdvancedLink {
    label: string;
    description: string;
    path: string;
    show: boolean;
  }

  const links: AdvancedLink[] = [
    { label: 'Phone Numbers', description: 'Manage phone lines connected to your AI receptionist.', path: '/settings/advanced/phone-numbers', show: true },
    { label: 'Notification Rules', description: 'Configure automated SMS and email appointment reminders.', path: '/settings/advanced/notifications', show: true },
    { label: 'Activity Log', description: 'View a record of all actions taken in your practice.', path: '/settings/advanced/activity-log', show: true },
    { label: 'Practice Reports', description: 'Analytics and reporting for your practice.', path: '/settings/advanced/analytics', show: hasReportPermission },
    { label: 'System Diagnostics', description: 'Platform health and performance monitoring.', path: '/settings/advanced/diagnostics', show: isSuperAdmin },
    { label: 'Organization Management', description: 'Manage multi-clinic organizations.', path: '/settings/advanced/tenants', show: hasTenantPermission },
    { label: 'Platform Administration', description: 'Global platform configuration.', path: '/settings/advanced/platform', show: hasPlatformPermission },
  ];

  const visibleLinks = links.filter((l) => l.show);

  return (
    <div style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Technical configuration and administrative tools. Most practices won't need to change these settings.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '14px 16px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              borderRadius: 'var(--radius)',
              transition: 'box-shadow 0.15s ease',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{link.label}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{link.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
