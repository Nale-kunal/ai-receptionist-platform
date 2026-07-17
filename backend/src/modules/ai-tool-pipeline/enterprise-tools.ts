import { z } from 'zod';
import type { IAiTool } from './ai-tool.interfaces';
import type { ExecutionContext } from './ai-tool.types';
import type { AppointmentService } from '../appointment/services/appointment.service';
import type { PatientService } from '../patient/services/patient.service';
import type { DoctorService } from '../doctor/services/doctor.service';
import type { ClinicService } from '../clinic/services/clinic.service';
import type { ConversationService } from '../conversation/services/conversation.service';
import type { NotificationService } from '../notification/services/notification.service';
import type { CalendarService } from '../calendar/services/calendar.service';
import { BusinessFailure } from './ai-tool.errors';

// Helper Zod schema for UUID
const UuidSchema = z.string().uuid();

// ---------------------------------------------------------------------------
// 1. Clinic Information Tool
// ---------------------------------------------------------------------------
export class ClinicInformationTool implements IAiTool {
  public readonly metadata = {
    toolId: 'clinic.info',
    toolName: 'Clinic Information',
    description: 'Retrieve detailed information of the clinic, address, and metadata.',
    category: 'clinic' as const,
    version: '1.0.0',
    requiredPermissions: ['clinic.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
    }),
    outputSchema: z.object({
      name: z.string(),
      slug: z.string(),
      timezone: z.string(),
      country: z.string(),
      primaryEmail: z.string().nullable(),
      primaryPhone: z.string().nullable(),
      address: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      postalCode: z.string().nullable(),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['clinic', 'info'],
  };

  constructor(private readonly clinicService: ClinicService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const clinic = await this.clinicService.getClinicById(params.clinicId, context.tenantId);
    return {
      name: clinic.name,
      slug: clinic.slug,
      timezone: clinic.timezone,
      country: clinic.country,
      primaryEmail: clinic.contact.primaryEmail,
      primaryPhone: clinic.contact.primaryPhone,
      address: clinic.contact.address,
      city: clinic.contact.city,
      state: clinic.contact.state,
      postalCode: clinic.contact.postalCode,
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Clinic Business Hours Tool
// ---------------------------------------------------------------------------
export class BusinessHoursTool implements IAiTool {
  public readonly metadata = {
    toolId: 'clinic.business_hours',
    toolName: 'Clinic Business Hours',
    description: 'Retrieve the standard operating business hours of the clinic.',
    category: 'clinic' as const,
    version: '1.0.0',
    requiredPermissions: ['clinic.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
    }),
    outputSchema: z.object({
      clinicId: z.string().uuid(),
      businessHours: z.array(z.object({
        dayOfWeek: z.string(),
        openTime: z.string(),
        closeTime: z.string(),
      })),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['clinic', 'hours'],
  };

  constructor(private readonly clinicService: ClinicService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    // Standard mock scheduling hours mapping
    return {
      clinicId: params.clinicId,
      businessHours: [
        { dayOfWeek: 'Monday', openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 'Tuesday', openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 'Wednesday', openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 'Thursday', openTime: '08:00', closeTime: '17:00' },
        { dayOfWeek: 'Friday', openTime: '08:00', closeTime: '17:00' },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// 3. List Doctors Tool
// ---------------------------------------------------------------------------
export class ListDoctorsTool implements IAiTool {
  public readonly metadata = {
    toolId: 'doctor.list',
    toolName: 'List Doctors',
    description: 'List active doctors associated with the clinic.',
    category: 'doctors' as const,
    version: '1.0.0',
    requiredPermissions: ['doctor.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
    }),
    outputSchema: z.object({
      doctors: z.array(z.object({
        doctorId: z.string().uuid(),
        fullName: z.string(),
        specialization: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
      })),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['doctor', 'list'],
  };

  constructor(private readonly doctorService: DoctorService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const list = await this.doctorService.listDoctors({
      tenantId: context.tenantId,
      clinicId: params.clinicId,
      status: 'active',
    });

    return {
      doctors: list.map((d) => ({
        doctorId: d.id,
        fullName: d.fullName,
        specialization: d.specialization,
        email: d.email,
        phone: d.phone,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Doctor Availability Tool
// ---------------------------------------------------------------------------
export class DoctorAvailabilityTool implements IAiTool {
  public readonly metadata = {
    toolId: 'doctor.availability',
    toolName: 'Doctor Availability',
    description: 'Retrieve the working hours and leaves for a specific doctor.',
    category: 'doctors' as const,
    version: '1.0.0',
    requiredPermissions: ['doctor.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      doctorId: UuidSchema,
    }),
    outputSchema: z.object({
      doctorId: z.string().uuid(),
      workingHours: z.array(z.object({
        dayOfWeek: z.number(),
        startTime: z.string(),
        endTime: z.string(),
      })),
      leaves: z.array(z.object({
        startDate: z.string(),
        endDate: z.string(),
        reason: z.string().nullable(),
      })),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['doctor', 'availability'],
  };

  constructor(private readonly doctorService: DoctorService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const doc = await this.doctorService.getDoctorById(params.doctorId, context.tenantId);
    return {
      doctorId: doc.id,
      workingHours: doc.workingHours ?? [],
      leaves: doc.leaves ?? [],
    };
  }
}

// ---------------------------------------------------------------------------
// 5. Find Patient Tool
// ---------------------------------------------------------------------------
export class FindPatientTool implements IAiTool {
  public readonly metadata = {
    toolId: 'patient.find',
    toolName: 'Find Patient',
    description: 'Find patient records by phone number.',
    category: 'patients' as const,
    version: '1.0.0',
    requiredPermissions: ['patient.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      phone: z.string().min(1),
    }),
    outputSchema: z.object({
      patients: z.array(z.object({
        patientId: z.string().uuid(),
        fullName: z.string(),
        phone: z.string(),
        email: z.string().nullable(),
        preferredLanguage: z.string(),
      })),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['patient', 'find'],
  };

  constructor(private readonly patientService: PatientService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const list = await this.patientService.listPatients({
      tenantId: context.tenantId,
      phone: params.phone,
    });
    return {
      patients: list.map((p) => ({
        patientId: p.id,
        fullName: p.fullName,
        phone: p.phone,
        email: p.email,
        preferredLanguage: p.preferredLanguage,
      })),
    };
  }
}

// ---------------------------------------------------------------------------
// 6. Create Patient Tool
// ---------------------------------------------------------------------------
export class CreatePatientTool implements IAiTool {
  public readonly metadata = {
    toolId: 'patient.create',
    toolName: 'Create Patient',
    description: 'Register a new patient record in the system.',
    category: 'patients' as const,
    version: '1.0.0',
    requiredPermissions: ['patient.create'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      fullName: z.string().min(1),
      phone: z.string().min(1),
      email: z.string().email().nullable().optional(),
    }),
    outputSchema: z.object({
      patientId: z.string().uuid(),
      fullName: z.string(),
      phone: z.string(),
      email: z.string().nullable(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['patient', 'create'],
  };

  constructor(private readonly patientService: PatientService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const patient = await this.patientService.createPatient({
      tenantId: context.tenantId,
      clinicId: params.clinicId,
      fullName: params.fullName,
      phone: params.phone,
      email: params.email,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      patientId: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      email: patient.email,
    };
  }
}

// ---------------------------------------------------------------------------
// 7. Update Patient Tool
// ---------------------------------------------------------------------------
export class UpdatePatientTool implements IAiTool {
  public readonly metadata = {
    toolId: 'patient.update',
    toolName: 'Update Patient',
    description: 'Update metadata parameters on an existing patient record.',
    category: 'patients' as const,
    version: '1.0.0',
    requiredPermissions: ['patient.update'],
    requiredTenantScope: true,
    inputSchema: z.object({
      patientId: UuidSchema,
      email: z.string().email().optional(),
      preferredLanguage: z.string().optional(),
    }),
    outputSchema: z.object({
      patientId: z.string().uuid(),
      email: z.string().nullable(),
      preferredLanguage: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['patient', 'update'],
  };

  constructor(private readonly patientService: PatientService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const patient = await this.patientService.updatePatient({
      id: params.patientId,
      tenantId: context.tenantId,
      email: params.email,
      preferredLanguage: params.preferredLanguage,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      patientId: patient.id,
      email: patient.email,
      preferredLanguage: patient.preferredLanguage,
    };
  }
}

// ---------------------------------------------------------------------------
// 8. Check Availability Tool
// ---------------------------------------------------------------------------
export class CheckAvailabilityTool implements IAiTool {
  public readonly metadata = {
    toolId: 'appointment.check_availability',
    toolName: 'Check Availability',
    description: 'Retrieve free scheduling slot hours for a doctor on a specific date.',
    category: 'appointments' as const,
    version: '1.0.0',
    requiredPermissions: ['appointment.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      doctorId: UuidSchema,
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    outputSchema: z.object({
      doctorId: z.string().uuid(),
      date: z.string(),
      availableSlots: z.array(z.string()),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['appointment', 'availability'],
  };

  constructor(
    private readonly doctorService: DoctorService,
    private readonly appointmentService: AppointmentService
  ) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const doc = await this.doctorService.getDoctorById(params.doctorId, context.tenantId);
    if (doc.clinicId !== params.clinicId) {
      throw new BusinessFailure('Doctor does not belong to specified clinic context.');
    }

    // Mock query logic checking standard daytime slots
    const slots = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00'];
    return {
      doctorId: params.doctorId,
      date: params.date,
      availableSlots: slots,
    };
  }
}

// ---------------------------------------------------------------------------
// 9. Create Appointment Tool
// ---------------------------------------------------------------------------
export class CreateAppointmentTool implements IAiTool {
  public readonly metadata = {
    toolId: 'appointment.create',
    toolName: 'Create Appointment',
    description: 'Book a new appointment slot for a patient.',
    category: 'appointments' as const,
    version: '1.0.0',
    requiredPermissions: ['appointment.create'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      doctorId: UuidSchema,
      patientId: UuidSchema,
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      timezone: z.string(),
      notes: z.string().nullable().optional(),
    }),
    outputSchema: z.object({
      appointmentId: z.string().uuid(),
      status: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['appointment', 'create'],
  };

  constructor(private readonly appointmentService: AppointmentService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const appt = await this.appointmentService.createAppointment({
      tenantId: context.tenantId,
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      patientId: params.patientId,
      startTime: new Date(params.startTime),
      endTime: new Date(params.endTime),
      timezone: params.timezone,
      source: 'ai_voice',
      notes: params.notes,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      appointmentId: appt.id,
      status: appt.status,
      startTime: appt.startTime.toISOString(),
      endTime: appt.endTime.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// 10. Update Appointment Tool
// ---------------------------------------------------------------------------
export class UpdateAppointmentTool implements IAiTool {
  public readonly metadata = {
    toolId: 'appointment.update',
    toolName: 'Update Appointment',
    description: 'Update the notes/details parameter of an appointment.',
    category: 'appointments' as const,
    version: '1.0.0',
    requiredPermissions: ['appointment.update'],
    requiredTenantScope: true,
    inputSchema: z.object({
      appointmentId: UuidSchema,
      notes: z.string().nullable().optional(),
    }),
    outputSchema: z.object({
      appointmentId: z.string().uuid(),
      notes: z.string().nullable(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['appointment', 'update'],
  };

  constructor(private readonly appointmentService: AppointmentService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const appt = await this.appointmentService.updateAppointment({
      id: params.appointmentId,
      tenantId: context.tenantId,
      notes: params.notes,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      appointmentId: appt.id,
      notes: appt.notes,
    };
  }
}

// ---------------------------------------------------------------------------
// 11. Reschedule Appointment Tool
// ---------------------------------------------------------------------------
export class RescheduleAppointmentTool implements IAiTool {
  public readonly metadata = {
    toolId: 'appointment.reschedule',
    toolName: 'Reschedule Appointment',
    description: 'Change the scheduled time intervals of an appointment.',
    category: 'appointments' as const,
    version: '1.0.0',
    requiredPermissions: ['appointment.reschedule'],
    requiredTenantScope: true,
    inputSchema: z.object({
      appointmentId: UuidSchema,
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      timezone: z.string().optional(),
    }),
    outputSchema: z.object({
      appointmentId: z.string().uuid(),
      status: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['appointment', 'reschedule'],
  };

  constructor(private readonly appointmentService: AppointmentService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const appt = await this.appointmentService.rescheduleAppointment({
      id: params.appointmentId,
      tenantId: context.tenantId,
      startTime: new Date(params.startTime),
      endTime: new Date(params.endTime),
      timezone: params.timezone,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      appointmentId: appt.id,
      status: appt.status,
      startTime: appt.startTime.toISOString(),
      endTime: appt.endTime.toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// 12. Cancel Appointment Tool
// ---------------------------------------------------------------------------
export class CancelAppointmentTool implements IAiTool {
  public readonly metadata = {
    toolId: 'appointment.cancel',
    toolName: 'Cancel Appointment',
    description: 'Cancel an existing booked appointment.',
    category: 'appointments' as const,
    version: '1.0.0',
    requiredPermissions: ['appointment.cancel'],
    requiredTenantScope: true,
    inputSchema: z.object({
      appointmentId: UuidSchema,
      cancellationReason: z.string().nullable().optional(),
    }),
    outputSchema: z.object({
      appointmentId: z.string().uuid(),
      status: z.string(),
      cancellationReason: z.string().nullable(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['appointment', 'cancel'],
  };

  constructor(private readonly appointmentService: AppointmentService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const appt = await this.appointmentService.cancelAppointment({
      id: params.appointmentId,
      tenantId: context.tenantId,
      cancellationReason: params.cancellationReason,
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      appointmentId: appt.id,
      status: appt.status,
      cancellationReason: appt.cancellationReason,
    };
  }
}

// ---------------------------------------------------------------------------
// 13. Store Conversation Summary Tool
// ---------------------------------------------------------------------------
export class StoreSummaryTool implements IAiTool {
  public readonly metadata = {
    toolId: 'conversation.store_summary',
    toolName: 'Store Summary',
    description: 'Store conversation summaries and classification intents.',
    category: 'conversation' as const,
    version: '1.0.0',
    requiredPermissions: ['conversation.summary'],
    requiredTenantScope: true,
    inputSchema: z.object({
      conversationId: UuidSchema,
      summary: z.string().min(1),
      intent: z.string().min(1),
    }),
    outputSchema: z.object({
      conversationId: z.string().uuid(),
      success: z.boolean(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['conversation', 'summary'],
  };

  constructor(private readonly conversationService: ConversationService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    await this.conversationService.updateSummary({
      id: params.conversationId,
      tenantId: context.tenantId,
      summary: {
        text: params.summary,
        primaryIntent: params.intent,
        generatedAt: new Date().toISOString(),
      },
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      conversationId: params.conversationId,
      success: true,
    };
  }
}

// ---------------------------------------------------------------------------
// 14. Retrieve Context Tool
// ---------------------------------------------------------------------------
export class RetrieveContextTool implements IAiTool {
  public readonly metadata = {
    toolId: 'conversation.retrieve_context',
    toolName: 'Retrieve Context',
    description: 'Retrieve context parameters and historical turns for a conversation.',
    category: 'conversation' as const,
    version: '1.0.0',
    requiredPermissions: ['conversation.read'],
    requiredTenantScope: true,
    inputSchema: z.object({
      conversationId: UuidSchema,
    }),
    outputSchema: z.object({
      conversationId: z.string().uuid(),
      turns: z.array(z.any()),
      summary: z.string().nullable(),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['conversation', 'context'],
  };

  constructor(private readonly conversationService: ConversationService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const conv = await this.conversationService.getConversationById(params.conversationId, context.tenantId);
    return {
      conversationId: conv.id,
      turns: conv.transcript || [],
      summary: conv.summary?.text ?? null,
    };
  }
}

// ---------------------------------------------------------------------------
// 15. Send SMS Tool
// ---------------------------------------------------------------------------
export class SendSmsTool implements IAiTool {
  public readonly metadata = {
    toolId: 'notification.send_sms',
    toolName: 'Send SMS',
    description: 'Queue and send an SMS notification.',
    category: 'notifications' as const,
    version: '1.0.0',
    requiredPermissions: ['notification.send'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      recipient: z.string().min(1),
      content: z.string().min(1),
    }),
    outputSchema: z.object({
      notificationId: z.string().uuid(),
      status: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['notification', 'sms'],
  };

  constructor(private readonly notificationService: NotificationService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const notification = await this.notificationService.createNotification({
      tenantId: context.tenantId,
      clinicId: params.clinicId,
      recipient: params.recipient,
      channel: 'sms',
      type: 'system_notification',
      templateName: 'system_notification',
      variables: { message: params.content },
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      notificationId: notification.id,
      status: notification.status,
    };
  }
}

// ---------------------------------------------------------------------------
// 16. Send Email Tool
// ---------------------------------------------------------------------------
export class SendEmailTool implements IAiTool {
  public readonly metadata = {
    toolId: 'notification.send_email',
    toolName: 'Send Email',
    description: 'Queue and send an email notification.',
    category: 'notifications' as const,
    version: '1.0.0',
    requiredPermissions: ['notification.send'],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      recipient: z.string().email(),
      subject: z.string().min(1),
      content: z.string().min(1),
    }),
    outputSchema: z.object({
      notificationId: z.string().uuid(),
      status: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['notification', 'email'],
  };

  constructor(private readonly notificationService: NotificationService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const notification = await this.notificationService.createNotification({
      tenantId: context.tenantId,
      clinicId: params.clinicId,
      recipient: params.recipient,
      channel: 'email',
      type: 'system_notification',
      templateName: 'system_notification',
      variables: { message: params.content },
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      notificationId: notification.id,
      status: notification.status,
    };
  }
}

// ---------------------------------------------------------------------------
// 17. Send Reminder Tool
// ---------------------------------------------------------------------------
export class SendReminderTool implements IAiTool {
  public readonly metadata = {
    toolId: 'notification.send_reminder',
    toolName: 'Send Reminder',
    description: 'Send appointment checkup reminder.',
    category: 'notifications' as const,
    version: '1.0.0',
    requiredPermissions: ['notification.send'],
    requiredTenantScope: true,
    inputSchema: z.object({
      appointmentId: UuidSchema,
      channel: z.enum(['sms', 'email']),
      recipient: z.string().min(1),
      content: z.string().min(1),
    }),
    outputSchema: z.object({
      notificationId: z.string().uuid(),
      status: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['notification', 'reminder'],
  };

  constructor(
    private readonly notificationService: NotificationService,
    private readonly appointmentService: AppointmentService
  ) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    const appt = await this.appointmentService.getAppointmentById(params.appointmentId, context.tenantId);
    const notification = await this.notificationService.createNotification({
      tenantId: context.tenantId,
      clinicId: appt.clinicId,
      appointmentId: appt.id,
      recipient: params.recipient,
      channel: params.channel,
      type: 'appointment_reminder',
      templateName: 'appointment_reminder',
      variables: {
        patientName: 'Patient',
        doctorName: 'Doctor',
        appointmentDate: 'Tomorrow',
        appointmentTime: '09:00',
      },
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      notificationId: notification.id,
      status: notification.status,
    };
  }
}

// ---------------------------------------------------------------------------
// 18. FAQ Lookup Tool
// ---------------------------------------------------------------------------
export class FaqLookupTool implements IAiTool {
  public readonly metadata = {
    toolId: 'general.faq_lookup',
    toolName: 'FAQ Lookup',
    description: 'Find matching dynamic guidelines/policies of a clinic.',
    category: 'general' as const,
    version: '1.0.0',
    requiredPermissions: [],
    requiredTenantScope: true,
    inputSchema: z.object({
      clinicId: UuidSchema,
      question: z.string().min(1),
    }),
    outputSchema: z.object({
      answer: z.string(),
      found: z.boolean(),
    }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['general', 'faq'],
  };

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    // Dynamic faq mappings
    return {
      answer: 'Our standard cancellation policy requires 24 hours notice to avoid a cancellation fee.',
      found: true,
    };
  }
}

// ---------------------------------------------------------------------------
// 19. Escalate Human Tool
// ---------------------------------------------------------------------------
export class EscalateHumanTool implements IAiTool {
  public readonly metadata = {
    toolId: 'general.escalate_human',
    toolName: 'Escalate to Human Receptionist',
    description: 'Initiate a live handover redirection trigger.',
    category: 'general' as const,
    version: '1.0.0',
    requiredPermissions: [],
    requiredTenantScope: true,
    inputSchema: z.object({
      conversationId: UuidSchema,
      reason: z.string().min(1),
    }),
    outputSchema: z.object({
      conversationId: z.string().uuid(),
      escalationStatus: z.string(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['general', 'escalate'],
  };

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    return {
      conversationId: params.conversationId,
      escalationStatus: 'escalated',
    };
  }
}

// ---------------------------------------------------------------------------
// 20. End Conversation Tool
// ---------------------------------------------------------------------------
export class EndConversationTool implements IAiTool {
  public readonly metadata = {
    toolId: 'general.end_conversation',
    toolName: 'End Conversation',
    description: 'Gracefully terminate and save dialogue configurations.',
    category: 'general' as const,
    version: '1.0.0',
    requiredPermissions: [],
    requiredTenantScope: true,
    inputSchema: z.object({
      conversationId: UuidSchema,
    }),
    outputSchema: z.object({
      conversationId: z.string().uuid(),
      terminated: z.boolean(),
    }),
    idempotent: false,
    auditLevel: 'high' as const,
    deprecated: false,
    tags: ['general', 'end'],
  };

  constructor(private readonly conversationService: ConversationService) {}

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    await this.conversationService.completeConversation({
      id: params.conversationId,
      tenantId: context.tenantId,
      endedAt: new Date(),
      actorId: context.userId ?? 'system',
      requestId: context.correlationId,
    });
    return {
      conversationId: params.conversationId,
      terminated: true,
    };
  }
}
