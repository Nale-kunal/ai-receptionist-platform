import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import type { ApiAuditLog } from '../services/api';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAuditLogs();
        setLogs(res);
      } catch (err) {
        console.error(err);
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

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">System Audit Trails</h1>
        <p>Immutable, searchable records of user and AI operations across tenant boundaries.</p>
      </div>

      <Card style={{ padding: '16px' }}>
        <Input
          placeholder="Filter audit records by actor, module layer, or action..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </Card>

      {loading ? (
        <p>Loading audit logs...</p>
      ) : (
        <Table headers={['Time (UTC)', 'Actor Principal', 'Module Layer', 'Action Executed', 'Status Result', 'Correlation Trace ID']}>
          {filtered.map((log, i) => (
            <tr key={i}>
              <td style={{ fontSize: '0.85rem' }}>{new Date(log.timestamp).toUTCString()}</td>
              <td style={{ fontWeight: 600 }}>{log.actor}</td>
              <td>{log.module}</td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.action}</td>
              <td>
                <Badge variant={log.result === 'SUCCESS' || log.result === 'DELIVERED' ? 'success' : 'primary'}>
                  {log.result}
                </Badge>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {log.correlationId}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
};
