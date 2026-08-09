import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

export const Integrations: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Integrations Portal</h1>
        <p>Manage infrastructure settings for telephony streams and AI engines.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* OpenAI Card */}
        <Card>
          <div className="flex justify-between items-start">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>OpenAI Developer API</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Required for real-time WebSocket communication and GPT audio streams.
              </p>
              <div className="flex gap-4 mt-4" style={{ fontSize: '0.8rem' }}>
                <span>API Key: <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>sk-proj-••••••••••••</code></span>
                <span>Model: <code>gpt-4o-realtime</code></span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="success">Connected</Badge>
              <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Update Credentials</Button>
            </div>
          </div>
        </Card>

        {/* Twilio Card */}
        <Card>
          <div className="flex justify-between items-start">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>Twilio Telephony Provider</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Required to receive incoming patient calls and open duplex media stream sockets.
              </p>
              <div className="flex gap-4 mt-4" style={{ fontSize: '0.8rem' }}>
                <span>Account SID: <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>AC••••••••••••••••</code></span>
                <span>Active Trunks: <code>Configured via Environment</code></span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="success">Connected</Badge>
              <Button variant="secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Update Credentials</Button>
            </div>
          </div>
        </Card>

        {/* Google Calendar Card */}
        <Card style={{ opacity: 0.75 }}>
          <div className="flex justify-between items-start">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>Google Calendar</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Future provider integration for doctor calendars sync.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="warning">Unavailable</Badge>
              <Button variant="primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} disabled>Connect</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
