import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import { Phone } from 'lucide-react';

export const LiveCallCenter: React.FC = () => {
  const [calls, setCalls] = useState<any[]>([]);
  const [selectedCall, setSelectedCall] = useState<any>(null);

  useEffect(() => {
    async function loadCalls() {
      try {
        const res = await api.getLiveCalls();
        setCalls(res);
        if (res.length > 0) {
          setSelectedCall(res[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadCalls();
  }, []);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Live Call Center</h1>
        <p>Monitor live phone calls processed by the AI Receptionist.</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Side: Active Call List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Active Stream Channels</h3>
          {calls.length === 0 ? (
            <Card>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No live calls active right now.</p>
            </Card>
          ) : (
            calls.map((c) => (
              <Card
                key={c.sessionId}
                className="btn-secondary"
                style={{
                  cursor: 'pointer',
                  borderColor: selectedCall?.sessionId === c.sessionId ? 'var(--primary)' : 'var(--border-color)',
                  backgroundColor: selectedCall?.sessionId === c.sessionId ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  padding: '16px',
                }}
                onClick={() => setSelectedCall(c)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.callerNumber}</span>
                  <Badge variant="primary">{c.status}</Badge>
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>Duration: {c.duration}</span>
                  <span>Prompt v{c.promptVersion}</span>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Right Side: Transcription Monitor console */}
        <div style={{ gridColumn: 'span 2' }}>
          {selectedCall ? (
            <Card style={{ height: '520px', display: 'flex', flexDirection: 'column' }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Phone size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '1.125rem' }}>Stream: {selectedCall.callerNumber}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">Active Supervisor Tap</Badge>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ID: {selectedCall.sessionId}</span>
                </div>
              </CardHeader>
              
              {/* Live Transcript Logs Console */}
              <div
                style={{
                  flexGrow: 1,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  padding: '20px',
                  margin: '16px 0',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {selectedCall.transcript.map((t: any, i: number) => {
                  const isAi = t.speaker === 'AI Assistant';
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isAi ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                        alignSelf: isAi ? 'flex-start' : 'flex-end',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {t.speaker} ({t.time})
                      </span>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          backgroundColor: isAi ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                          color: isAi ? 'var(--primary)' : 'var(--text-primary)',
                          border: isAi ? '1px solid var(--primary-light)' : '1px solid var(--border-color)',
                          fontSize: '0.875rem',
                          lineHeight: '1.4',
                        }}
                      >
                        {t.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Monitoring Footer details */}
              <div className="flex justify-between items-center" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Speech Energy: Normal (VAD threshold: -45db)</span>
                <span className="flex items-center gap-2">
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--success)',
                      display: 'inline-block',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                  Live Websocket Synced
                </span>
              </div>
            </Card>
          ) : (
            <Card style={{ height: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>Select an active call to begin supervisor monitoring.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
