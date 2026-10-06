/**
 * Database Reconciliation Script
 *
 * Safely removes the spurious duplicate Doctor record created for the Practice Owner,
 * ensuring all canonical doctor records and appointment relations are preserved.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function reconcileDoctorData() {
  console.log('=== STARTING DATABASE RECONCILIATION ===');

  const spuriousDocId = '6449646c-76b1-4e7a-b5bb-3e9b4048393a';
  const canonicalDocId = '63b7952f-2f5d-433e-affc-c198a2348c23';

  // 1. Verify existing records
  const spuriousDoc = await prisma.doctor.findUnique({
    where: { id: spuriousDocId },
    include: {
      _count: {
        select: {
          appointments: true,
          conversations: true,
          calendarConnections: true,
        },
      },
    },
  });

  const canonicalDoc = await prisma.doctor.findUnique({
    where: { id: canonicalDocId },
    include: {
      _count: {
        select: {
          appointments: true,
          conversations: true,
          calendarConnections: true,
        },
      },
    },
  });

  if (!spuriousDoc) {
    console.log(`[Info] Spurious doctor ${spuriousDocId} does not exist in DB (already cleaned).`);
  } else {
    console.log(`[Found] Spurious Doctor (${spuriousDoc.id}):`, {
      fullName: spuriousDoc.fullName,
      email: spuriousDoc.email,
      appointments: spuriousDoc._count.appointments,
      conversations: spuriousDoc._count.conversations,
      calendarConnections: spuriousDoc._count.calendarConnections,
    });

    if (
      spuriousDoc._count.appointments > 0 ||
      spuriousDoc._count.conversations > 0 ||
      spuriousDoc._count.calendarConnections > 0
    ) {
      throw new Error(
        `Safety Check Failed: Spurious doctor has active references! Refusing to delete.`,
      );
    }
  }

  if (canonicalDoc) {
    console.log(`[Found] Canonical Doctor (${canonicalDoc.id}):`, {
      fullName: canonicalDoc.fullName,
      email: canonicalDoc.email,
      appointments: canonicalDoc._count.appointments,
      status: canonicalDoc.status,
    });
  }

  // 2. Perform atomic transactional cleanup
  await prisma.$transaction(async (tx) => {
    if (spuriousDoc) {
      console.log(`[Reconciling] Removing spurious doctor record ${spuriousDocId}...`);
      await tx.doctor.delete({
        where: { id: spuriousDocId },
      });
      console.log(`[Success] Spurious doctor ${spuriousDocId} removed.`);
    }

    if (canonicalDoc) {
      // Ensure canonical doctor is active with clean status
      await tx.doctor.update({
        where: { id: canonicalDocId },
        data: {
          status: 'active',
          deletedAt: null,
          updatedAt: new Date(),
        },
      });
      console.log(`[Success] Canonical doctor ${canonicalDocId} confirmed active.`);
    }
  });

  // 3. Post-cleanup validation
  const postDoctors = await prisma.doctor.findMany({
    where: { clinicId: '1ce9a5ca-c4e0-499f-9ff2-38daa674eb87', deletedAt: null },
    select: { id: true, fullName: true, displayName: true, email: true, status: true },
  });

  const postAppointments = await prisma.appointment.count({
    where: { clinicId: '1ce9a5ca-c4e0-499f-9ff2-38daa674eb87', deletedAt: null },
  });

  console.log('=== RECONCILIATION SUMMARY ===');
  console.log(`Remaining Active Doctors for Clinic: ${postDoctors.length}`, postDoctors);
  console.log(`Total Active Appointments for Clinic: ${postAppointments}`);

  if (postDoctors.length !== 1) {
    throw new Error(`Expected exactly 1 active doctor, found ${postDoctors.length}`);
  }
  if (postAppointments !== 7) {
    throw new Error(`Expected all 7 appointments preserved, found ${postAppointments}`);
  }

  console.log('=== DATABASE RECONCILIATION COMPLETE & VERIFIED ===');
}

if (require.main === module) {
  reconcileDoctorData()
    .catch((err) => {
      console.error('[Error] Reconciliation failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
