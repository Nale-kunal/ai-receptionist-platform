/**
 * WhatsApp Booking Service
 *
 * Thin, validated wrappers around existing domain services.
 * All scheduling decisions delegate to authoritative existing services.
 *
 * Security Contract:
 *  - tenantId and clinicId ALWAYS come from the server-side resolved context
 *  - NEVER accepts tenantId or clinicId from AI output or patient messages
 *  - All input validated with Zod before calling existing services
 *  - checkAvailability delegates to AvailabilityService (authoritative, real-time)
 *  - bookAppointment delegates to AppointmentService.createAppointment() (overlap-checked)
 */

import { z } from 'zod';
import type { AppointmentService } from '../../appointment/services/appointment.service';
import type { PatientService } from '../../patient/services/patient.service';
import type { DoctorService } from '../../doctor/services/doctor.service';
import type { ClinicService } from '../../clinic/services/clinic.service';
import type { ConfigurationService } from '../../configuration/services/configuration.service';
import type { AvailabilityService } from '../../calendar/services/availability.service';
import { APPOINTMENT_SOURCE_WHATSAPP } from '../../appointment/constants/appointment.constants';

// ---------------------------------------------------------------------------
// Input validation schemas (all server-side, all derive context from session)
// ---------------------------------------------------------------------------

const E164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format');
const UuidZ = z.string().uuid('Must be a valid UUID');
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

// ---------------------------------------------------------------------------
// Execution Context (always from server-side session, never from AI)
// ---------------------------------------------------------------------------

export interface WaExecutionContext {
  tenantId: string;
  clinicId: string;
  patientPhone: string;   // E.164, from Meta payload 'from' field
  correlationId: string;
}

// ---------------------------------------------------------------------------
// Result Types
// ---------------------------------------------------------------------------

export interface AvailabilityResult {
  doctorId: string;
  doctorName: string;
  date: string;
  availableSlots: Array<{ time: string; endTime: string; durationMinutes: number }>;
}

export interface BookingResult {
  appointmentId: string;
  publicId: string;
  status: string;
  startTime: Date;
  endTime: Date;
  doctorName?: string;
  patientName?: string;
  appointmentType: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class WhatsAppBookingService {
  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly patientService: PatientService,
    private readonly doctorService: DoctorService,
    private readonly clinicService: ClinicService,
    private readonly configService: ConfigurationService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // -------------------------------------------------------------------------
  // Patient
  // -------------------------------------------------------------------------

  /** Find existing patient by phone, scoped to clinic (never cross-clinic) */
  public async findPatientByPhone(
    ctx: WaExecutionContext,
  ): Promise<{ id: string; fullName: string; email?: string } | null> {
    const validated = E164.safeParse(ctx.patientPhone);
    if (!validated.success) return null;

    const patients = await this.patientService.listPatients({
      tenantId: ctx.tenantId,
      clinicId: ctx.clinicId,
      phone: ctx.patientPhone,
      limit: 1,
      offset: 0,
    });

    if (!patients || patients.length === 0) return null;
    const p = patients[0]!;
    return { id: p.id, fullName: p.fullName, email: p.email ?? undefined };
  }

  /** Create a new patient, scoped to clinic */
  public async createPatient(
    ctx: WaExecutionContext,
    fullName: string,
    email?: string,
  ): Promise<{ id: string; fullName: string }> {
    const nameStr = z.string().min(1).max(120).parse(fullName.trim());
    const emailStr = email ? z.string().email().optional().parse(email.trim()) : undefined;

    const patient = await this.patientService.createPatient({
      tenantId: ctx.tenantId,
      clinicId: ctx.clinicId,
      fullName: nameStr,
      phone: ctx.patientPhone,
      email: emailStr,
      actorId: 'whatsapp_system',
      requestId: ctx.correlationId,
    });

    return { id: patient.id, fullName: patient.fullName };
  }

  // -------------------------------------------------------------------------
  // Clinic / Doctor
  // -------------------------------------------------------------------------

  /** Get clinic info (name, timezone, address, phone) */
  public async getClinicInfo(ctx: WaExecutionContext): Promise<Record<string, string>> {
    const clinic = await this.clinicService.getClinicById(ctx.clinicId, ctx.tenantId);
    return {
      name: clinic.name,
      timezone: (clinic as any).timezone ?? 'UTC',
      address: (clinic as any).address ?? '',
      phone: (clinic as any).phone ?? '',
    };
  }

  /** List doctors for a clinic */
  public async listDoctors(ctx: WaExecutionContext): Promise<Array<{ id: string; name: string; specialty?: string }>> {
    const doctors = await this.doctorService.listDoctors({ tenantId: ctx.tenantId, clinicId: ctx.clinicId });
    return (doctors ?? []).map((d: any) => ({
      id: d.id,
      name: d.fullName,
      specialty: d.specialty,
    }));
  }

  // -------------------------------------------------------------------------
  // Appointment Types (from Configuration — never from AI)
  // -------------------------------------------------------------------------

  /** Get allowed appointment types from clinic configuration */
  public async getAppointmentTypes(
    ctx: WaExecutionContext,
    allowedFilter?: string[],
  ): Promise<Array<{ name: string; durationMinutes: number }>> {
    const config = await this.configService.getActiveConfiguration(ctx.tenantId, ctx.clinicId);
    const allTypes = (config as any)?.business?.appointmentTypes ?? [
      { name: 'checkup', durationMinutes: 30 },
      { name: 'cleaning', durationMinutes: 45 },
      { name: 'consultation', durationMinutes: 30 },
      { name: 'extraction', durationMinutes: 60 },
      { name: 'filling', durationMinutes: 45 },
    ];

    if (!allowedFilter || allowedFilter.length === 0) return allTypes;
    return allTypes.filter((t: any) => allowedFilter.includes(t.name));
  }

  // -------------------------------------------------------------------------
  // Availability (delegates to AvailabilityService — authoritative)
  // -------------------------------------------------------------------------

  public async checkAvailability(
    ctx: WaExecutionContext,
    doctorId: string,
    date: string,
    durationMinutes: number,
    timezone: string,
    excludeAppointmentId?: string,
  ): Promise<AvailabilityResult> {
    UuidZ.parse(doctorId);
    DateStr.parse(date);
    z.number().int().min(5).max(480).parse(durationMinutes);

    // Verify doctor belongs to this clinic (tenant isolation)
    const doctor = await this.doctorService.getDoctorById(doctorId, ctx.tenantId);
    if ((doctor as any).clinicId !== ctx.clinicId) {
      throw new Error('Doctor does not belong to the specified clinic.');
    }

    const slots = await this.availabilityService.getAvailableSlots({
      tenantId: ctx.tenantId,
      clinicId: ctx.clinicId,
      doctorId,
      date,
      durationMinutes,
      timezone,
      excludeAppointmentId,
      excludeUnavailable: true,
    });

    return {
      doctorId,
      doctorName: (doctor as any).fullName ?? 'Doctor',
      date,
      availableSlots: (slots.slots ?? []).filter((s: any) => s.available).map((s: any) => ({
        time: s.time,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Booking (delegates to AppointmentService — single authority)
  // -------------------------------------------------------------------------

  public async bookAppointment(
    ctx: WaExecutionContext,
    patientId: string,
    doctorId: string,
    startTimeIso: string,
    endTimeIso: string,
    appointmentType: string,
    durationMinutes: number,
    timezone: string,
    notes?: string,
  ): Promise<BookingResult> {
    UuidZ.parse(patientId);
    UuidZ.parse(doctorId);
    z.string().datetime().parse(startTimeIso);
    z.string().datetime().parse(endTimeIso);

    const appt = await this.appointmentService.createAppointment({
      tenantId: ctx.tenantId,
      clinicId: ctx.clinicId,
      doctorId,
      patientId,
      startTime: new Date(startTimeIso),
      endTime: new Date(endTimeIso),
      timezone,
      source: APPOINTMENT_SOURCE_WHATSAPP,
      appointmentType,
      durationMinutes,
      notes,
      actorId: 'whatsapp_system',
      requestId: ctx.correlationId,
    });

    return {
      appointmentId: appt.id,
      publicId: appt.publicId,
      status: appt.status,
      startTime: appt.startTime,
      endTime: appt.endTime,
      doctorName: appt.doctorName ?? 'Doctor',
      patientName: appt.patientName ?? 'Patient',
      appointmentType: appt.appointmentType ?? appointmentType,
      timezone: appt.timezone,
    };
  }

  // -------------------------------------------------------------------------
  // Patient Appointments
  // -------------------------------------------------------------------------

  public async getPatientAppointments(
    ctx: WaExecutionContext,
    patientId: string,
    limit = 3,
  ): Promise<any[]> {
    UuidZ.parse(patientId);
    const result = await this.appointmentService.listAppointments({
      tenantId: ctx.tenantId,
      clinicId: ctx.clinicId,
      patientId,
      limit,
      page: 1,
    });
    return result.appointments ?? [];
  }

  // -------------------------------------------------------------------------
  // Reschedule (delegates to AppointmentService)
  // -------------------------------------------------------------------------

  public async rescheduleAppointment(
    ctx: WaExecutionContext,
    appointmentId: string,
    newStartTimeIso: string,
    newEndTimeIso: string,
    timezone: string,
  ): Promise<BookingResult> {
    UuidZ.parse(appointmentId);
    z.string().datetime().parse(newStartTimeIso);
    z.string().datetime().parse(newEndTimeIso);

    const appt = await this.appointmentService.rescheduleAppointment({
      id: appointmentId,
      tenantId: ctx.tenantId,
      startTime: new Date(newStartTimeIso),
      endTime: new Date(newEndTimeIso),
      timezone,
      actorId: 'whatsapp_system',
      requestId: ctx.correlationId,
    });

    return {
      appointmentId: appt.id,
      publicId: appt.publicId,
      status: appt.status,
      startTime: appt.startTime,
      endTime: appt.endTime,
      doctorName: appt.doctorName ?? 'Doctor',
      patientName: appt.patientName ?? 'Patient',
      appointmentType: appt.appointmentType ?? 'consultation',
      timezone: appt.timezone,
    };
  }

  // -------------------------------------------------------------------------
  // Cancel (delegates to AppointmentService)
  // -------------------------------------------------------------------------

  public async cancelAppointment(
    ctx: WaExecutionContext,
    appointmentId: string,
    reason?: string,
  ): Promise<{ appointmentId: string; status: string }> {
    UuidZ.parse(appointmentId);

    const appt = await this.appointmentService.cancelAppointment({
      id: appointmentId,
      tenantId: ctx.tenantId,
      cancellationReason: reason ?? 'Cancelled via WhatsApp',
      actorId: 'whatsapp_system',
      requestId: ctx.correlationId,
    });

    return { appointmentId: appt.id, status: appt.status };
  }
}
