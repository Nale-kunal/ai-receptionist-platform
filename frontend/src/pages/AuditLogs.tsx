import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import type { ApiAuditLog } from '../services/api';
import { ShieldCheck, Search } from 'lucide-react';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAuditLogs();
        setLogs(res || []);
      } catch (err) {
        console.error('Failed to load compliance audit logs:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.module.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase())
  );

  const formatActionDescription = (action: string) => {
    switch (action) {
      case 'user.login':
        return 'Staff Member Logged In';
      case 'appointment.create':
        return 'Scheduled Patient Appointment';
      case 'appointment.cancel':
        return 'Cancelled Appointment';
      case 'patient.update':
        return 'Updated Patient Medical Record';
      case 'ai.config.update':
        return 'Updated AI Receptionist Behavior';
      default:
        return action.replace(/\./g, ' ').replace(/_/g, ' ').toUpperCase();
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Activity Log
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          A record of all actions taken in your practice.
        </p>
      </div>

      <Card style={{ padding: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Input
            placeholder="Search activity records by staff member, practice area, or event..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0, paddingLeft: '40px' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </Card>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading security activity logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ShieldCheck size={48} style={{ margin: '0 auto 16px auto', color: 'var(--text-muted)', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No Activity Yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Actions will appear here automatically as your team uses the platform.
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <Table headers={['Time', 'Team Member', 'Area', 'Action', 'Status']}>
            {filtered.map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.actor}</td>
                <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{log.module}</td>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                  {formatActionDescription(log.action)}
                </td>
                <td>
                  <Badge variant={log.result === 'success' ? 'success' : 'danger'}>
                    {log.result === 'success' ? 'Success' : 'Denied'}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
};
