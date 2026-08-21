/**
 * Admin System Health Page
 *
 * Checks probe endpoints for backend and database status.
 */

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, RefreshCw, Database, Server, Shield } from 'lucide-react';
import { adminApiClient } from '../services/adminApiClient';

// Derive the backend base origin from the same env var used by adminApiClient.
// This avoids hardcoding localhost:3001 which would break in staging / production.
const ADMIN_API_BASE = (import.meta as any).env?.VITE_ADMIN_API_URL || 'http://localhost:3001/api/v1/admin';

// Strip the '/api/v1/admin' path suffix to get just the origin + optional prefix
// e.g. 'http://localhost:3001/api/v1/admin' → 'http://localhost:3001'
function getBackendOrigin(apiBase: string): string {
  try {
    const url = new URL(apiBase);
    return url.origin;
  } catch {
    // If parsing fails fall back to the raw base minus path
    return apiBase.replace(/\/api\/v1\/admin\/?$/, '');
  }
}

export const SystemHealth: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [readyStatus, setReadyStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    const origin = getBackendOrigin(ADMIN_API_BASE);
    try {
      const [hRes, rRes] = await Promise.all([
        fetch(`${origin}/health`).then((r) => r.json()).catch(() => null),
        fetch(`${origin}/ready`).then((r) => r.json()).catch(() => null),
      ]);
      setHealthStatus(hRes);
      setReadyStatus(rRes);
    } catch {
      setHealthStatus(null);
      setReadyStatus(null);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            System Health & Telemetry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Infrastructure connectivity and health probes for the Super Admin layer.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={checkHealth}>
          <RefreshCw size={14} /> Re-check Probes
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Admin Backend Status */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Server size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Admin Backend Service
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Port 3001 • Separate Express Process
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-dark)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Liveness Probe (/health)</span>
            <span className={`badge ${healthStatus?.status === 'ok' ? 'badge-active' : 'badge-danger'}`}>
              {healthStatus?.status === 'ok' ? 'Healthy' : 'Unreachable'}
            </span>
          </div>
        </div>

        {/* Database Status */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Neon PostgreSQL Database
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Multi-Tenant Primary Database
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-dark)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Readiness Probe (/ready)</span>
            <span className={`badge ${readyStatus?.database === 'connected' ? 'badge-active' : 'badge-danger'}`}>
              {readyStatus?.database === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
