/**
 * Single Authoritative Overlap Engine
 * Enforces identical overlap detection across Booking, Rescheduling, Availability, AI Receptionist, and Voice AI APIs.
 */

import type { PrismaClient } from '@prisma/client';

export const ACTIVE_APPOINTMENT_STATUSES = [
  'scheduled',
  'pending',
  'confirmed',
  'rescheduled',
  'checked_in',
  'in_progress',
];

export interface OverlapCheckParams {
  tenantId: string;
  doctorId: string;
  clinicId?: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}

/**
 * SINGLE AUTHORITATIVE OVERLAP FUNCTION FOR THE ENTIRE SAAS PLATFORM.
 * Called identically by Booking API, Reschedule API, Availability API, AI Receptionist, Voice AI.
 */
export async function checkAppointmentOverlap(
  prisma: PrismaClient,
  params: OverlapCheckParams
): Promise<{ hasConflict: boolean; conflictingAppointment?: any }> {
  const { tenantId, doctorId, clinicId, startTime, endTime, excludeAppointmentId } = params;

  const conflicts = await prisma.appointment.findMany({
    where: {
      ...(tenantId && tenantId.trim() !== '' ? { tenantId } : {}),
      doctorId,
      ...(clinicId ? { clinicId } : {}),
      deletedAt: null,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      // Mathematical overlap condition: existing.startTime < candidateEndTime AND existing.endTime > candidateStartTime
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    take: 1,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      status: true,
      patient: { select: { fullName: true } },
    },
  });

  if (conflicts.length > 0) {
    return { hasConflict: true, conflictingAppointment: conflicts[0] };
  }

  return { hasConflict: false };
}
