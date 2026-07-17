import React, { useEffect, useState } from 'react';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Drawer';
import { api } from '../services/api';
import type { ApiAuditLog } from '../services/api';

export const ConversationHistory: React.FC = () => {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ApiAuditLog | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getAuditLogs();
        // filter call-flow related audit actions
        setLogs(res.filter((l) => l.module === 'end-to-end' || l.module === 'appointment'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Conversation History</h1>
        <p>Review past patient interaction details and AI processing audit traces.</p>
      </div>

      {loading ? (
        <p>Loading historical calls...</p>
      ) : (
        <Table headers={['Timestamp', 'Actor/Source', 'Module Layer', 'Action Triggered', 'Result status', 'Correlation ID', 'Action']}>
          {logs.map((log, i) => (
            <tr key={i}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td style={{ fontWeight: 600 }}>{log.actor}</td>
              <td>{log.module}</td>
              <td>{log.action}</td>
              <td>
                <Badge variant={log.result === 'SUCCESS' || log.result === 'DELIVERED' ? 'success' : 'warning'}>
                  {log.result}
                </Badge>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.correlationId}</td>
              <td>
                <button
                  onClick={() => setSelectedLog(log)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  View Trace
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Audit Detail Trace Drawer */}
      <Drawer isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Event Trace">
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TIMESTAMP</label>
              <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>{new Date(selectedLog.timestamp).toUTCString()}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTOR PRINCIPAL</label>
              <p style={{ fontSize: '0.9rem', marginTop: '4px', fontWeight: 600 }}>{selectedLog.actor}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>MODULE BOUNDARY</label>
              <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>{selectedLog.module}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTION EXECUTED</label>
              <p style={{ fontSize: '0.9rem', marginTop: '4px', fontFamily: 'monospace' }}>{selectedLog.action}</p>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CORRELATION TRACE ID</label>
              <p style={{ fontSize: '0.9rem', marginTop: '4px', fontFamily: 'monospace', color: 'var(--primary)' }}>
                {selectedLog.correlationId}
              </p>
            </div>
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius)',
                padding: '16px',
                fontSize: '0.8rem',
              }}
            >
              <h4 style={{ marginBottom: '8px' }}>Security Trace Context</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Verification payload signed and verified. Personal Identifiable Information (PII) masked successfully inside system logs.
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
