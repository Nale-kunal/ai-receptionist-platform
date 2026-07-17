import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardHome } from './pages/DashboardHome';
import { LiveCallCenter } from './pages/LiveCallCenter';
import { Appointments } from './pages/Appointments';
import { Patients } from './pages/Patients';
import { Doctors } from './pages/Doctors';
import { CalendarPage } from './pages/CalendarPage';
import { ConversationHistory } from './pages/ConversationHistory';
import { PromptManagement } from './pages/PromptManagement';
import { AiConfiguration } from './pages/AiConfiguration';
import { KnowledgeBase } from './pages/KnowledgeBase';
import { Notifications } from './pages/Notifications';
import { Integrations } from './pages/Integrations';
import { UsersRbac } from './pages/UsersRbac';
import { AuditLogs } from './pages/AuditLogs';
import { SystemHealth } from './pages/SystemHealth';

// Guard for Route Access based on permissions
const GuardedRoute: React.FC<{
  permission: string;
  element: React.ReactElement;
}> = ({ permission, element }) => {
  const { hasPermission } = useApp();
  
  if (!hasPermission(permission)) {
    return (
      <div style={{ padding: '24px', color: 'var(--error)' }}>
        <h2>Forbidden</h2>
        <p>You do not have the required access role permissions to view this dashboard page.</p>
      </div>
    );
  }

  return element;
};

const DashboardRoutes: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/live-calls" element={<GuardedRoute permission="clinic.view" element={<LiveCallCenter />} />} />
        <Route path="/appointments" element={<GuardedRoute permission="appointment.view" element={<Appointments />} />} />
        <Route path="/patients" element={<GuardedRoute permission="patient.view" element={<Patients />} />} />
        <Route path="/doctors" element={<GuardedRoute permission="doctor.view" element={<Doctors />} />} />
        <Route path="/calendar" element={<GuardedRoute permission="appointment.view" element={<CalendarPage />} />} />
        <Route path="/history" element={<GuardedRoute permission="clinic.view" element={<ConversationHistory />} />} />
        <Route path="/prompts" element={<GuardedRoute permission="prompt.view" element={<PromptManagement />} />} />
        <Route path="/ai-config" element={<GuardedRoute permission="configuration.view" element={<AiConfiguration />} />} />
        <Route path="/knowledge" element={<GuardedRoute permission="configuration.view" element={<KnowledgeBase />} />} />
        <Route path="/notifications" element={<GuardedRoute permission="configuration.view" element={<Notifications />} />} />
        <Route path="/integrations" element={<GuardedRoute permission="configuration.view" element={<Integrations />} />} />
        <Route path="/users-rbac" element={<GuardedRoute permission="rbac.role.manage" element={<UsersRbac />} />} />
        <Route path="/audit-logs" element={<GuardedRoute permission="audit.view" element={<AuditLogs />} />} />
        <Route path="/health" element={<GuardedRoute permission="health.view" element={<SystemHealth />} />} />
        
        {/* Fallback to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router>
          <DashboardRoutes />
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}
