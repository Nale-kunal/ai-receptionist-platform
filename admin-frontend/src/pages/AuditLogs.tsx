/**
 * Platform Audit Logs Page
 *
 * Immutable audit history for all Super Admin actions across all tenants.
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Search, Clock, RefreshCw, Filter, AlertTriangle } from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';

interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  outcome: string;
  ipAddress?: string;
  occurredAt: string;
  metadata?: any;
  admin?: { email: string; displayName: string };
}

import { adminFrontendCache } from '../services/adminCacheService';

export const AuditLogs: React.FC = () => {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const cacheKey = `/audit?page=${page}&action=${actionFilter}`;
  const cached = adminFrontendCache.get<{ logs: AuditLog[]; pagination: { totalPages: number } }>(cacheKey);

  const [logs, setLogs] = useState<AuditLog[]>(cached?.logs ?? []);
  const [totalPages, setTotalPages] = useState(cached?.pagination?.totalPages ?? 1);
  const [loading, setLoading] = useState(!cached);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAuditLogs = async (force = false) => {
    if (!logs.length || force) {
      if (!logs.length) setLoading(true);
    }
    setFetchError(null);
    try {
      const res = await adminApiClient.get('/audit', {
        params: { page, action: actionFilter },
      });
      const data = res.data?.data;
      if (data?.logs) {
        setLogs(data.logs);
        setTotalPages(data.pagination?.totalPages || 1);
        adminFrontendCache.set(cacheKey, data);
      }
    } catch (err: any) {
      if (!logs.length) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to load audit logs.';
        setFetchError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(true);

    const handleRevalidate = () => {
      if (document.visibilityState === 'visible') {
        fetchAuditLogs(false);
      }
    };

    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchAuditLogs(false);
      }
    }, 10_000);

    const unsubscribe = adminFrontendCache.subscribe(() => {
      fetchAuditLogs(true);
    });

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(timer);
      unsubscribe();
    };
  }, [page, actionFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Platform Audit Logs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Immutable event log recording every sensitive mutation performed in the platform admin console.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ position: 'relative', maxWidth: '360px' }}>
        <Filter size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          placeholder="Filter by action (e.g. whatsapp, clinic)…"
          className="input"
          style={{ paddingLeft: '38px' }}
        />
      </div>

      {/* Table Card */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading audit logs…</p>
          </div>
        ) : fetchError ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: 'var(--danger)', margin: '0 auto 12px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Unable to load audit logs</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>{fetchError}</p>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchAuditLogs(true)}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No audit logs found matching your filter.
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Admin Actor</th>
                <th>Target Entity</th>
                <th>IP Address</th>
                <th>Outcome</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                    {log.action}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {log.admin?.displayName ?? log.admin?.email ?? 'System Bootstrap'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {log.entityType ? `${log.entityType}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {log.ipAddress || 'internal'}
                  </td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
