import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CardSkeleton } from '../ui/Skeleton';
import { MessageSquare, AlertTriangle, RefreshCw } from 'lucide-react';
import { useRecentConversations } from '../../hooks/useDashboardWidgets';

export const RecentCallsWidget: React.FC = () => {
  const navigate = useNavigate();
  const { data: recentConversations, loading, error, refetch } = useRecentConversations();

  if (loading) {
    return <CardSkeleton />;
  }

  if (error) {
    return (
      <Card style={{ borderLeft: '4px solid var(--error)', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--error)' }}>
              {error}
            </span>
          </div>
          <Button
            onClick={refetch}
            variant="secondary"
            style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} /> Retry Calls
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card role="region" aria-label="Recent AI Calls" aria-live="polite">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Recent AI Calls</h3>
        <Button
          onClick={() => navigate('/ai-receptionist/history')}
          variant="secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
        >
          View All
        </Button>
      </div>

      {recentConversations.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <MessageSquare size={32} style={{ margin: '0 auto 8px', color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ fontSize: '0.875rem', marginBottom: '12px' }}>
            Waiting for your first call. Connect a phone number to get started.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/settings/advanced/phone-numbers')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Connect Phone Number
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recentConversations.map((c) => {
            const startTime = c.startedAt
              ? new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Unknown';
            const summaryText = c.summary?.text || c.intent || 'Call completed';

            return (
              <div
                key={c.id}
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div className="flex justify-between items-center w-full">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {c.callerPhone || 'Patient Phone'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>at {startTime}</span>
                  </div>
                  <Badge
                    variant={
                      c.status === 'completed'
                        ? 'success'
                        : c.status === 'initiated' || c.status === 'processing'
                        ? 'primary'
                        : 'danger'
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Outcome: </span>
                  {summaryText}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
