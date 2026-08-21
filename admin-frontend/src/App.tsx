/**
 * Admin Frontend Main App Entry
 *
 * Routes between Login, ChangePassword, and AdminLayout based on auth state.
 */

import React, { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { ClinicsList } from './pages/ClinicsList';
import { ClinicDetail } from './pages/ClinicDetail';
import { WhatsAppList } from './pages/WhatsAppList';
import { AuditLogs } from './pages/AuditLogs';
import { SystemHealth } from './pages/SystemHealth';
import { RefreshCw } from 'lucide-react';

const AdminAppContent: React.FC = () => {
  const { admin, isAuthenticated, loading } = useAdminAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-dark)',
          color: 'var(--text-muted)',
        }}
      >
        <RefreshCw size={24} className="spin" style={{ marginRight: '12px' }} /> Initializing Admin Session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onSuccess={(mustChange) => { if (mustChange) setCurrentTab('change-password'); }} />;
  }

  if (admin?.mustChangePassword || currentTab === 'change-password') {
    return <ChangePassword onSuccess={() => setCurrentTab('dashboard')} />;
  }

  const renderContent = () => {
    if (selectedClinicId && currentTab === 'clinics') {
      return <ClinicDetail clinicId={selectedClinicId} onBack={() => setSelectedClinicId(null)} />;
    }

    switch (currentTab) {
      case 'dashboard':
        return <Dashboard onNavigate={(tab) => { setCurrentTab(tab); setSelectedClinicId(null); }} />;
      case 'clinics':
        return <ClinicsList onSelectClinic={(id) => setSelectedClinicId(id)} />;
      case 'whatsapp':
        return <WhatsAppList />;
      case 'audit':
        return <AuditLogs />;
      case 'health':
        return <SystemHealth />;
      default:
        return <Dashboard onNavigate={(tab) => { setCurrentTab(tab); setSelectedClinicId(null); }} />;
    }
  };

  return (
    <AdminLayout
      currentTab={currentTab}
      onSelectTab={(tab) => {
        setCurrentTab(tab);
        setSelectedClinicId(null);
      }}
    >
      {renderContent()}
    </AdminLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <AdminAppContent />
    </AdminAuthProvider>
  );
};
