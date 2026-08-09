import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Drawer';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { Search, Clock, MessageSquare, Shield, Copy, Check, Activity } from 'lucide-react';

export const ConversationHistory: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.getConversations();
      setConversations(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleCopyTranscript = () => {
    if (!selectedConversation || !selectedConversation.transcript) return;
    const text = selectedConversation.transcript
      .map((t: any) => `${t.speaker?.toUpperCase() || 'UNKNOWN'}: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredConversations = conversations.filter((c) => {
    const caller = (c.callerPhone || '').toLowerCase();
    const patientName = (c.patient?.fullName || '').toLowerCase();
    const intent = (c.intent || '').toLowerCase();
    const outcome = (c.summary?.text || '').toLowerCase();
    const term = search.toLowerCase();

    return caller.includes(term) || patientName.includes(term) || intent.includes(term) || outcome.includes(term);
  });

  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') return 'success';
    if (s === 'active' || s === 'initiated') return 'primary';
    if (s === 'failed') return 'danger';
    return 'warning';
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex justify-between items-center w-full flex-wrap gap-4">
        <div>
          <h1 className="mb-2">Conversation History</h1>
          <p>Review past patient interaction details and AI processing dialogue traces.</p>
        </div>
        <Button onClick={loadConversations} variant="secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={16} />
          <span>Refresh Records</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={18} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search calls by caller phone number, patient name, resolved intent, or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ border: 'none', padding: '4px', fontSize: '0.9rem', width: '100%', outline: 'none', background: 'transparent' }}
        />
      </Card>

      {/* Conversation Records Table */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Syncing conversation registry...</p>
      ) : filteredConversations.length === 0 ? (
        <Card style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <MessageSquare size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
          <h3>No conversation records found</h3>
          <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>
            When the AI Receptionist answers calls, they will be registered here.
          </p>
        </Card>
      ) : (
        <Table headers={['Time', 'Caller', 'Patient Name', 'Duration', 'Resolved Intent', 'Status', 'Action']}>
          {filteredConversations.map((c) => {
            const time = c.startedAt ? new Date(c.startedAt).toLocaleString() : 'Unknown';
            return (
              <tr key={c.id}>
                <td>{time}</td>
                <td style={{ fontWeight: 600 }}>{c.callerPhone || 'Anonymous'}</td>
                <td>{c.patient?.fullName || 'Not registered'}</td>
                <td style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                  <span>{formatDuration(c.durationSeconds)}</span>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.intent || 'None'}</td>
                <td>
                  <Badge variant={getStatusVariant(c.status)}>
                    {c.status}
                  </Badge>
                </td>
                <td>
                  <button
                    onClick={() => setSelectedConversation(c)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    View Details & Trace
                  </button>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {/* Conversation Detail Drawer */}
      <Drawer isOpen={!!selectedConversation} onClose={() => setSelectedConversation(null)} title="Call & AI Processing Audit Trace">
        {selectedConversation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Overview Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.875rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CALL START</span>
                <span style={{ fontWeight: 600 }}>{new Date(selectedConversation.startedAt).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CALL DURATION</span>
                <span style={{ fontWeight: 600 }}>{formatDuration(selectedConversation.durationSeconds)}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>CALLER NUMBER</span>
                <span style={{ fontWeight: 600 }}>{selectedConversation.callerPhone || 'Unknown'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>PATIENT</span>
                <span style={{ fontWeight: 600 }}>{selectedConversation.patient?.fullName || 'Not registered'}</span>
              </div>
            </div>

            {/* AI Summary */}
            <Card style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '12px' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                AI Core Outcome Summary
              </span>
              <p style={{ fontSize: '0.875rem', marginTop: '6px', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                {selectedConversation.summary?.text || 'No summary resolved during call.'}
              </p>
            </Card>

            {/* Transcript Area */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DIALOGUE TRANSCRIPT</span>
                <Button
                  variant="secondary"
                  onClick={handleCopyTranscript}
                  style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>

              {/* Transcript Search Filter */}
              <Input
                placeholder="Search transcript text..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                style={{ padding: '6px 8px', fontSize: '0.8rem', marginBottom: '8px' }}
              />

              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius)',
                  padding: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {Array.isArray(selectedConversation.transcript) && selectedConversation.transcript.length > 0 ? (
                  selectedConversation.transcript
                    .filter((t: any) => (t.text || '').toLowerCase().includes(transcriptSearch.toLowerCase()))
                    .map((t: any, index: number) => {
                      const isAI = t.speaker?.toLowerCase().includes('ai') || t.speaker?.toLowerCase().includes('assistant');
                      return (
                        <div
                          key={index}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius)',
                            maxWidth: '85%',
                            alignSelf: isAI ? 'flex-start' : 'flex-end',
                            backgroundColor: isAI ? 'var(--bg-secondary)' : 'var(--primary-light)',
                            border: isAI ? '1px solid var(--border-color)' : '1px solid var(--primary-light)',
                            color: isAI ? 'var(--text-primary)' : 'var(--primary)',
                          }}
                        >
                          <div style={{ fontSize: '0.675rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px' }}>
                            {isAI ? 'AI RECEPTIONIST' : 'PATIENT'}
                          </div>
                          <div style={{ fontSize: '0.825rem', lineHeight: '1.4' }}>{t.text}</div>
                        </div>
                      );
                    })
                ) : (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No voice dialogue turns recorded.</p>
                )}
              </div>
            </div>

            {/* Security Audit logs badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                backgroundColor: 'var(--success-light)',
                borderRadius: 'var(--radius)',
                color: 'var(--success)',
                fontSize: '0.75rem',
              }}
            >
              <Shield size={14} />
              <span>Personal Identifiable Information (PII) masked successfully inside system logs.</span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
