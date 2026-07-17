import * as tools from '../enterprise-tools';
import type { ExecutionContext } from '../ai-tool.types';

describe('Enterprise Tools Execution Integration', () => {
  let context: ExecutionContext;
  let mockClinicService: any;
  let mockDoctorService: any;
  let mockPatientService: any;
  let mockAppointmentService: any;
  let mockConversationService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    context = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 'tenant-123',
      clinicId: 'clinic-123',
      sessionId: 'ses-123',
      conversationId: 'conv-123',
      patientId: null,
      userId: 'user-123',
      provider: 'default',
      toolVersion: '1.0.0',
      timestamp: new Date(),
    };

    mockClinicService = {
      getClinicById: jest.fn().mockResolvedValue({
        id: 'clinic-123',
        name: 'Dental Care Clinic',
        slug: 'dental-care',
        timezone: 'America/New_York',
        country: 'US',
        contact: {
          primaryEmail: 'info@dentalcare.com',
          primaryPhone: '123-456-7890',
          address: '123 Dental St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
        },
      }),
    };

    mockDoctorService = {
      getDoctorById: jest.fn().mockResolvedValue({
        id: 'doc-123',
        clinicId: 'clinic-123',
        fullName: 'Dr. John Smith',
        specialization: 'General Dentist',
        email: 'john@dental.com',
        phone: '999-999-9999',
        workingHours: [],
        leaves: [],
      }),
      listDoctors: jest.fn().mockResolvedValue([
        {
          id: 'doc-123',
          fullName: 'Dr. John Smith',
          specialization: 'General Dentist',
          email: 'john@dental.com',
          phone: '999-999-9999',
        },
      ]),
    };

    mockPatientService = {
      listPatients: jest.fn().mockResolvedValue([
        {
          id: 'pat-123',
          fullName: 'Alice Patient',
          phone: '555-555-5555',
          email: 'alice@pat.com',
          preferredLanguage: 'en',
        },
      ]),
      createPatient: jest.fn().mockResolvedValue({
        id: 'pat-123',
        fullName: 'Alice Patient',
        phone: '555-555-5555',
        email: 'alice@pat.com',
      }),
      updatePatient: jest.fn().mockResolvedValue({
        id: 'pat-123',
        email: 'new-email@pat.com',
        preferredLanguage: 'es',
      }),
    };

    mockAppointmentService = {
      getAppointmentById: jest.fn().mockResolvedValue({
        id: 'appt-123',
        clinicId: 'clinic-123',
        doctorId: 'doc-123',
        patientId: 'pat-123',
        status: 'pending',
      }),
      createAppointment: jest.fn().mockResolvedValue({
        id: 'appt-123',
        status: 'pending',
        startTime: new Date('2026-07-20T09:00:00Z'),
        endTime: new Date('2026-07-20T10:00:00Z'),
      }),
      updateAppointment: jest.fn().mockResolvedValue({
        id: 'appt-123',
        notes: 'new notes',
      }),
      rescheduleAppointment: jest.fn().mockResolvedValue({
        id: 'appt-123',
        status: 'confirmed',
        startTime: new Date('2026-07-21T09:00:00Z'),
        endTime: new Date('2026-07-21T10:00:00Z'),
      }),
      cancelAppointment: jest.fn().mockResolvedValue({
        id: 'appt-123',
        status: 'cancelled',
        cancellationReason: 'Sick leave',
      }),
    };

    mockConversationService = {
      updateSummary: jest.fn().mockResolvedValue(undefined),
      getConversationById: jest.fn().mockResolvedValue({
        id: 'conv-123',
        transcript: [],
        summary: { text: 'Patient wants to book appointment.' },
      }),
      completeConversation: jest.fn().mockResolvedValue(undefined),
    };

    mockNotificationService = {
      createNotification: jest.fn().mockResolvedValue({
        id: 'notif-123',
        status: 'sent',
      }),
    };
  });

  it('runs ClinicInformationTool successfully', async () => {
    const tool = new tools.ClinicInformationTool(mockClinicService);
    const result = await tool.execute({ clinicId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.name).toBe('Dental Care Clinic');
  });

  it('runs BusinessHoursTool successfully', async () => {
    const tool = new tools.BusinessHoursTool(mockClinicService);
    const result = await tool.execute({ clinicId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.businessHours.length).toBeGreaterThan(0);
  });

  it('runs ListDoctorsTool successfully', async () => {
    const tool = new tools.ListDoctorsTool(mockDoctorService);
    const result = await tool.execute({ clinicId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.doctors[0].fullName).toBe('Dr. John Smith');
  });

  it('runs DoctorAvailabilityTool successfully', async () => {
    const tool = new tools.DoctorAvailabilityTool(mockDoctorService);
    const result = await tool.execute({ doctorId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.doctorId).toBe('doc-123');
  });

  it('runs FindPatientTool successfully', async () => {
    const tool = new tools.FindPatientTool(mockPatientService);
    const result = await tool.execute({ phone: '555-555-5555' }, context);
    expect(result.patients[0].fullName).toBe('Alice Patient');
  });

  it('runs CreatePatientTool successfully', async () => {
    const tool = new tools.CreatePatientTool(mockPatientService);
    const result = await tool.execute({
      clinicId: '11111111-1111-1111-1111-111111111111',
      fullName: 'Alice Patient',
      phone: '555-555-5555',
    }, context);
    expect(result.patientId).toBe('pat-123');
  });

  it('runs UpdatePatientTool successfully', async () => {
    const tool = new tools.UpdatePatientTool(mockPatientService);
    const result = await tool.execute({
      patientId: '11111111-1111-1111-1111-111111111111',
      email: 'new-email@pat.com',
      preferredLanguage: 'es',
    }, context);
    expect(result.preferredLanguage).toBe('es');
  });

  it('runs CheckAvailabilityTool successfully', async () => {
    const tool = new tools.CheckAvailabilityTool(mockDoctorService, mockAppointmentService);
    const result = await tool.execute({
      clinicId: 'clinic-123',
      doctorId: 'doc-123',
      date: '2026-07-20',
    }, context);
    expect(result.availableSlots.length).toBeGreaterThan(0);
  });

  it('runs CreateAppointmentTool successfully', async () => {
    const tool = new tools.CreateAppointmentTool(mockAppointmentService);
    const result = await tool.execute({
      clinicId: 'clinic-123',
      doctorId: 'doc-123',
      patientId: 'pat-123',
      startTime: '2026-07-20T09:00:00Z',
      endTime: '2026-07-20T10:00:00Z',
      timezone: 'America/New_York',
    }, context);
    expect(result.appointmentId).toBe('appt-123');
  });

  it('runs UpdateAppointmentTool successfully', async () => {
    const tool = new tools.UpdateAppointmentTool(mockAppointmentService);
    const result = await tool.execute({
      appointmentId: '11111111-1111-1111-1111-111111111111',
      notes: 'new notes',
    }, context);
    expect(result.notes).toBe('new notes');
  });

  it('runs RescheduleAppointmentTool successfully', async () => {
    const tool = new tools.RescheduleAppointmentTool(mockAppointmentService);
    const result = await tool.execute({
      appointmentId: '11111111-1111-1111-1111-111111111111',
      startTime: '2026-07-21T09:00:00Z',
      endTime: '2026-07-21T10:00:00Z',
    }, context);
    expect(result.status).toBe('confirmed');
  });

  it('runs CancelAppointmentTool successfully', async () => {
    const tool = new tools.CancelAppointmentTool(mockAppointmentService);
    const result = await tool.execute({
      appointmentId: '11111111-1111-1111-1111-111111111111',
      cancellationReason: 'Sick leave',
    }, context);
    expect(result.status).toBe('cancelled');
  });

  it('runs StoreSummaryTool successfully', async () => {
    const tool = new tools.StoreSummaryTool(mockConversationService);
    const result = await tool.execute({
      conversationId: '11111111-1111-1111-1111-111111111111',
      summary: 'Patient wants to book.',
      intent: 'book_appointment',
    }, context);
    expect(result.success).toBe(true);
  });

  it('runs RetrieveContextTool successfully', async () => {
    const tool = new tools.RetrieveContextTool(mockConversationService);
    const result = await tool.execute({ conversationId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.summary).toBe('Patient wants to book appointment.');
  });

  it('runs SendSmsTool successfully', async () => {
    const tool = new tools.SendSmsTool(mockNotificationService);
    const result = await tool.execute({
      clinicId: '11111111-1111-1111-1111-111111111111',
      recipient: '123-456-7890',
      content: 'Hello',
    }, context);
    expect(result.notificationId).toBe('notif-123');
  });

  it('runs SendEmailTool successfully', async () => {
    const tool = new tools.SendEmailTool(mockNotificationService);
    const result = await tool.execute({
      clinicId: '11111111-1111-1111-1111-111111111111',
      recipient: 'alice@pat.com',
      subject: 'Reminder',
      content: 'Hello',
    }, context);
    expect(result.notificationId).toBe('notif-123');
  });

  it('runs SendReminderTool successfully', async () => {
    const tool = new tools.SendReminderTool(mockNotificationService, mockAppointmentService);
    const result = await tool.execute({
      appointmentId: '11111111-1111-1111-1111-111111111111',
      channel: 'sms',
      recipient: '123-456-7890',
      content: 'Reminder',
    }, context);
    expect(result.notificationId).toBe('notif-123');
  });

  it('runs FaqLookupTool successfully', async () => {
    const tool = new tools.FaqLookupTool();
    const result = await tool.execute({
      clinicId: '11111111-1111-1111-1111-111111111111',
      question: 'policy',
    }, context);
    expect(result.found).toBe(true);
  });

  it('runs EscalateHumanTool successfully', async () => {
    const tool = new tools.EscalateHumanTool();
    const result = await tool.execute({
      conversationId: '11111111-1111-1111-1111-111111111111',
      reason: 'Urgent dentist question',
    }, context);
    expect(result.escalationStatus).toBe('escalated');
  });

  it('runs EndConversationTool successfully', async () => {
    const tool = new tools.EndConversationTool(mockConversationService);
    const result = await tool.execute({ conversationId: '11111111-1111-1111-1111-111111111111' }, context);
    expect(result.terminated).toBe(true);
  });
});
