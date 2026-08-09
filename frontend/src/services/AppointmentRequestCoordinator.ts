import { axiosClient } from './axiosClient';
import { telemetry } from './telemetry';
import { parseAppointmentItem } from './api';

export interface AppointmentQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  doctorId?: string;
  patientId?: string;
  startFrom?: string;
  startTo?: string;
  signal?: AbortSignal;
}

export interface PaginatedAppointmentsResult {
  appointments: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class AppointmentRequestCoordinator {
  private static instance: AppointmentRequestCoordinator;
  private inFlightMap = new Map<string, Promise<any>>();
  private cacheMap = new Map<string, { data: any; expiresAt: number }>();

  private constructor() {}

  public static getInstance(): AppointmentRequestCoordinator {
    if (!AppointmentRequestCoordinator.instance) {
      AppointmentRequestCoordinator.instance = new AppointmentRequestCoordinator();
    }
    return AppointmentRequestCoordinator.instance;
  }

  public invalidateCache(): void {
    this.cacheMap.clear();
  }

  public invalidateTargetedCache(target: 'appointment' | 'patient' | 'doctor' | 'all' = 'all'): void {
    if (target === 'all') {
      this.cacheMap.clear();
      return;
    }

    for (const key of this.cacheMap.keys()) {
      if (target === 'appointment' && (key.startsWith('appointments_') || key.startsWith('appointment_status_counters'))) {
        this.cacheMap.delete(key);
      } else if (target === 'patient' && key.startsWith('patient_')) {
        this.cacheMap.delete(key);
      } else if (target === 'doctor' && key.startsWith('doctor_')) {
        this.cacheMap.delete(key);
      }
    }
  }

  public async fetchAppointments(
    options: AppointmentQueryOptions = {}
  ): Promise<PaginatedAppointmentsResult> {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = 'all',
      doctorId,
      patientId,
      startFrom,
      startTo,
      signal,
    } = options;

    const cacheKey = `appointments_${page}_${limit}_${search}_${status}_${doctorId || ''}_${patientId || ''}_${startFrom || ''}_${startTo || ''}`;
    const now = Date.now();

    const cached = this.cacheMap.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    if (this.inFlightMap.has(cacheKey)) {
      return this.inFlightMap.get(cacheKey)!;
    }

    const params: Record<string, any> = {
      page,
      limit,
      offset: (page - 1) * limit,
    };
    if (search && search.trim() !== '') params.search = search.trim();
    if (status && status !== 'all') params.status = status;
    if (doctorId && doctorId !== 'all') params.doctorId = doctorId;
    if (patientId) params.patientId = patientId;
    if (startFrom) params.startFrom = startFrom;
    if (startTo) params.startTo = startTo;

    const fetchPromise = (async (): Promise<PaginatedAppointmentsResult> => {
      try {
        const res = await axiosClient.get('/appointments', { params, signal });
        const rawData = res.data?.data || res.data || {};

        const list: any[] = Array.isArray(rawData.appointments)
          ? rawData.appointments
          : Array.isArray(rawData)
          ? rawData
          : [];

        const total = typeof rawData.total === 'number' ? rawData.total : list.length;
        const totalPages = Math.ceil(total / limit) || 1;

        const result: PaginatedAppointmentsResult = {
          appointments: list.map(parseAppointmentItem),
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
        };

        this.cacheMap.set(cacheKey, { data: result, expiresAt: Date.now() + 3000 });

        telemetry.track('widget_loaded', {
          module: 'appointment_coordinator',
          action: 'fetch_appointments',
          result: 'success',
        });

        return result;
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
        telemetry.track('widget_failed', {
          module: 'appointment_coordinator',
          action: 'fetch_appointments',
          result: 'failure',
          errorCode: err.code || err.name || 'FETCH_ERROR',
        });
        throw err;
      } finally {
        this.inFlightMap.delete(cacheKey);
      }
    })();

    this.inFlightMap.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  public async fetchStatusCounters(signal?: AbortSignal): Promise<Record<string, number>> {
    const cacheKey = 'appointment_status_counters';
    const cached = this.cacheMap.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const res = await axiosClient.get('/appointments/counters', { signal });
      const counters = res.data?.data || res.data || {};
      this.cacheMap.set(cacheKey, { data: counters, expiresAt: Date.now() + 5000 });
      return counters;
    } catch (err: any) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') throw err;
      return {
        total: 0,
        scheduled: 0,
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      };
    }
  }
}

export const appointmentCoordinator = AppointmentRequestCoordinator.getInstance();
