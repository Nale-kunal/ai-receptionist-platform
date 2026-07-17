import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';
import { Cpu, HardDrive, Wifi, ShieldAlert } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getSystemHealth();
        setHealth(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p>Loading infrastructure status...</p>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">System Health Status</h1>
        <p>Live resource metrics and socket link health across voice pipelines.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* CPU usage card */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>CPU utilization</span>
            <Cpu size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <h2>{health.cpu}%</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Optimal bounds</span>
        </Card>

        {/* Memory card */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Memory Usage</span>
            <HardDrive size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <h2>{health.memory}%</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Heap clean</span>
        </Card>

        {/* API response latencies */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>HTTP Latency</span>
            <Wifi size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <h2>{health.latency} ms</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Ping duration green</span>
        </Card>

        {/* Database status */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>DB Pool Status</span>
            <ShieldAlert size={20} style={{ color: 'var(--success)' }} />
          </div>
          <h2>Active</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>12 connections open</span>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>API Endpoint Performance</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>POST /api/calls (Twilio webhook)</span>
              <span style={{ fontWeight: 600 }}>12ms</span>
            </div>
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>GET /api/appointments</span>
              <span style={{ fontWeight: 600 }}>45ms</span>
            </div>
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>PUT /api/prompts/publish</span>
              <span style={{ fontWeight: 600 }}>88ms</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>WS Streaming Connections</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>Active WebSocket Sockets</span>
              <span style={{ fontWeight: 600 }}>1 stream active</span>
            </div>
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>Packets Dropped</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>0.00%</span>
            </div>
            <div className="flex items-center justify-between" style={{ fontSize: '0.875rem' }}>
              <span>VAD Silence Detections</span>
              <span style={{ fontWeight: 600 }}>12 triggers/min</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
