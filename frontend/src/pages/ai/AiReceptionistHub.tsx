import React from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks';
import {
  PERM_CONVERSATION_READ,
  PERM_AI_CONFIG_READ,
  PERM_PROMPT_READ,
  PERM_FAQ_READ,
  PERM_CLINIC_SETTINGS_READ,
} from '../../auth/permissions';

// Sub-pages
import { LiveCallCenter } from '../LiveCallCenter';
import { ConversationHistory } from '../ConversationHistory';
import { KnowledgeBase } from '../KnowledgeBase';
import { AiConfiguration } from '../AiConfiguration';
import { PromptManagement } from '../PromptManagement';
import { VoiceMonitor } from '../VoiceMonitor';
import { WhatsAppChannel } from './WhatsAppChannel';

import {
  Activity,
  PhoneCall,
  History,
  BookOpen,
  Clock,
  MessageSquare,
  Wrench,
  CheckCircle2,
  ArrowRight,
  Calendar,
  ShieldCheck,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
}

export const AiReceptionistHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', path: '/ai-receptionist/overview', icon: Activity, permission: PERM_CONVERSATION_READ },
    { id: 'live', label: 'Live Calls', path: '/ai-receptionist/live', icon: PhoneCall, permission: PERM_CONVERSATION_READ },
    { id: 'history', label: 'Call History', path: '/ai-receptionist/history', icon: History, permission: PERM_CONVERSATION_READ },
    { id: 'whatsapp', label: 'WhatsApp AI', path: '/ai-receptionist/whatsapp', icon: MessageSquare, permission: PERM_CONVERSATION_READ },
    { id: 'knowledge', label: 'Knowledge Base', path: '/ai-receptionist/knowledge', icon: BookOpen, permission: PERM_FAQ_READ },
    { id: 'assistant', label: 'AI Assistant', path: '/ai-receptionist/assistant', icon: MessageSquare, permission: PERM_AI_CONFIG_READ },
    { id: 'advanced', label: 'Advanced', path: '/ai-receptionist/advanced', icon: Wrench, permission: PERM_PROMPT_READ },
  ];

  const visibleTabs = tabs.filter((t) => !t.permission || hasPermission(t.permission));
  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].path : '/ai-receptionist/overview';

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          AI Receptionist
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Your virtual front desk — answers calls, books appointments, and handles FAQs 24/7.
        </p>
      </div>

      {/* Tab Navigation */}
      {visibleTabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '2px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '0',
          }}
        >
          {visibleTabs.map((tab) => {
            const isActive = location.pathname.startsWith(tab.path);
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Routes */}
      <Routes>
        <Route path="overview" element={<AiReceptionistOverview />} />
        <Route path="live" element={<LiveCallCenter />} />
        <Route path="history" element={<ConversationHistory />} />
        <Route path="whatsapp" element={<WhatsAppChannel />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="hours" element={<Navigate to="/settings/hours" replace />} />
        <Route path="assistant" element={<AiConfiguration />} />
        <Route path="advanced" element={<AiAdvanced />} />
        <Route path="advanced/prompts" element={<PromptManagement />} />
        <Route path="advanced/diagnostics" element={<VoiceMonitor />} />
        <Route path="*" element={<Navigate to={defaultTab.replace('/ai-receptionist/', '')} replace />} />
      </Routes>
    </div>
  );
};

// --- AI Receptionist Overview ---
const AiReceptionistOverview: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState({ calls: 0, missed: 0, booked: 0 });
  const [recentCalls, setRecentCalls] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const { api } = await import('../../services/api');
        const todayStr = new Date().toISOString().split('T')[0];
        const [convs, apts] = await Promise.all([
          api.getConversations({ limit: 100 }),
          api.getAppointments(),
        ]);

        const todayConvs = convs.filter((c: any) => {
          if (!c.startedAt) return false;
          return new Date(c.startedAt).toISOString().split('T')[0] === todayStr;
        });

        const missed = todayConvs.filter((c: any) => c.status === 'abandoned' || c.status === 'failed');
        const todayApts = apts.filter((a: any) => a.date === todayStr);

        setStats({
          calls: todayConvs.length,
          missed: missed.length,
          booked: todayApts.filter((a: any) => a.status === 'pending' || a.status === 'scheduled').length,
        });
        setRecentCalls(convs.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Status Banner */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--primary-light), var(--bg-primary))',
          border: '1px solid var(--primary)',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--success)',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
              animation: 'pulse 2s infinite',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                AI Receptionist Operates 24/7/365
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--success-light)',
                  color: 'var(--success)',
                  border: '1px solid var(--success)',
                }}
              >
                ACTIVE 24/7
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Answering calls and booking appointments around the clock. Practice opening hours are managed in Settings.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/settings/hours')}
            style={{ padding: '8px 14px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} />
            <span>Practice Hours in Settings</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/ai-receptionist/live')}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            View Live Calls
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="card" style={{ padding: '18px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>Calls Today</p>
          <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{stats.calls}</h2>
        </div>
        <div className="card" style={{ padding: '18px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>Appointments Booked</p>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--success)' }}>{stats.booked}</h2>
        </div>
        <div className="card" style={{ padding: '18px' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>Missed Calls</p>
          <h2 style={{ margin: 0, fontSize: '1.8rem', color: stats.missed > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{stats.missed}</h2>
        </div>
      </div>

      {/* Recent Calls */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Recent Calls</h3>
          <button className="btn btn-secondary" onClick={() => navigate('/ai-receptionist/history')} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
            View All
          </button>
        </div>

        {recentCalls.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <PhoneCall size={32} style={{ margin: '0 auto 10px', color: 'var(--text-muted)', opacity: 0.5 }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Waiting for your first call. Connect a phone number to get started.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/settings/advanced/phone-numbers')} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Connect Phone Number
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentCalls.map((c: any) => {
              const time = c.startedAt ? new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              const summary = c.summary?.text || c.intent || 'Call processed';
              return (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.callerPhone || 'Unknown Caller'}</span>
                    {time && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>at {time}</span>}
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{summary}</p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: c.status === 'completed' ? 'var(--success-light)' : c.status === 'initiated' || c.status === 'processing' ? 'var(--primary-light)' : 'var(--error-light)',
                      color: c.status === 'completed' ? 'var(--success)' : c.status === 'initiated' || c.status === 'processing' ? 'var(--primary)' : 'var(--error)',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      flexShrink: 0,
                    }}
                  >
                    {c.status === 'completed' ? 'Completed' : c.status === 'initiated' || c.status === 'processing' ? 'Active' : 'Missed'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- AI Advanced ---
const AiAdvanced: React.FC = () => {
  const navigate = useNavigate();

  const links = [
    { label: 'Prompt Studio', description: 'Edit the prompts that control how your AI receptionist responds.', path: '/ai-receptionist/advanced/prompts' },
    { label: 'Voice Diagnostics', description: 'Monitor call quality and voice telemetry.', path: '/ai-receptionist/advanced/diagnostics' },
  ];

  return (
    <div style={{ width: '100%', maxWidth: '1000px' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Advanced configuration for your AI receptionist. Changes here affect how your AI responds to callers.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="card"
            style={{
              display: 'flex', flexDirection: 'column', gap: '4px', padding: '14px 16px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
              cursor: 'pointer', textAlign: 'left', borderRadius: 'var(--radius)', transition: 'box-shadow 0.15s ease',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{link.label}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{link.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
