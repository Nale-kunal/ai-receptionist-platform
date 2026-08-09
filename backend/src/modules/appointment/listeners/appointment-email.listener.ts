import type { PrismaClient } from '@prisma/client';
import type { InProcessAppointmentEventPublisher } from '../events/appointment-event.publisher';
import type { EmailService } from '../../../shared/email/EmailService';
import {
  EVENT_APPOINTMENT_CREATED,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_APPOINTMENT_CANCELLED,
} from '../events/appointment.events';

export function registerAppointmentEmailListener(
  publisher: InProcessAppointmentEventPublisher,
  emailService: EmailService,
  prisma: PrismaClient,
): void {
  // 1. New Appointment Created
  publisher.subscribe(EVENT_APPOINTMENT_CREATED, async (event) => {
    if (event.type !== EVENT_APPOINTMENT_CREATED) return;
    try {
      const { appointmentId } = event.payload;
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { doctor: true, patient: true },
      });

      if (!appointment || !appointment.doctor) {
        console.warn(`[AppointmentEmailListener] Could not find appointment/doctor for ID: ${appointmentId}`);
        return;
      }

      const doctorEmail = appointment.doctor.email || process.env['SMTP_USER'] || 'carzaura@gmail.com';
      const doctorName = appointment.doctor.fullName || appointment.doctor.displayName || 'Practitioner';
      const patientName = appointment.patient
        ? (appointment.patient.fullName || `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Patient')
        : 'Patient';
      const patientPhone = appointment.patient?.phone || 'N/A';

      const dateStr = appointment.startTime.toISOString().split('T')[0];
      const hours = String(appointment.startTime.getHours()).padStart(2, '0');
      const mins = String(appointment.startTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      await emailService.sendDoctorAppointmentCreatedEmail({
        to: doctorEmail,
        doctorName,
        patientName,
        patientPhone,
        appointmentDate: dateStr,
        appointmentTime: timeStr,
        durationMinutes: appointment.durationMinutes || 30,
        appointmentType: appointment.appointmentType || 'Regular Checkup',
        notes: appointment.notes || undefined,
        tenantId: appointment.tenantId,
        clinicId: appointment.clinicId,
      });

      console.info(`[AppointmentEmailListener] 📧 Enqueued doctor appointment notification email to ${doctorEmail} for appointment ${appointmentId}`);
    } catch (err) {
      console.error('[AppointmentEmailListener] Error processing EVENT_APPOINTMENT_CREATED:', err);
    }
  });

  // 2. Appointment Rescheduled
  publisher.subscribe(EVENT_APPOINTMENT_RESCHEDULED, async (event) => {
    if (event.type !== EVENT_APPOINTMENT_RESCHEDULED) return;
    try {
      const { appointmentId } = event.payload;
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { doctor: true, patient: true },
      });

      if (!appointment || !appointment.doctor) return;

      const doctorEmail = appointment.doctor.email || process.env['SMTP_USER'] || 'carzaura@gmail.com';
      const doctorName = appointment.doctor.fullName || appointment.doctor.displayName || 'Practitioner';
      const patientName = appointment.patient
        ? (appointment.patient.fullName || `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Patient')
        : 'Patient';
      const patientPhone = appointment.patient?.phone || 'N/A';

      const dateStr = appointment.startTime.toISOString().split('T')[0];
      const hours = String(appointment.startTime.getHours()).padStart(2, '0');
      const mins = String(appointment.startTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      await emailService.sendDoctorAppointmentRescheduledEmail({
        to: doctorEmail,
        doctorName,
        patientName,
        patientPhone,
        newDate: dateStr,
        newTime: timeStr,
        durationMinutes: appointment.durationMinutes || 30,
        tenantId: appointment.tenantId,
        clinicId: appointment.clinicId,
      });

      console.info(`[AppointmentEmailListener] 📧 Enqueued doctor reschedule notification email to ${doctorEmail} for appointment ${appointmentId}`);
    } catch (err) {
      console.error('[AppointmentEmailListener] Error processing EVENT_APPOINTMENT_RESCHEDULED:', err);
    }
  });

  // 3. Appointment Cancelled
  publisher.subscribe(EVENT_APPOINTMENT_CANCELLED, async (event) => {
    if (event.type !== EVENT_APPOINTMENT_CANCELLED) return;
    try {
      const { appointmentId, cancellationReason } = event.payload;
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { doctor: true, patient: true },
      });

      if (!appointment || !appointment.doctor) return;

      const doctorEmail = appointment.doctor.email || process.env['SMTP_USER'] || 'carzaura@gmail.com';
      const doctorName = appointment.doctor.fullName || appointment.doctor.displayName || 'Practitioner';
      const patientName = appointment.patient
        ? (appointment.patient.fullName || `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim() || 'Patient')
        : 'Patient';

      const dateStr = appointment.startTime.toISOString().split('T')[0];
      const hours = String(appointment.startTime.getHours()).padStart(2, '0');
      const mins = String(appointment.startTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${mins}`;

      await emailService.sendDoctorAppointmentCancelledEmail({
        to: doctorEmail,
        doctorName,
        patientName,
        appointmentDate: dateStr,
        appointmentTime: timeStr,
        reason: cancellationReason || undefined,
        tenantId: appointment.tenantId,
        clinicId: appointment.clinicId,
      });

      console.info(`[AppointmentEmailListener] 📧 Enqueued doctor cancellation notification email to ${doctorEmail} for appointment ${appointmentId}`);
    } catch (err) {
      console.error('[AppointmentEmailListener] Error processing EVENT_APPOINTMENT_CANCELLED:', err);
    }
  });
}
