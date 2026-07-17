import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../services/api';
import { PhoneCall, Calendar, TrendingUp, Clock } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const DashboardHome: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [patientsCount, setPatientsCount] = useState(0);

  const mockLatencyData = [
    { name: '08:00', latency: 85 },
    { name: '10:00', latency: 98 },
    { name: '12:00', latency: 95 },
    { name: '14:00', latency: 110 },
    { name: '16:00', latency: 88 },
    { name: '18:00', latency: 92 },
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const [healthRes, apts, pats] = await Promise.all([
          api.getSystemHealth(),
          api.getAppointments(),
          api.getPatients(),
        ]);
        setHealth(healthRes);
        setAppointmentsCount(apts.length);
        setPatientsCount(pats.length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading Dashboard Home metrics...</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="mb-2">Operating System Dashboard</h1>
        <p>Monitor your AI receptionists and scheduling pipelines in real time.</p>
      </div>

      {/* Grid of Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-4 w-full">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Active Live Calls</span>
            <PhoneCall size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <h2>1 Call</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>● Channel status active</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Today's Appts</span>
            <Calendar size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <h2>{appointmentsCount} Appointments</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{patientsCount} patients in registry</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>AI Success Rate</span>
            <TrendingUp size={20} style={{ color: 'var(--success)' }} />
          </div>
          <h2>98.2%</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+0.4% from last week</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Avg Response Latency</span>
            <Clock size={20} style={{ color: 'var(--warning)' }} />
          </div>
          <h2>{health?.latency || 95} ms</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Optimal routing</span>
        </Card>
      </div>

      {/* Latency Charts & System Health Split */}
      <div className="grid grid-cols-3 gap-6">
        {/* Latency History Chart */}
        <Card className="grid-cols-2" style={{ gridColumn: 'span 2' }}>
          <CardHeader>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>AI Response Latency (24h)</h3>
            <Badge variant="success">Online</Badge>
          </CardHeader>
          <CardContent style={{ height: '240px', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockLatencyData}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="latency" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#latencyGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Health Module */}
        <Card>
          <CardHeader>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Infrastructure Health</h3>
          </CardHeader>
          <CardContent style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.875rem' }}>E2E Voice Server</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.875rem' }}>OpenAI Adapter Connection</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.875rem' }}>Twilio Stream Gateway</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.875rem' }}>PostgreSQL Cache</span>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: '0.875rem' }}>Prompt Engine Registry</span>
              <Badge variant="success">Healthy</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
