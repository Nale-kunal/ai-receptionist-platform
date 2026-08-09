import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks';
import { AppSplashScreen } from '../components/ui/AppSplashScreen';

interface PublicRouteProps {
  element: React.ReactElement;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ element }) => {
  const { user, authState } = useAuth();
  const location = useLocation();

  // While Auth Bootstrap state is INITIALIZING, render App Splash Screen ONLY
  if (authState === 'initializing' || authState === 'unknown') {
    return <AppSplashScreen />;
  }

  // If user is already authenticated, redirect to redirect target or dashboard
  if (user || authState === 'authenticated') {
    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');
    const storedInviteRedirect = sessionStorage.getItem('pending_invite_redirect');
    const targetPath = redirectParam || storedInviteRedirect || '/';
    sessionStorage.removeItem('pending_invite_redirect');
    return <Navigate to={targetPath} replace />;
  }

  // Render guest page (Login, Register, etc.) only when authState == unauthenticated
  return element;
};
