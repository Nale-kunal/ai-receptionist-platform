/**
 * Enterprise Frontend Dashboard — Production API Service Client
 */

import { axiosClient } from './axiosClient';
import { appointmentCoordinator } from './AppointmentRequestCoordinator';
import { requestCoordinator } from './DashboardRequestCoordinator';
import { availabilityBus } from './availabilityBus';

export interface ApiAppointment {
  id: string;
  patientId?: string;
  doctorId?: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'scheduled' | 'rescheduled' | 'cancelled' | 'completed' | 'pending' | 'confirmed' | 'checked_in' | 'in_progress' | 'no_show';
  appointmentType?: string;
  durationMinutes?: number;
}

export interface ApiPatient {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  mrn?: string;
  phone: string;
  email: string;
  dob: string;
  gender?: string;
  medicalHistory?: string[];
  notes?: string;
  address?: string;
  lastVisit?: string;
  nextAppointment?: string;
  totalVisits?: number;
  status?: string;
}

export interface ApiDoctor {
  id: string;
  name: string;
  specialty: string;
  workingHours: any;
  formattedHours?: string;
  availability: 'available' | 'busy' | 'vacation' | 'off';
  email?: string;
  phone?: string;
}

export interface ApiPromptVersion {
  id: string;
  version: number;
  content: string;
  status: 'published' | 'draft' | 'archived';
  author: string;
  createdAt: string;
}

export interface ApiAuditLog {
  timestamp: string;
  actor: string;
  module: string;
  action: string;
  result: string;
  correlationId: string;
}

// --------------------------------------------------------------------------
// Ultra-Fast In-Memory Response Caching & Request Deduplication
// --------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const apiCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 5000; // 5-second ultra-fast short-lived response cache

function getCachedData<T>(key: string): T | null {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  apiCache.delete(key);
  return null;
}

function setCachedData<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  apiCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) {
        apiCache.delete(key);
      }
    }
  }
  try {
    appointmentCoordinator.invalidateCache();
  } catch {}
  try {
    requestCoordinator.invalidateCache();
  } catch {}
  try {
    availabilityBus.notifyInvalidated();
  } catch {}
}

let lastKnownSummary: {
  appointments: ApiAppointment[];
  doctors: ApiDoctor[];
  patients: ApiPatient[];
  conversations: any[];
} | null = null;

export function parseAppointmentItem(a: any): ApiAppointment {
  let date = a.date;
  let time = a.time;
  if (a.startTime) {
    const start = new Date(a.startTime);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, '0');
    const d = String(start.getDate()).padStart(2, '0');
    date = `${y}-${m}-${d}`;
    const hh = String(start.getHours()).padStart(2, '0');
    const mm = String(start.getMinutes()).padStart(2, '0');
    time = `${hh}:${mm}`;
  }
  const pName = a.patientName || a.patient?.fullName || (a.patient?.firstName ? `${a.patient.firstName} ${a.patient.lastName || ''}`.trim() : '');
  const dName = a.doctorName || a.doctor?.fullName || a.doctor?.displayName;
  return {
    id: a.id,
    patientId: a.patientId,
    doctorId: a.doctorId,
    patientName: pName && pName.length > 0 ? pName : (a.patientPhone || a.patient?.phone ? `Patient (${a.patientPhone || a.patient?.phone})` : 'Patient'),
    patientPhone: a.patientPhone || a.patient?.phone || '',
    doctorName: dName && dName.length > 0 ? (dName.startsWith('Dr.') ? dName : `Dr. ${dName}`) : 'Unassigned',
    date: date || new Date().toISOString().split('T')[0],
    time: time || '09:00',
    status: a.status,
    appointmentType: a.appointmentType || 'checkup',
    durationMinutes: Number(a.durationMinutes) || 30,
  };
}

export const api = {
  // Consolidated Dashboard Summary API (Ultra-Fast <50ms payload)
  getDashboardSummary: async (): Promise<{
    appointments: ApiAppointment[];
    doctors: ApiDoctor[];
    patients: ApiPatient[];
    conversations: any[];
  }> => {
    const cacheKey = 'getDashboardSummary';
    const cached = getCachedData<any>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await axiosClient.get('/dashboard/summary');
        if (res.status === 304 && lastKnownSummary) {
          setCachedData(cacheKey, lastKnownSummary, 10000);
          return lastKnownSummary;
        }

        const data = res.data?.data || res.data || {};
        const rawAppts = Array.isArray(data.appointments) ? data.appointments : (lastKnownSummary?.appointments || []);
        const summary = {
          appointments: rawAppts.map(parseAppointmentItem),
          doctors: Array.isArray(data.doctors) ? data.doctors : (lastKnownSummary?.doctors || []),
          patients: Array.isArray(data.patients) ? data.patients : (lastKnownSummary?.patients || []),
          conversations: Array.isArray(data.conversations) ? data.conversations : (lastKnownSummary?.conversations || []),
        };

        if (summary.appointments.length > 0 || summary.doctors.length > 0 || summary.patients.length > 0) {
          lastKnownSummary = summary;
        }
        setCachedData(cacheKey, summary, 10000);
        return summary;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  // Appointments CRUD
  getAppointments: async (): Promise<ApiAppointment[]> => {
    const cacheKey = 'getAppointments';
    const cached = getCachedData<ApiAppointment[]>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await axiosClient.get('/appointments');
        const rawData = res.data?.data;
        const list: any[] = Array.isArray(rawData?.appointments)
          ? rawData.appointments
          : Array.isArray(rawData)
          ? rawData
          : Array.isArray(res.data?.appointments)
          ? res.data.appointments
          : Array.isArray(res.data)
          ? res.data
          : [];

        const mapped = list.map(parseAppointmentItem);

        setCachedData(cacheKey, mapped);
        return mapped;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  getAvailability: async (params: {
    doctorId: string;
    date: string;
    durationMinutes?: number;
    appointmentType?: string;
    excludeAppointmentId?: string;
    excludeUnavailable?: boolean;
    stepMinutes?: number;
    bufferMinutes?: number;
    timezone?: string;
  }): Promise<any> => {
    try {
      const clientTz = params.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
      const queryParams = { ...params, timezone: clientTz };
      const res = await axiosClient.get('/calendar/availability', { params: queryParams });
      return res.data?.data || res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const clientTz = params.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');
        const queryParams = { ...params, timezone: clientTz };
        const fallback = await axiosClient.get('/calendars/availability', { params: queryParams });
        return fallback.data?.data || fallback.data;
      }
      throw err;
    }
  },

  searchPatients: async (query: string): Promise<ApiPatient[]> => {
    const res = await axiosClient.get('/patients/search', { params: { q: query } });
    const list = res.data?.data?.patients || res.data?.data || [];
    return list.map((p: any) => ({
      id: p.id,
      name: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      firstName: p.firstName,
      lastName: p.lastName,
      mrn: p.mrn,
      phone: p.phone,
      email: p.email || '',
      dob: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
      gender: p.gender || '',
      status: p.status,
    }));
  },

  createAppointment: async (apt: Omit<ApiAppointment, 'id'> & { doctorId?: string; patientId?: string }): Promise<ApiAppointment> => {
    invalidateApiCache('getAppointments');

    let doctorId = apt.doctorId;
    let patientId = apt.patientId;

    if (!doctorId || !patientId) {
      // Resolve Doctor and Patient in parallel only if IDs are missing
      const [doctorsRes, patientsRes] = await Promise.all([
        axiosClient.get('/doctors'),
        axiosClient.get('/patients'),
      ]);

      if (!doctorId) {
        const doctorsList: any[] = Array.isArray(doctorsRes.data?.data?.doctors)
          ? doctorsRes.data.data.doctors
          : Array.isArray(doctorsRes.data?.data)
          ? doctorsRes.data.data
          : Array.isArray(doctorsRes.data?.doctors)
          ? doctorsRes.data.doctors
          : [];
        let doctor = doctorsList.find((d: any) =>
          d.fullName?.toLowerCase().includes(apt.doctorName.toLowerCase()) ||
          d.displayName?.toLowerCase().includes(apt.doctorName.toLowerCase())
        );
        if (!doctor) {
          const newDocRes = await axiosClient.post('/doctors', {
            fullName: apt.doctorName,
            displayName: apt.doctorName,
            specialization: 'General Dentistry',
            status: 'active',
            workingHours: [],
            leaves: [],
          });
          doctor = newDocRes.data?.data?.doctor || newDocRes.data?.data || newDocRes.data;
        }
        doctorId = doctor.id;
      }

      if (!patientId) {
        const patientsList: any[] = Array.isArray(patientsRes.data?.data?.patients)
          ? patientsRes.data.data.patients
          : Array.isArray(patientsRes.data?.data)
          ? patientsRes.data.data
          : Array.isArray(patientsRes.data?.patients)
          ? patientsRes.data.patients
          : [];
        let patient = patientsList.find((p: any) => p.phone === apt.patientPhone);
        if (!patient) {
          const newPatRes = await axiosClient.post('/patients', {
            fullName: apt.patientName,
            phone: apt.patientPhone,
            email: '',
            status: 'active',
          });
          patient = newPatRes.data?.data?.patient || newPatRes.data?.data || newPatRes.data;
        }
        patientId = patient.id;
      }
    }

    // Convert date & time to UTC ISO strings
    const duration = (apt as any).durationMinutes || 30;
    const startTime = new Date(`${apt.date}T${apt.time}:00`);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const payload: any = {
      doctorId,
      patientId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      timezone: 'UTC',
      status: 'scheduled',
      source: 'dashboard',
      appointmentType: (apt as any).appointmentType || 'checkup',
      durationMinutes: duration,
    };
    const res = await axiosClient.post('/appointments', payload);

    const created = res.data?.data?.appointment || res.data?.data || res.data;
    return {
      id: created.id,
      patientName: apt.patientName,
      patientPhone: apt.patientPhone,
      doctorName: apt.doctorName,
      date: apt.date,
      time: apt.time,
      status: 'scheduled',
    };
  },

  confirmAppointment: async (id: string): Promise<any> => {
    invalidateApiCache('getAppointments');
    const res = await axiosClient.post(`/appointments/${id}/confirm`);
    return res.data?.data?.appointment || res.data?.data || res.data;
  },

  cancelAppointment: async (id: string, cancellationReason?: string): Promise<any> => {
    invalidateApiCache('getAppointments');
    const res = await axiosClient.post(`/appointments/${id}/cancel`, { cancellationReason: cancellationReason || undefined });
    return res.data?.data?.appointment || res.data?.data || res.data;
  },

  rescheduleAppointment: async (id: string, date: string, time: string, durationMinutes = 30): Promise<any> => {
    if (!date || !time) {
      throw new Error('Please select a valid date and available time slot.');
    }
    const startTime = new Date(`${date}T${time}:00`);
    if (isNaN(startTime.getTime())) {
      throw new Error('Invalid appointment date or time selected.');
    }
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
    invalidateApiCache('getAppointments');
    invalidateApiCache('getDashboardSummary');
    const res = await axiosClient.post(`/appointments/${id}/reschedule`, {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes,
      timezone: 'UTC',
    });
    return res.data?.data?.appointment || res.data?.data || res.data;
  },

  completeAppointment: async (id: string): Promise<any> => {
    invalidateApiCache('getAppointments');
    const res = await axiosClient.post(`/appointments/${id}/complete`);
    return res.data?.data?.appointment || res.data?.data || res.data;
  },

  updateAppointment: async (id: string, updates: Partial<ApiAppointment> & { cancellationReason?: string; notes?: string }): Promise<ApiAppointment> => {
    let res: any;
    if (updates.status === 'cancelled') {
      res = await axiosClient.post(`/appointments/${id}/cancel`, {
        cancellationReason: updates.cancellationReason || null
      });
    } else if (updates.status === 'confirmed' || updates.status === 'scheduled') {
      res = await axiosClient.post(`/appointments/${id}/confirm`);
    } else if (updates.date && updates.time) {
      const startTime = new Date(`${updates.date}T${updates.time}:00`);
      const endTime = new Date(startTime.getTime() + 30 * 60000);
      res = await axiosClient.post(`/appointments/${id}/reschedule`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        notes: updates.notes || undefined
      });
    } else {
      res = await axiosClient.patch(`/appointments/${id}`, {
        notes: updates.notes
      });
    }
    const updated = res.data?.data?.appointment || res.data?.appointment || res.data?.data || res.data;
    const start = new Date(updated.startTime);
    return {
      id: updated.id,
      patientId: updated.patientId,
      doctorId: updated.doctorId,
      patientName: updated.patient?.fullName || '',
      patientPhone: updated.patient?.phone || '',
      doctorName: updated.doctor?.fullName || '',
      date: start.toISOString().split('T')[0],
      time: start.toTimeString().split(' ')[0].substring(0, 5),
      status: updated.status,
    };
  },

  // Patients CRUD
  getPatients: async (): Promise<ApiPatient[]> => {
    const cacheKey = 'getPatients';
    const cached = getCachedData<ApiPatient[]>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await axiosClient.get('/patients');
        const rawData = res.data?.data;
        const list: any[] = Array.isArray(rawData?.patients)
          ? rawData.patients
          : Array.isArray(rawData)
          ? rawData
          : Array.isArray(res.data?.patients)
          ? res.data.patients
          : Array.isArray(res.data)
          ? res.data
          : [];

        const mapped = list.map((p: any) => ({
          id: p.id,
          name: p.fullName,
          phone: p.phone,
          email: p.email || '',
          dob: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
          lastVisit: p.lastVisit ? p.lastVisit.split('T')[0] : undefined,
        }));
        setCachedData(cacheKey, mapped);
        return mapped;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  createPatient: async (
    pat: Omit<ApiPatient, 'id'> & { clinicId?: string },
    options?: { allowExisting?: boolean; allowEmailSharing?: boolean }
  ): Promise<ApiPatient> => {
    invalidateApiCache('getPatients');
    const parts = (pat.name || '').trim().split(' ');
    const firstName = parts[0] || 'Unknown';
    const lastName = parts.slice(1).join(' ') || 'Patient';
    const payload: any = {
      fullName: pat.name ? pat.name.trim() : `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      phone: pat.phone,
      email: pat.email || null,
      dateOfBirth: pat.dob ? pat.dob.split('T')[0] : null,
      status: 'active',
    };
    if (options?.allowExisting) payload.allowExisting = true;
    if (options?.allowEmailSharing) payload.allowEmailSharing = true;
    if (pat.clinicId) payload.clinicId = pat.clinicId;

    const res = await axiosClient.post('/patients', payload);
    const p = res.data?.data?.patient || res.data?.data || res.data;
    return {
      id: p.id,
      name: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
      phone: p.phone,
      email: p.email || '',
      dob: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
      lastVisit: undefined,
    };
  },

  updatePatient: async (
    id: string,
    updates: Partial<ApiPatient>,
    options?: { allowEmailSharing?: boolean }
  ): Promise<ApiPatient> => {
    invalidateApiCache('getPatients');
    const payload: any = {};
    if (updates.name) payload.fullName = updates.name;
    if (updates.phone) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email || null;
    if (updates.dob) payload.dateOfBirth = new Date(updates.dob).toISOString();
    if (options?.allowEmailSharing) payload.allowEmailSharing = true;

    const res = await axiosClient.patch(`/patients/${id}`, payload);
    const p = res.data?.data?.patient || res.data?.data || res.data;
    return {
      id: p.id,
      name: p.fullName,
      phone: p.phone,
      email: p.email || '',
      dob: p.dateOfBirth ? p.dateOfBirth.split('T')[0] : '',
      lastVisit: undefined,
    };
  },

  // Doctors CRUD
  getDoctors: async (): Promise<ApiDoctor[]> => {
    const cacheKey = 'getDoctors';
    const cached = getCachedData<ApiDoctor[]>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await axiosClient.get('/doctors');
        const rawData = res.data?.data;
        const list: any[] = Array.isArray(rawData?.doctors)
          ? rawData.doctors
          : Array.isArray(rawData)
          ? rawData
          : Array.isArray(res.data?.doctors)
          ? res.data.doctors
          : Array.isArray(res.data)
          ? res.data
          : [];

        const mapped = list.map((d: any) => {
          let rawHours = d.workingHours;
          if (typeof rawHours === 'string') {
            try { rawHours = JSON.parse(rawHours); } catch { rawHours = []; }
          }

          let formatted = '09:00 - 17:00';
          if (Array.isArray(rawHours) && rawHours.length > 0) {
            const activeDay = rawHours.find((h: any) => h && !h.isClosed);
            if (activeDay) {
              const open = activeDay.openTime || activeDay.startTime || activeDay.start || '09:00';
              const close = activeDay.closeTime || activeDay.endTime || activeDay.end || '17:00';
              formatted = `${open} - ${close}`;
            }
          }

          return {
            id: d.id,
            name: d.fullName,
            specialty: d.specialization,
            workingHours: Array.isArray(rawHours) ? rawHours : [],
            formattedHours: formatted,
            availability: (d.status === 'active' ? 'available' : d.status === 'busy' ? 'busy' : 'vacation') as 'available' | 'busy' | 'vacation',
          };
        });
        setCachedData(cacheKey, mapped);
        return mapped;
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  updateDoctor: async (id: string, updates: Partial<ApiDoctor>): Promise<ApiDoctor> => {
    const payload: any = {};
    if (updates.availability) {
      payload.status = updates.availability === 'available' ? 'active' : updates.availability;
    }
    const res = await axiosClient.patch(`/doctors/${id}`, payload);
    const d = res.data?.data?.doctor || res.data?.data || res.data;
    return {
      id: d.id,
      name: d.fullName,
      specialty: d.specialization,
      workingHours: d.workingHours || [],
      availability: d.status === 'active' ? 'available' : d.status === 'busy' ? 'busy' : 'vacation',
    };
  },

  updateDoctorWorkingHours: async (id: string, workingHours: any[]): Promise<any> => {
    invalidateApiCache('getDoctors');
    const normalized = (Array.isArray(workingHours) ? workingHours : []).map((h: any) => {
      const openTime = h.openTime || h.startTime || h.start || '09:00';
      const closeTime = h.closeTime || h.endTime || h.end || '17:00';
      return {
        dayOfWeek: typeof h.dayOfWeek === 'number' ? h.dayOfWeek : 0,
        openTime,
        closeTime,
        startTime: openTime,
        endTime: closeTime,
        isClosed: Boolean(h.isClosed),
      };
    });
    const res = await axiosClient.put(`/doctors/${id}/working-hours`, { workingHours: normalized });
    return res.data?.data || res.data;
  },

  // Prompt Engine Console
  getPrompts: async (): Promise<ApiPromptVersion[]> => {
    const res = await axiosClient.get('/prompts/prompts');
    const rawData = res.data?.data;
    const list: any[] = Array.isArray(rawData?.prompts)
      ? rawData.prompts
      : Array.isArray(rawData)
      ? rawData
      : Array.isArray(res.data?.prompts)
      ? res.data.prompts
      : [];

    return list.map((p: any) => ({
      id: p.id,
      version: p.version || 1,
      content: p.content,
      status: p.status || 'draft',
      author: p.authorId || 'system',
      createdAt: p.createdAt || new Date().toISOString(),
    }));
  },

  createPromptVersion: async (content: string): Promise<ApiPromptVersion> => {
    const clinicsRes = await axiosClient.get('/clinics');
    const clinics = clinicsRes.data.data || clinicsRes.data || [];
    const clinicId = clinics.length > 0 ? clinics[0].id : undefined;

    const res = await axiosClient.post('/prompts/prompts', {
      content,
      promptType: 'voice_receptionist',
      variables: {},
      clinicId,
      changeSummary: 'New prompt draft from console',
    });
    const p = res.data.data?.prompt || res.data.prompt || res.data;
    return {
      id: p.id,
      version: p.version || 1,
      content: p.content,
      status: p.status || 'draft',
      author: p.authorId || 'system',
      createdAt: p.createdAt || new Date().toISOString(),
    };
  },

  publishPromptVersion: async (id: string): Promise<void> => {
    await axiosClient.post(`/prompts/prompts/${id}/publish`);
  },

  // Active AI Config Mapped to Multitenant Settings
  getAiConfig: async (): Promise<any> => {
    const res = await axiosClient.get('/configurations');
    const config = res.data.data?.configuration || res.data.data || res.data;
    return {
      model: config?.ai?.model || 'gpt-4o-realtime',
      voice: config?.ai?.voice || 'alloy',
      temperature: config?.ai?.temperature ?? 0.6,
      maxDurationMs: config?.ai?.maxDurationMs ?? 900000,
      inactivityTimeoutMs: config?.ai?.inactivityTimeoutMs ?? 30000,
      interruptionThresholdDb: config?.ai?.interruptionThresholdDb ?? -45,
      greeting: config?.ai?.greeting || 'Hello! Thank you for calling our dental office. How can I assist you today?',
      tone: config?.ai?.tone || 'Professional',
      bookingRules: config?.ai?.bookingRules || 'Only schedule appointments inside available slot periods.',
      cancellationRules: config?.ai?.cancellationRules || 'Cancellations should be requested at least 24 hours in advance.',
      emergencyRules: config?.ai?.emergencyRules || 'If a medical emergency is declared, advise the caller to hang up and dial 911.',
      transferRules: config?.ai?.transferRules || 'Transfer complex billing calls or angry patients to the clinic staff.',
      businessHoursRules: config?.ai?.businessHoursRules || 'Monday to Friday: 9:00 AM - 5:00 PM.',
    };
  },

  updateAiConfig: async (updates: any): Promise<any> => {
    const promptString = `Greeting: ${updates.greeting}\nTone: ${updates.tone}\nBusiness Hours: ${updates.businessHoursRules}\nBooking: ${updates.bookingRules}\nCancellation: ${updates.cancellationRules}\nEmergency: ${updates.emergencyRules}\nTransfer: ${updates.transferRules}`;
    const payload = {
      ai: {
        model: updates.model,
        voice: updates.voice,
        temperature: Number(updates.temperature),
        maxDurationMs: Number(updates.maxDurationMs),
        inactivityTimeoutMs: Number(updates.inactivityTimeoutMs),
        interruptionThresholdDb: Number(updates.interruptionThresholdDb),
        greeting: updates.greeting,
        tone: updates.tone,
        bookingRules: updates.bookingRules,
        cancellationRules: updates.cancellationRules,
        emergencyRules: updates.emergencyRules,
        transferRules: updates.transferRules,
        businessHoursRules: updates.businessHoursRules,
        promptAssignment: promptString,
        provider: 'openai',
      },
      voice: {
        voiceModel: updates.model,
        greeting: updates.greeting,
        prompt: promptString,
        language: 'en',
      }
    };
    const res = await axiosClient.patch('/configurations', payload);
    const config = res.data.data?.configuration || res.data.data || res.data;
    return {
      model: config?.ai?.model || 'gpt-4o-realtime',
      voice: config?.ai?.voice || 'alloy',
      temperature: config?.ai?.temperature ?? 0.6,
      maxDurationMs: config?.ai?.maxDurationMs ?? 900000,
      inactivityTimeoutMs: config?.ai?.inactivityTimeoutMs ?? 30000,
      interruptionThresholdDb: config?.ai?.interruptionThresholdDb ?? -45,
      greeting: config?.ai?.greeting || '',
      tone: config?.ai?.tone || '',
      bookingRules: config?.ai?.bookingRules || '',
      cancellationRules: config?.ai?.cancellationRules || '',
      emergencyRules: config?.ai?.emergencyRules || '',
      transferRules: config?.ai?.transferRules || '',
      businessHoursRules: config?.ai?.businessHoursRules || '',
    };
  },

  // Multitenant Notification Settings
  getNotificationRules: async (): Promise<any> => {
    const res = await axiosClient.get('/configurations');
    const config = res.data.data?.configuration || res.data.data || res.data;
    return {
      smsEnabled: config?.notification?.smsEnabled ?? true,
      emailEnabled: config?.notification?.emailEnabled ?? true,
      timeBeforeHours: config?.notification?.timeBeforeHours ?? 24,
      smsTemplate: config?.notification?.smsTemplate || 'Hi {{patientName}}, this is a reminder for your appointment on {{date}} at {{time}}.',
    };
  },

  updateNotificationRules: async (updates: any): Promise<any> => {
    const res = await axiosClient.patch('/configurations', {
      notification: updates
    });
    const config = res.data.data?.configuration || res.data.data || res.data;
    return {
      smsEnabled: config?.notification?.smsEnabled ?? true,
      emailEnabled: config?.notification?.emailEnabled ?? true,
      timeBeforeHours: config?.notification?.timeBeforeHours ?? 24,
      smsTemplate: config?.notification?.smsTemplate || 'Hi {{patientName}}, this is a reminder for your appointment on {{date}} at {{time}}.',
    };
  },

  // Clinic Settings Mapped to Multitenant Configuration Business Settings
  getClinicSettings: async (): Promise<any> => {
    const res = await axiosClient.get('/configurations');
    const config = res.data.data?.configuration || res.data.data || res.data;
    const biz = config?.business || {};

    // --- Convert businessHoursSchedule (backend dayOfWeek format) → detailedSchedule (UI day-name format) ---
    const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const canonicalHours: any[] = Array.isArray(biz.businessHoursSchedule)
      ? biz.businessHoursSchedule
      : Array.isArray(biz.businessHours) && (biz.businessHours as any[]).every((h: any) => typeof h === 'object')
      ? biz.businessHours
      : [];

    let detailedSchedule: any[];
    let workingDays: string[];

    if (canonicalHours.length > 0) {
      detailedSchedule = DAY_NAMES.map((dayName, idx) => {
        const found = canonicalHours.find((h: any) => h.dayOfWeek === idx);
        return {
          day: dayName,
          startTime: found?.openTime || found?.startTime || '09:00',
          endTime: found?.closeTime || found?.endTime || '17:00',
          isClosed: found ? Boolean(found.isClosed) : (idx === 0 || idx === 6),
        };
      });
      workingDays = detailedSchedule.filter((d: any) => !d.isClosed).map((d: any) => d.day);
    } else if (Array.isArray(biz.detailedSchedule) && biz.detailedSchedule.length > 0) {
      // Use stored detailedSchedule as-is
      detailedSchedule = biz.detailedSchedule;
      workingDays = Array.isArray(biz.workingDays)
        ? biz.workingDays
        : detailedSchedule.filter((d: any) => !d.isClosed).map((d: any) => d.day);
    } else {
      // Default schedule: Mon–Fri open
      detailedSchedule = DAY_NAMES.map((dayName, idx) => ({
        day: dayName,
        startTime: '09:00',
        endTime: '17:00',
        isClosed: idx === 0 || idx === 6,
      }));
      workingDays = biz.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    }

    return {
      clinicName: biz.clinicName || config?.branding?.clinicName || 'Dental First Clinic',
      contactPhone: biz.contactPhone || '+1 (800) 555-0199',
      contactEmail: biz.contactEmail || 'office@dentalfirst.com',
      address: biz.address || '123 Care Ave, Suite 100',
      timezone: biz.timezone || config?.localization?.timezone || 'America/New_York',
      appointmentDuration: biz.appointmentDuration ?? 30,
      businessHours: biz.businessHoursLabel || biz.businessHours || '09:00 - 17:00',
      workingDays,
      detailedSchedule,
      holidaySchedule: biz.holidaySchedule || 'Closed on national holidays',
      aiGreeting: biz.aiGreeting || 'Hello, thank you for calling. How can I help you today?',
      bookingRules: biz.bookingRules || 'Standard scheduling only.',
      cancellationRules: biz.cancellationRules || '24-hour notice required.',
      voiceSelection: config?.ai?.voice || 'alloy',
    };
  },

  updateClinicSettings: async (updates: any): Promise<any> => {
    // --- Convert detailedSchedule (UI day-name format) → businessHoursSchedule (backend dayOfWeek format) ---
    const DAY_NAME_TO_NUM: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
    };

    const businessHoursSchedule = Array.isArray(updates.detailedSchedule)
      ? updates.detailedSchedule
          .filter((s: any) => s && typeof s.day === 'string' && DAY_NAME_TO_NUM[s.day] !== undefined)
          .map((s: any) => ({
            dayOfWeek: DAY_NAME_TO_NUM[s.day],
            openTime: s.startTime || '09:00',
            closeTime: s.endTime || '17:00',
            isClosed: Boolean(s.isClosed || !Array.isArray(updates.workingDays) || !updates.workingDays.includes(s.day)),
          }))
          .sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek)
      : [];

    const res = await axiosClient.patch('/configurations', {
      business: {
        clinicName: updates.clinicName,
        contactPhone: updates.contactPhone,
        contactEmail: updates.contactEmail,
        address: updates.address,
        timezone: updates.timezone,                    // kept inside business for round-trip reads
        appointmentDuration: updates.appointmentDuration ? Number(updates.appointmentDuration) : undefined,
        businessHoursLabel: updates.businessHours,     // display string preserved
        businessHoursSchedule,                         // structured canonical array for availability engine
        workingDays: updates.workingDays,
        detailedSchedule: updates.detailedSchedule,    // also store UI format for round-trip
        holidaySchedule: updates.holidaySchedule,
        aiGreeting: updates.aiGreeting,
        bookingRules: updates.bookingRules,
        cancellationRules: updates.cancellationRules,
      },
      // timezone MUST also be in localization for backend validation to pass
      ...(updates.timezone ? {
        localization: { timezone: updates.timezone },
      } : {}),
      ...(updates.voiceSelection ? { ai: { voice: updates.voiceSelection } } : {}),
    });

    const config = res.data.data?.configuration || res.data.data || res.data;
    const biz = config?.business || {};
    return {
      clinicName: biz.clinicName || '',
      contactPhone: biz.contactPhone || '',
      contactEmail: biz.contactEmail || '',
      address: biz.address || '',
      timezone: biz.timezone || '',
      appointmentDuration: biz.appointmentDuration || 30,
      businessHours: biz.businessHoursLabel || biz.businessHours || '',
      workingDays: biz.workingDays || [],
      detailedSchedule: biz.detailedSchedule || [],
      holidaySchedule: biz.holidaySchedule || '',
      aiGreeting: biz.aiGreeting || '',
      bookingRules: biz.bookingRules || '',
      cancellationRules: biz.cancellationRules || '',
      voiceSelection: config?.ai?.voice || 'alloy',
    };
  },

  // Knowledge Base FAQs CRUD
  getFAQs: async (): Promise<any[]> => {
    const res = await axiosClient.get('/faqs');
    const list = res.data.data || res.data || [];
    return list;
  },

  createFAQ: async (faq: { question: string; answer: string }): Promise<any> => {
    const res = await axiosClient.post('/faqs', faq);
    return res.data.data || res.data;
  },

  // Live Calls monitor
  getLiveCalls: async (): Promise<any[]> => {
    try {
      const res = await axiosClient.get('/conversations');
      const list = res.data.conversations || res.data.data || res.data || [];
      const active = list.filter((c: any) => c.status === 'initiated' || c.status === 'processing');
      return active.map((c: any) => {
        const textTurns = Array.isArray(c.transcript) ? c.transcript.map((t: any) => ({
          time: t.time || '00:00',
          speaker: t.speaker || 'AI Assistant',
          text: t.text || ''
        })) : [];
        return {
          sessionId: c.callSessionId || c.id,
          callerNumber: c.callerPhone || 'Unknown',
          calledNumber: c.calledPhone || '',
          duration: c.durationSeconds ? `${Math.floor(c.durationSeconds/60)}:${c.durationSeconds%60}` : '01:23',
          status: c.status.toUpperCase(),
          speaker: 'AI Assistant',
          promptVersion: 3,
          transcript: textTurns
        };
      });
    } catch {
      return [];
    }
  },

  // Historical and active conversations list
  getConversations: async (params?: any): Promise<any[]> => {
    const res = await axiosClient.get('/conversations', { params });
    return res.data.conversations || res.data.data?.conversations || res.data.data || res.data || [];
  },

  // System Audit Logs
  getAuditLogs: async (): Promise<ApiAuditLog[]> => {
    const cacheKey = 'getAuditLogs';
    const cached = getCachedData<ApiAuditLog[]>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await axiosClient.get('/ai-engine/audit-logs');
        const list = res.data.auditLogs || res.data.data || res.data || [];
        const mapped = list.map((l: any) => ({
          timestamp: l.occurredAt || l.createdAt || new Date().toISOString(),
          actor: l.actorId || 'system-ai',
          module: l.resource || 'ai-engine',
          action: l.eventType || 'ACCESS',
          result: l.outcome === 'granted' || l.outcome === 'success' ? 'SUCCESS' : 'FAILURE',
          correlationId: l.requestId || 'corr_unknown',
        }));
        setCachedData(cacheKey, mapped);
        return mapped;
      } catch {
        return [];
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    })();

    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  },

  // System Database health checks via readiness
  getSystemHealth: async (): Promise<any> => {
    try {
      const start = Date.now();
      const res = await axiosClient.get('/ready');
      const latency = Date.now() - start;
      const data = res.data;
      return {
        backend: 'healthy',
        voiceServer: 'healthy',
        openai: 'healthy',
        twilio: 'healthy',
        database: data.database === 'connected' ? 'healthy' : 'unhealthy',
        latency: latency,
      };
    } catch {
      return {
        backend: 'unhealthy',
        voiceServer: 'unhealthy',
        openai: 'unhealthy',
        twilio: 'unhealthy',
        database: 'unhealthy',
        latency: 0,
      };
    }
  },

  // Users & RBAC Management
  getUsers: async (params?: { page?: number; limit?: number }): Promise<any[]> => {
    const res = await axiosClient.get('/users', { params });
    const list = res.data.data?.users || res.data.users || res.data.data || res.data || [];
    return list.map((u: any) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      role: u.role,
      status: u.status || 'active',
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    }));
  },

  updateUserRole: async (userId: string, role: string): Promise<any> => {
    const res = await axiosClient.put(`/users/${userId}`, { role });
    return res.data.data || res.data;
  },

  suspendUser: async (userId: string): Promise<any> => {
    const res = await axiosClient.post(`/users/${userId}/suspend`);
    return res.data.data || res.data;
  },

  reactivateUser: async (userId: string): Promise<any> => {
    const res = await axiosClient.post(`/users/${userId}/reactivate`);
    return res.data.data || res.data;
  },

  forceLogoutUser: async (userId: string): Promise<any> => {
    const res = await axiosClient.post(`/users/${userId}/force-logout`);
    return res.data.data || res.data;
  },

  transferOwnership: async (targetUserId: string): Promise<any> => {
    const res = await axiosClient.post('/users/transfer-ownership', { targetUserId });
    return res.data.data || res.data;
  },

  deleteUser: async (userId: string): Promise<any> => {
    const res = await axiosClient.delete(`/users/${userId}`);
    return res.data.data || res.data;
  },

  // Invitation Management
  getInvitations: async (params?: { page?: number; limit?: number; status?: string }): Promise<any[]> => {
    const res = await axiosClient.get('/invitations', { params });
    return res.data.data?.invitations || res.data.data || res.data || [];
  },

  getInvitationStats: async (): Promise<any> => {
    const res = await axiosClient.get('/invitations/stats');
    return res.data.data || res.data;
  },

  createInvitation: async (email: string, roleName: string): Promise<any> => {
    const res = await axiosClient.post('/invitations', { email, roleName });
    return res.data.data || res.data;
  },

  resendInvitation: async (invitationId: string): Promise<any> => {
    const res = await axiosClient.post(`/invitations/${invitationId}/resend`);
    return res.data.data || res.data;
  },

  revokeInvitation: async (invitationId: string): Promise<any> => {
    const res = await axiosClient.delete(`/invitations/${invitationId}`);
    return res.data.data || res.data;
  },

  validateInvitationToken: async (token: string): Promise<any> => {
    const res = await axiosClient.get('/invitations/validate', { params: { token } });
    return res.data.data || res.data;
  },

  acceptInvitation: async (payload: { token: string; password?: string; firstName?: string; lastName?: string }): Promise<any> => {
    const res = await axiosClient.post('/invitations/accept', payload);
    return res.data.data || res.data;
  },

  declineInvitation: async (token: string): Promise<any> => {
    const res = await axiosClient.post('/invitations/decline', { token });
    return res.data.data || res.data;
  },

  inviteUser: async (email: string, role: string): Promise<any> => {
    return api.createInvitation(email, role);
  }
};

export type ApiClient = typeof api;
