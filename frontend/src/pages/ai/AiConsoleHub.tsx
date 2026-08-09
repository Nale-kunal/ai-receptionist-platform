import React from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/hooks';
import {
  PERM_CONVERSATION_READ,
  PERM_AI_CONFIG_READ,
  PERM_PROMPT_READ,
  PERM_FAQ_READ,
} from '../../auth/permissions';

// Sub-module components
import { LiveCallCenter } from '../LiveCallCenter';
import { ConversationHistory } from '../ConversationHistory';
import { VoiceMonitor } from '../VoiceMonitor';
import { AiConfiguration } from '../AiConfiguration';
import { PromptManagement } from '../PromptManagement';
import { KnowledgeBase } from '../KnowledgeBase';
import { PhoneNumbers } from '../PhoneNumbers';

import {
  PhoneCall,
  History,
  Mic,
  Sliders,
  FileCode,
  BookOpen,
  Phone,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ElementType;
  permission?: string;
}

export const AiConsoleHub: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();

  const tabs: TabItem[] = [
    { id: 'live', label: 'Live Inbound Receptionist', path: '/ai-console/live', icon: PhoneCall, permission: PERM_CONVERSATION_READ },
    { id: 'history', label: 'Call Summaries & History', path: '/ai-console/history', icon: History, permission: PERM_CONVERSATION_READ },
    { id: 'voice', label: 'Voice Quality Telemetry', path: '/ai-console/voice', icon: Mic, permission: PERM_CONVERSATION_READ },
    { id: 'knowledge', label: 'Knowledge Base & FAQ', path: '/ai-console/knowledge', icon: BookOpen, permission: PERM_FAQ_READ },
    { id: 'settings', label: 'AI Voice & Behavior', path: '/ai-console/settings', icon: Sliders, permission: PERM_AI_CONFIG_READ },
    { id: 'prompts', label: 'AI Prompt Studio', path: '/ai-console/prompts', icon: FileCode, permission: PERM_PROMPT_READ },
    { id: 'phone-numbers', label: 'Phone Lines & Telephony', path: '/ai-console/phone-numbers', icon: Phone, permission: PERM_AI_CONFIG_READ },
  ];

  const visibleTabs = tabs.filter((t) => !t.permission || hasPermission(t.permission));

  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].path : '/ai-console/live';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Commercial Header Banner */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          AI Receptionist Console
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
          Real-time patient call handling, voice telemetry, clinical FAQ knowledge base, and AI conversation logs.
        </p>
      </div>

      {/* Enterprise Tabbed Navigation Bar */}
      {visibleTabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '4px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '24px',
            overflowX: 'auto',
            paddingBottom: '2px',
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
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Module Routes */}
      <Routes>
        <Route path="live" element={<LiveCallCenter />} />
        <Route path="history" element={<ConversationHistory />} />
        <Route path="voice" element={<VoiceMonitor />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="settings" element={<AiConfiguration />} />
        <Route path="prompts" element={<PromptManagement />} />
        <Route path="phone-numbers" element={<PhoneNumbers />} />
        <Route path="*" element={<Navigate to={defaultTab.replace('/ai-console/', '')} replace />} />
      </Routes>
    </div>
  );
};
