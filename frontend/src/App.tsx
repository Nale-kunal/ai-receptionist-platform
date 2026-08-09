import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { TenantProvider } from './contexts/TenantContext';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGuard } from './auth/AuthGuard';
import { PublicRoute } from './auth/PublicRoute';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Canonical Permissions
import {
  PERM_CLINIC_READ,
  PERM_APPOINTMENT_READ,
  PERM_CALENDAR_READ,
  PERM_PATIENT_READ,
  PERM_CONVERSATION_READ,
  PERM_CLINIC_SETTINGS_READ,
} from './auth/permissions';

// Public Guest Routes (Lazy-loaded)
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail').then((m) => ({ default: m.VerifyEmail })));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation').then((m) => ({ default: m.AcceptInvitation })));
const ReviewInvitation = lazy(() => import('./pages/ReviewInvitation').then((m) => ({ default: m.ReviewInvitation })));

// Core Daily Workflow Pages (Lazy-loaded)
const DashboardHome = lazy(() => import('./pages/DashboardHome').then((m) => ({ default: m.DashboardHome })));
const Appointments = lazy(() => import('./pages/Appointments').then((m) => ({ default: m.Appointments })));
const Patients = lazy(() => import('./pages/Patients').then((m) => ({ default: m.Patients })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const UserProfile = lazy(() => import('./pages/UserProfile').then((m) => ({ default: m.UserProfile })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));

// Hub Modules (Lazy-loaded)
const SettingsHub = lazy(() => import('./pages/settings/SettingsHub').then((m) => ({ default: m.SettingsHub })));
const AiReceptionistHub = lazy(() => import('./pages/ai/AiReceptionistHub').then((m) => ({ default: m.AiReceptionistHub })));

import { PageSkeleton } from './components/ui/Skeleton';

const PageFallback = () => (
  <div style={{ padding: '24px' }}>
    <PageSkeleton cards={4} rows={6} />
  </div>
);


const ProtectedLayout = () => {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Primary Daily Workflows */}
          <Route path="/" element={<AuthGuard permission={PERM_CLINIC_READ} element={<DashboardHome />} />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/appointments" element={<AuthGuard permission={PERM_APPOINTMENT_READ} element={<Appointments />} />} />
          <Route path="/calendar" element={<AuthGuard permission={PERM_CALENDAR_READ} element={<CalendarPage />} />} />
          <Route path="/patients" element={<AuthGuard permission={PERM_PATIENT_READ} element={<Patients />} />} />

          {/* AI Receptionist Hub */}
          <Route path="/ai-receptionist/*" element={<AuthGuard permission={PERM_CONVERSATION_READ} element={<AiReceptionistHub />} />} />

          {/* Settings Hub (absorbs old Administration) */}
          <Route path="/settings/*" element={<AuthGuard permission={PERM_CLINIC_SETTINGS_READ} element={<SettingsHub />} />} />

          {/* User Account */}
          <Route path="/profile" element={<AuthGuard element={<UserProfile />} />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<AuthGuard element={<Onboarding />} />} />

          {/* Legacy redirects for bookmarked URLs */}
          <Route path="/ai-console/*" element={<Navigate to="/ai-receptionist/overview" replace />} />
          <Route path="/admin/*" element={<Navigate to="/settings/practice" replace />} />
          <Route path="/live-calls" element={<Navigate to="/ai-receptionist/live" replace />} />
          <Route path="/history" element={<Navigate to="/ai-receptionist/history" replace />} />
          <Route path="/prompts" element={<Navigate to="/ai-receptionist/advanced/prompts" replace />} />
          <Route path="/ai-config" element={<Navigate to="/ai-receptionist/assistant" replace />} />
          <Route path="/knowledge" element={<Navigate to="/ai-receptionist/knowledge" replace />} />
          <Route path="/users-rbac" element={<Navigate to="/settings/team" replace />} />
          <Route path="/roles-permissions" element={<Navigate to="/settings/team" replace />} />
          <Route path="/clinics" element={<Navigate to="/settings/practice" replace />} />
          <Route path="/clinic-settings" element={<Navigate to="/settings/practice" replace />} />
          <Route path="/billing" element={<Navigate to="/settings/billing" replace />} />
          <Route path="/audit-logs" element={<Navigate to="/settings/advanced/activity-log" replace />} />
          <Route path="/analytics" element={<Navigate to="/settings/advanced/analytics" replace />} />
          <Route path="/tenants" element={<Navigate to="/settings/advanced/tenants" replace />} />
          <Route path="/doctors" element={<Navigate to="/settings/team" replace />} />
          <Route path="/security" element={<Navigate to="/settings/security" replace />} />
          <Route path="/support" element={<Navigate to="/settings/practice" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider>
            <Router>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  {/* Public Guest Routes */}
                  <Route path="/login" element={<PublicRoute element={<Login />} />} />
                  <Route path="/register" element={<PublicRoute element={<Register />} />} />
                  <Route path="/forgot-password" element={<PublicRoute element={<ForgotPassword />} />} />
                  <Route path="/reset-password" element={<PublicRoute element={<ResetPassword />} />} />
                  <Route path="/verify-email" element={<PublicRoute element={<VerifyEmail />} />} />

                  {/* Fully public — no auth required, no redirect on login */}
                  <Route path="/invite/accept" element={<AcceptInvitation />} />
                  <Route path="/invite/review" element={<ReviewInvitation />} />

                  {/* Private Protected Routes */}
                  <Route path="/*" element={<AuthGuard element={<ProtectedLayout />} />} />
                </Routes>
              </Suspense>
            </Router>
          </AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
