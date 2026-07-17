/**
 * Enterprise Frontend Dashboard — API Service Client & Storage Interceptor
 */

export interface ApiAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';
}

export interface ApiPatient {
  id: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  lastVisit?: string;
}

export interface ApiDoctor {
  id: string;
  name: string;
  specialty: string;
  workingHours: string;
  availability: 'available' | 'busy' | 'vacation';
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

// ---------------------------------------------------------------------------
// Seed Mock Data in Local Storage if not present
// ---------------------------------------------------------------------------

const SEED_DATA = {
  appointments: [
    { id: 'apt_1', patientName: 'Alice Green', patientPhone: '+15550101', doctorName: 'Dr. Gregory House', date: '2026-07-20', time: '09:00', status: 'scheduled' },
    { id: 'apt_2', patientName: 'Bob Vance', patientPhone: '+15550202', doctorName: 'Dr. John Watson', date: '2026-07-20', time: '11:30', status: 'rescheduled' },
    { id: 'apt_3', patientName: 'Clara Oswald', patientPhone: '+15550303', doctorName: 'Dr. Gregory House', date: '2026-07-21', time: '14:00', status: 'cancelled' },
  ] as ApiAppointment[],
  patients: [
    { id: 'pat_1', name: 'Alice Green', phone: '+15550101', email: 'alice@green.com', dob: '1990-05-12', lastVisit: '2026-06-10' },
    { id: 'pat_2', name: 'Bob Vance', phone: '+15550202', email: 'bob@vance.com', dob: '1984-08-25', lastVisit: '2026-07-02' },
    { id: 'pat_3', name: 'Clara Oswald', phone: '+15550303', email: 'clara@oswald.com', dob: '1994-11-23', lastVisit: '2026-07-15' },
  ] as ApiPatient[],
  doctors: [
    { id: 'doc_1', name: 'Dr. Gregory House', specialty: 'Endodontics', workingHours: '08:00 - 16:00', availability: 'available' },
    { id: 'doc_2', name: 'Dr. John Watson', specialty: 'General Dentistry', workingHours: '09:00 - 17:00', availability: 'busy' },
    { id: 'doc_3', name: 'Dr. Stephen Strange', specialty: 'Orthodontics', workingHours: '10:00 - 18:00', availability: 'vacation' },
  ] as ApiDoctor[],
  prompts: [
    { id: 'pr_1', version: 3, content: 'You are an AI dental receptionist. Greet patients politely, answer questions about booking, and update schedules.', status: 'published', author: 'admin@clinic.com', createdAt: '2026-07-15T10:00:00Z' },
    { id: 'pr_2', version: 2, content: 'You are an assistant. Help booking appointments.', status: 'archived', author: 'admin@clinic.com', createdAt: '2026-07-10T09:00:00Z' },
    { id: 'pr_3', version: 4, content: 'Draft of updated dental rules and emergency hours rules.', status: 'draft', author: 'admin@clinic.com', createdAt: '2026-07-16T18:00:00Z' },
  ] as ApiPromptVersion[],
  faqs: [
    { id: 'faq_1', question: 'What are your working hours?', answer: 'We are open Monday to Friday, from 8:00 AM to 6:00 PM.' },
    { id: 'faq_2', question: 'Do you accept emergency walk-ins?', answer: 'Yes, please call ahead so our receptionist can prepare a doctor slot.' },
  ],
  auditLogs: [
    { timestamp: '2026-07-17T00:10:00Z', actor: 'receptionist@clinic.com', module: 'appointment', action: 'CREATE', result: 'SUCCESS', correlationId: 'corr_8a9f2bc' },
    { timestamp: '2026-07-17T00:15:00Z', actor: 'system-ai', module: 'end-to-end', action: 'GREETING', result: 'DELIVERED', correlationId: 'corr_3bf911e' },
    { timestamp: '2026-07-17T00:16:12Z', actor: 'patient-phone', module: 'end-to-end', action: 'INTERRUPTION', result: 'DETECTED', correlationId: 'corr_3bf911e' },
  ] as ApiAuditLog[],
  aiConfig: {
    model: 'gpt-4o-realtime',
    voice: 'alloy',
    temperature: 0.6,
    maxDurationMs: 900000,
    inactivityTimeoutMs: 30000,
    interruptionThresholdDb: -45,
  },
  liveCalls: [
    {
      sessionId: 'e2e_live_1092',
      callerNumber: '+15550101',
      calledNumber: '+18005550199',
      duration: '02:14',
      status: 'PROCESSING',
      speaker: 'AI Assistant',
      promptVersion: 3,
      transcript: [
        { time: '00:05', speaker: 'AI Assistant', text: 'Thank you for calling Dental First, how can I help you today?' },
        { time: '00:12', speaker: 'Customer', text: 'Hi, I would like to schedule a root canal for next Monday.' },
        { time: '00:20', speaker: 'AI Assistant', text: 'Sure, let me check the schedule for Dr. House.' },
      ]
    }
  ],
  systemHealth: {
    backend: 'healthy',
    voiceServer: 'healthy',
    openai: 'healthy',
    twilio: 'healthy',
    database: 'healthy',
    cpu: 18,
    memory: 42,
    latency: 95,
  }
};

function initStorage() {
  for (const [key, val] of Object.entries(SEED_DATA)) {
    if (!localStorage.getItem(`db_${key}`)) {
      localStorage.setItem(`db_${key}`, JSON.stringify(val));
    }
  }
}
initStorage();

// Storage getters/setters helper
function getLocal<T>(key: string): T {
  return JSON.parse(localStorage.getItem(`db_${key}`) || '[]');
}

function setLocal<T>(key: string, data: T): void {
  localStorage.setItem(`db_${key}`, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Simulating REST API calls
// ---------------------------------------------------------------------------

const LATENCY_MS = 250;
const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));

export const api = {
  // Appointments
  getAppointments: async (): Promise<ApiAppointment[]> => {
    await delay();
    return getLocal<ApiAppointment[]>('appointments');
  },
  createAppointment: async (apt: Omit<ApiAppointment, 'id'>): Promise<ApiAppointment> => {
    await delay();
    const list = getLocal<ApiAppointment[]>('appointments');
    const newApt = { ...apt, id: `apt_${Date.now()}` };
    list.push(newApt);
    setLocal('appointments', list);
    
    // Add audit log
    const logs = getLocal<ApiAuditLog[]>('auditLogs');
    logs.unshift({
      timestamp: new Date().toISOString(),
      actor: 'receptionist@clinic.com',
      module: 'appointment',
      action: 'CREATE',
      result: 'SUCCESS',
      correlationId: `corr_${Math.random().toString(36).substring(2, 9)}`,
    });
    setLocal('auditLogs', logs);

    return newApt;
  },
  updateAppointment: async (id: string, updates: Partial<ApiAppointment>): Promise<ApiAppointment> => {
    await delay();
    const list = getLocal<ApiAppointment[]>('appointments');
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Appointment not found');
    list[idx] = { ...list[idx], ...updates };
    setLocal('appointments', list);
    return list[idx];
  },

  // Patients
  getPatients: async (): Promise<ApiPatient[]> => {
    await delay();
    return getLocal<ApiPatient[]>('patients');
  },
  createPatient: async (pat: Omit<ApiPatient, 'id'>): Promise<ApiPatient> => {
    await delay();
    const list = getLocal<ApiPatient[]>('patients');
    const newPat = { ...pat, id: `pat_${Date.now()}` };
    list.push(newPat);
    setLocal('patients', list);
    return newPat;
  },
  updatePatient: async (id: string, updates: Partial<ApiPatient>): Promise<ApiPatient> => {
    await delay();
    const list = getLocal<ApiPatient[]>('patients');
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Patient not found');
    list[idx] = { ...list[idx], ...updates };
    setLocal('patients', list);
    return list[idx];
  },

  // Doctors
  getDoctors: async (): Promise<ApiDoctor[]> => {
    await delay();
    return getLocal<ApiDoctor[]>('doctors');
  },
  updateDoctor: async (id: string, updates: Partial<ApiDoctor>): Promise<ApiDoctor> => {
    await delay();
    const list = getLocal<ApiDoctor[]>('doctors');
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error('Doctor not found');
    list[idx] = { ...list[idx], ...updates };
    setLocal('doctors', list);
    return list[idx];
  },

  // Prompts
  getPrompts: async (): Promise<ApiPromptVersion[]> => {
    await delay();
    return getLocal<ApiPromptVersion[]>('prompts');
  },
  createPromptVersion: async (content: string): Promise<ApiPromptVersion> => {
    await delay();
    const list = getLocal<ApiPromptVersion[]>('prompts');
    const nextVer = Math.max(...list.map((p) => p.version)) + 1;
    const newPrompt: ApiPromptVersion = {
      id: `pr_${Date.now()}`,
      version: nextVer,
      content,
      status: 'draft',
      author: 'admin@clinic.com',
      createdAt: new Date().toISOString(),
    };
    list.unshift(newPrompt);
    setLocal('prompts', list);
    return newPrompt;
  },
  publishPromptVersion: async (id: string): Promise<void> => {
    await delay();
    const list = getLocal<ApiPromptVersion[]>('prompts');
    const updated = list.map((p) => {
      if (p.id === id) return { ...p, status: 'published' as const };
      if (p.status === 'published') return { ...p, status: 'archived' as const };
      return p;
    });
    setLocal('prompts', updated);
  },

  // AI Config
  getAiConfig: async () => {
    await delay();
    return getLocal<typeof SEED_DATA.aiConfig>('aiConfig');
  },
  updateAiConfig: async (updates: Partial<typeof SEED_DATA.aiConfig>) => {
    await delay();
    const current = getLocal<typeof SEED_DATA.aiConfig>('aiConfig');
    const updated = { ...current, ...updates };
    setLocal('aiConfig', updated);
    return updated;
  },

  // Knowledge Base (FAQs)
  getFAQs: async () => {
    await delay();
    return getLocal<typeof SEED_DATA.faqs>('faqs');
  },
  createFAQ: async (faq: { question: string; answer: string }) => {
    await delay();
    const list = getLocal<typeof SEED_DATA.faqs>('faqs');
    const newFaq = { ...faq, id: `faq_${Date.now()}` };
    list.push(newFaq);
    setLocal('faqs', list);
    return newFaq;
  },

  // Live Calls
  getLiveCalls: async () => {
    await delay();
    return getLocal<typeof SEED_DATA.liveCalls>('liveCalls');
  },

  // Audit Logs
  getAuditLogs: async (): Promise<ApiAuditLog[]> => {
    await delay();
    return getLocal<ApiAuditLog[]>('auditLogs');
  },

  // System Health
  getSystemHealth: async () => {
    await delay();
    return getLocal<typeof SEED_DATA.systemHealth>('systemHealth');
  }
};
export type ApiClient = typeof api;
