import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/Card';
import { CardSkeleton } from '../ui/Skeleton';
import { Button } from '../ui/Button';
import { Calendar, PhoneCall, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useKpiMetrics } from '../../hooks/useDashboardWidgets';

interface KpiMetricsWidgetProps {
  onSwitchToListMode: () => void;
  pendingWidgetRef: React.RefObject<HTMLDivElement | null>;
}

export const KpiMetricsWidget: React.FC<KpiMetricsWidgetProps> = ({
  onSwitchToListMode,
  pendingWidgetRef,
}) => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useKpiMetrics();

  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          width: '100%',
        }}
      >
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
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
            <RefreshCw size={14} /> Retry Metrics
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      role="region"
      aria-label="Key Performance Metrics"
      aria-live="polite"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
    >
      {/* Today's Appointments */}
      <Card
        onClick={onSwitchToListMode}
        tabIndex={0}
        role="button"
        aria-label="View Today's Appointments list"
        onKeyDown={(e) => e.key === 'Enter' && onSwitchToListMode()}
        style={{
          borderLeft: '4px solid var(--primary)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Today&apos;s Appts</span>
          <Calendar size={20} style={{ color: 'var(--primary)' }} />
        </div>
        <h2>{data.todayApptsCount}</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Switch to list view →</span>
      </Card>

      {/* Today's Calls */}
      <Card
        onClick={() => navigate('/ai-receptionist/history')}
        tabIndex={0}
        role="button"
        aria-label="View Today's AI Receptionist Calls"
        onKeyDown={(e) => e.key === 'Enter' && navigate('/ai-receptionist/history')}
        style={{
          borderLeft: '4px solid var(--success)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Today&apos;s Calls</span>
          <PhoneCall size={20} style={{ color: 'var(--success)' }} />
        </div>
        <h2>{data.todayCallsCount}</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>View call history →</span>
      </Card>

      {/* Missed Calls */}
      <Card
        onClick={() => navigate('/ai-receptionist/history')}
        tabIndex={0}
        role="button"
        aria-label="View Missed Calls"
        onKeyDown={(e) => e.key === 'Enter' && navigate('/ai-receptionist/history')}
        style={{
          borderLeft: data.missedCallsCount > 0 ? '4px solid var(--error)' : '4px solid var(--border-color)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Missed Calls</span>
          <AlertTriangle size={20} style={{ color: data.missedCallsCount > 0 ? 'var(--error)' : 'var(--text-muted)' }} />
        </div>
        <h2 style={{ color: data.missedCallsCount > 0 ? 'var(--error)' : 'inherit' }}>{data.missedCallsCount}</h2>
        <span style={{ fontSize: '0.75rem', color: data.missedCallsCount > 0 ? 'var(--error)' : 'var(--text-muted)', fontWeight: 600 }}>
          {data.missedCallsCount > 0 ? 'Requires review →' : 'No missed calls →'}
        </span>
      </Card>

      {/* Pending Confirmations */}
      <Card
        onClick={() => pendingWidgetRef.current?.scrollIntoView({ behavior: 'smooth' })}
        tabIndex={0}
        role="button"
        aria-label="Scroll to Pending Confirmations action center"
        onKeyDown={(e) => e.key === 'Enter' && pendingWidgetRef.current?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          borderLeft: data.pendingConfirmationsCount > 0 ? '4px solid var(--warning)' : '4px solid var(--border-color)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Pending Confirmations</span>
          <Clock size={20} style={{ color: data.pendingConfirmationsCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }} />
        </div>
        <h2 style={{ color: data.pendingConfirmationsCount > 0 ? 'var(--warning)' : 'inherit' }}>{data.pendingConfirmationsCount}</h2>
        <span style={{ fontSize: '0.75rem', color: data.pendingConfirmationsCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}>
          {data.pendingConfirmationsCount > 0 ? 'Action required ↓' : 'All clear →'}
        </span>
      </Card>
    </div>
  );
};
