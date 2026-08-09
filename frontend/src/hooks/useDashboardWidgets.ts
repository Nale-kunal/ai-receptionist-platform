import { useState, useEffect, useCallback, useRef } from 'react';
import { type ApiAppointment, type ApiDoctor, type ApiPatient } from '../services/api';
import { requestCoordinator } from '../services/DashboardRequestCoordinator';
import { circuitBreaker } from '../services/DashboardCircuitBreaker';
import { telemetry } from '../services/telemetry';

export interface WidgetState<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useKpiMetrics(): WidgetState<{
  todayApptsCount: number;
  todayCallsCount: number;
  missedCallsCount: number;
  pendingConfirmationsCount: number;
}> {
  const [data, setData] = useState({
    todayApptsCount: 0,
    todayCallsCount: 0,
    missedCallsCount: 0,
    pendingConfirmationsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      // Use the dedicated /dashboard/kpi endpoint — server queries DB with proper
      // today boundaries (midnight UTC). No client-side timezone-sensitive filtering.
      const kpiData = await circuitBreaker.execute(async () =>
        requestCoordinator.fetchWidgetData<any>(
          'dashboard_kpi',
          '/dashboard/kpi',
          { signal: abortRef.current?.signal, cacheTtlMs: 15000 }
        )
      );

      setData({
        todayApptsCount:            kpiData?.todayApptsCount            ?? 0,
        todayCallsCount:            kpiData?.todayCallsCount            ?? 0,
        missedCallsCount:           kpiData?.missedCallsCount           ?? 0,
        pendingConfirmationsCount:  kpiData?.pendingConfirmationsCount  ?? 0,
      });
      setError(null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.warn('[KpiMetricsWidget] Fetch error:', err);
      setError('Unable to load KPI metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    // 30-second polling keeps metrics fresh without over-hammering the API
    const timer = setInterval(fetchMetrics, 30000);
    return () => {
      clearInterval(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchMetrics]);

  return { data, loading, error, refetch: fetchMetrics };
}

export function useUpcomingAppointments(): WidgetState<{
  appointments: ApiAppointment[];
  doctors: ApiDoctor[];
  patients: ApiPatient[];
}> {
  const [data, setData] = useState<{
    appointments: ApiAppointment[];
    doctors: ApiDoctor[];
    patients: ApiPatient[];
  }>({
    appointments: [],
    doctors: [],
    patients: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchAppointments = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const summary = await circuitBreaker.execute(async () => {
        return requestCoordinator.fetchWidgetData<any>(
          'dashboard_summary',
          '/dashboard/summary',
          { signal: abortRef.current?.signal }
        );
      });

      setData({
        appointments: Array.isArray(summary?.appointments) ? summary.appointments : [],
        doctors: Array.isArray(summary?.doctors) ? summary.doctors : [],
        patients: Array.isArray(summary?.patients) ? summary.patients : [],
      });
      setError(null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.warn('[CalendarOverviewWidget] Fetch error:', err);
      setError('Unable to load schedule data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    const timer = setInterval(fetchAppointments, 30000);
    return () => {
      clearInterval(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchAppointments]);

  return { data, loading, error, refetch: fetchAppointments };
}

export function useRecentConversations(): WidgetState<any[]> {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchConversations = useCallback(async () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const summary = await circuitBreaker.execute(async () => {
        return requestCoordinator.fetchWidgetData<any>(
          'dashboard_summary',
          '/dashboard/summary',
          { signal: abortRef.current?.signal }
        );
      });

      const conversations = Array.isArray(summary?.conversations) ? summary.conversations : [];
      setData(conversations.slice(0, 5));
      setError(null);
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.warn('[RecentCallsWidget] Fetch error:', err);
      setError('Unable to load recent calls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const timer = setInterval(fetchConversations, 30000);
    return () => {
      clearInterval(timer);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchConversations]);

  return { data, loading, error, refetch: fetchConversations };
}
