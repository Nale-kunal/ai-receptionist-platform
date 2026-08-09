import React from 'react';
import { Mic, Radio, Volume2, Shield, Activity } from 'lucide-react';

export const VoiceMonitor: React.FC = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Real-Time Voice & Stream Monitor
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Live audio telemetry, AI speech synthesis latency, and real-time call monitoring.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge" style={{ backgroundColor: '#10b98120', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} /> STREAM LISTENER ONLINE
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} />
          Active Audio Pipeline Streams
        </h3>
        <div style={{ height: '260px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
          <Mic size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>No Active Audio Streams Currently Transmitting</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for inbound telephony audio stream...</span>
        </div>
      </div>
    </div>
  );
};
