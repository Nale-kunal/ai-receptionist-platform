import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks';
import { AppSplashScreen } from '../components/ui/AppSplashScreen';
import { ClinicSuspendedScreen } from './AuthGuard';

interface PublicRouteProps {
  element: React.ReactElement;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ element }) => {
  const { user, authState, clinic, tenant, logout } = useAuth();
  const location = useLocation();

  // While Auth Bootstrap state is INITIALIZING, render App Splash Screen ONLY
  if (authState === 'initializing' || authState === 'unknown') {
    return <AppSplashScreen />;
  }

  // If clinic is suspended, render dedicated full-screen suspension screen immediately
  if (authState === 'suspended' || clinic?.status === 'suspended' || tenant?.status === 'suspended') {
    return <ClinicSuspendedScreen onLogout={logout} />;
  }

  const searchParams = new URLSearchParams(location.search);
  const isForceLogin = searchParams.get('force') === 'true' || searchParams.get('logout') === 'true';

  // If user is already authenticated and NOT forced to login, redirect to redirect target or dashboard
  if (!isForceLogin && (user || authState === 'authenticated')) {
    const redirectParam = searchParams.get('redirect');
    const storedInviteRedirect = sessionStorage.getItem('pending_invite_redirect');
    const targetPath = redirectParam || storedInviteRedirect || '/';
    sessionStorage.removeItem('pending_invite_redirect');
    return <Navigate to={targetPath} replace />;
  }

  // Render guest page (Login, Register, etc.)
  return element;
};
