/**
 * Super Admin Dashboard Page (0ms Instant-Render with SWR)
 *
 * Displays platform-wide metrics across all tenants & clinics.
 * Uses real live PostgreSQL data exclusively — ZERO fake data.
 *
 * Performance:
 *   - Instant 0ms render from memory cache
 *   - Silent background revalidation with non-blocking sync indicator
 *   - Dedicated error boundary with retry controls
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Users,
  Calendar,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Clock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';
import { adminFrontendCache } from '../services/adminCacheService';

interface DashboardStats {
  tenants: { total: number };
  clinics: { total: number; active: number; suspended: number; pendingSetup: number };
  users: { total: number };
  doctors: { active: number };
  patients: { total: number };
  appointments: { total: number };
  whatsapp: { total: number; active: number };
  adminSessions: { active: number };
}

interface AuditLogItem {
  id: string;
  action: string;
  outcome: string;
  occurredAt: string;
  admin?: { email: string; displayName: string };
}

const CACHE_KEY = '/dashboard';

export const Dashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  // 0ms Instant Hydration from SWR cache
  const cached = adminFrontendCache.get<{ stats: DashboardStats; recentAuditLogs: AuditLogItem[] }>(CACHE_KEY);

  const [stats, setStats] = useState<DashboardStats | null>(cached?.stats ?? null);
  const [recentLogs, setRecentLogs] = useState<AuditLogItem[]>(cached?.recentAuditLogs ?? []);
  const [loading, setLoading] = useState(!cached);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (force = false) => {
    if (!stats || force) {
      if (!stats) setLoading(true);
    }
    setIsSyncing(true);
    setError(null);

    try {
      const res = await adminApiClient.get('/dashboard');
      const data = res.data?.data;
      if (data?.stats) {
        setStats(data.stats);
        setRecentLogs(data.recentAuditLogs ?? []);
        adminFrontendCache.set(CACHE_KEY, data);
      }
    } catch (err: any) {
      if (!stats) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to load platform analytics.';
        setError(msg);
      }
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [stats]);

  useEffect(() => {
    loadDashboard(true);

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        loadDashboard(false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDashboard(false);
      }
    }, 10_000);

    const unsubscribe = adminFrontendCache.subscribe(() => {
      loadDashboard(true);
    });

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin" style={{ marginRight: '12px' }} /> Loading platform analytics…
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Platform Overview
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
              Real-time aggregate telemetry across all multi-tenant dental clinics.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => loadDashboard(true)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>

        {/* Error Card */}
        <div
          className="glass-card"
          style={{
            padding: '40px',
            textAlign: 'center',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertTriangle size={40} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Unable to load platform analytics
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            {error}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => loadDashboard(true)}>
            <RefreshCw size={14} /> Retry Now
          </button>
        </div>
      </div>
    );
  }

  const s = stats!;

  const statCards = [
    { label: 'Total Tenants', value: s.tenants.total, icon: Building2, color: '#3B82F6', onClick: () => onNavigate('clinics') },
    { label: 'Active Clinics', value: s.clinics.active, icon: Building2, color: '#10B981', onClick: () => onNavigate('clinics') },
    { label: 'Suspended Clinics', value: s.clinics.suspended, icon: Building2, color: '#EF4444', onClick: () => onNavigate('clinics') },
    { label: 'Total Clinic Users', value: s.users.total, icon: Users, color: '#8B5CF6' },
    { label: 'Total Patients', value: s.patients.total, icon: UserCheck, color: '#06B6D4' },
    { label: 'Total Appointments', value: s.appointments.total, icon: Calendar, color: '#F59E0B' },
    { label: 'Active Doctors', value: s.doctors.active, icon: Stethoscope, color: '#EC4899' },
    { label: 'WhatsApp Channels', value: s.whatsapp.active, icon: MessageSquare, color: '#25D366', onClick: () => onNavigate('whatsapp') },
    { label: 'Admin Active Sessions', value: s.adminSessions.active, icon: ShieldCheck, color: '#6366F1' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Platform Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Real-time aggregate telemetry across all multi-tenant dental clinics.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isSyncing && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              Live Sync
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => loadDashboard(true)}>
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} /> Refresh Data
          </button>
        </div>
      </div>

      {/* Clinic Status Summary Banner */}
      <div
        className="glass-card"
        style={{ padding: '16px 24px', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CLINIC BREAKDOWN</span>
        <span>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{s.clinics.total}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>Total</span>
        </span>
        <span>
          <span style={{ fontWeight: 800, color: '#10B981', fontSize: '1.1rem' }}>{s.clinics.active}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>Active</span>
        </span>
        <span>
          <span style={{ fontWeight: 800, color: '#EF4444', fontSize: '1.1rem' }}>{s.clinics.suspended}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>Suspended</span>
        </span>
        <span>
          <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '1.1rem' }}>{s.clinics.pendingSetup}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>Pending Setup</span>
        </span>
        <span style={{ marginLeft: 'auto' }}>
          <span style={{ fontWeight: 800, color: '#25D366', fontSize: '1.1rem' }}>{s.whatsapp.total}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '4px' }}>Total WhatsApp</span>
        </span>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {statCards.map(({ label, value, icon: Icon, color, onClick }, index) => (
          <div
            key={index}
            className="glass-card"
            onClick={onClick}
            style={{
              padding: '20px',
              cursor: onClick ? 'pointer' : 'default',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {label}
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: `${color}1A`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color,
                }}
              >
                <Icon size={20} />
              </div>
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Recent Platform Audit Trail
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('audit')}>
            View All Audit Logs →
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No audit log entries recorded yet.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Admin Actor</th>
                <th>Status</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                    {log.action}
                  </td>
                  <td>{log.admin?.displayName ?? log.admin?.email ?? 'System Bootstrap'}</td>
                  <td>
                    <span className={`badge ${log.outcome === 'success' ? 'badge-active' : 'badge-danger'}`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {new Date(log.occurredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
