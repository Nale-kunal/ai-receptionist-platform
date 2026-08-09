import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/hooks';
import { telemetry } from '../services/telemetry';

export type DashboardState =
  | 'Idle'
  | 'Authenticating'
  | 'LoadingShell'
  | 'LoadingWidgets'
  | 'FullyLoaded'
  | 'PartialSuccess'
  | 'Refreshing'
  | 'Offline'
  | 'Recovering';

export interface DashboardStateMachineHook {
  state: DashboardState;
  isOnline: boolean;
  setWidgetStatus: (widgetId: string, status: 'loading' | 'success' | 'error') => void;
  triggerRefresh: () => void;
  retryFailedWidgets: () => void;
}

export function useDashboardStateMachine(): DashboardStateMachineHook {
  const { authState } = useAuth();
  const [state, setState] = useState<DashboardState>('Idle');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [widgetStatuses, setWidgetStatuses] = useState<Record<string, 'loading' | 'success' | 'error'>>({});

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setState((prev) => (prev === 'Offline' ? 'Recovering' : prev));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setState('Offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with Auth State Machine
  useEffect(() => {
    if (authState === 'initializing') {
      setState('Authenticating');
    } else if (authState === 'authenticated') {
      setState((prev) => (prev === 'Authenticating' || prev === 'Idle' ? 'LoadingShell' : prev));
    }
  }, [authState]);

  // Transition from LoadingShell to LoadingWidgets
  useEffect(() => {
    if (state === 'LoadingShell') {
      const timer = setTimeout(() => {
        setState('LoadingWidgets');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // Evaluate Widget Aggregate Statuses
  useEffect(() => {
    if (state !== 'LoadingWidgets' && state !== 'Refreshing' && state !== 'Recovering') {
      return;
    }

    const statuses = Object.values(widgetStatuses);
    if (statuses.length === 0) return;

    const hasError = statuses.some((s) => s === 'error');
    const isLoading = statuses.some((s) => s === 'loading');

    if (isLoading) return;

    if (hasError) {
      setState('PartialSuccess');
    } else {
      setState('FullyLoaded');
      telemetry.track('page_viewed', {
        module: 'dashboard',
        action: 'dashboard_fully_loaded',
        result: 'success',
      });
    }
  }, [widgetStatuses, state]);

  const setWidgetStatus = useCallback((widgetId: string, status: 'loading' | 'success' | 'error') => {
    setWidgetStatuses((prev) => {
      if (prev[widgetId] === status) return prev;
      return { ...prev, [widgetId]: status };
    });
  }, []);

  const triggerRefresh = useCallback(() => {
    setState('Refreshing');
  }, []);

  const retryFailedWidgets = useCallback(() => {
    setState('Recovering');
  }, []);

  return {
    state,
    isOnline,
    setWidgetStatus,
    triggerRefresh,
    retryFailedWidgets,
  };
}
