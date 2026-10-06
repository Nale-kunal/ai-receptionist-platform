/**
 * Comprehensive Cross-Interface Reconciliation Verification Script
 *
 * Confirms exact single-source-of-truth reconciliation across:
 *   PostgreSQL DB === Clinic Backend Service === Admin Backend Controller
 */

import { PrismaClient } from '@prisma/client';
import { DoctorRepository } from '../modules/doctor/repositories/doctor.repository';
import { DoctorService } from '../modules/doctor/services/doctor.service';
import { UserRepository } from '../modules/authentication/repositories/user.repository';
import { UserService } from '../modules/authentication/services/user.service';

const prisma = new PrismaClient();

async function verifyCrossInterfaceReconciliation() {
  console.log('===============================================================');
  console.log('   CROSS-INTERFACE RECONCILIATION & DATA INTEGRITY VERIFIER    ');
  console.log('===============================================================');

  const tenantSlug = 'clinic-1784640947961-17';
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: { clinics: true },
  });

  if (!tenant) {
    throw new Error(`Tenant with slug "${tenantSlug}" not found.`);
  }

  const clinic = tenant.clinics[0];
  if (!clinic) {
    throw new Error(`Clinic not found for tenant ${tenant.id}`);
  }

  console.log(`[Target Clinic] "${clinic.name}" (ID: ${clinic.id}, TenantID: ${tenant.id})`);

  // 1. Direct PostgreSQL Counts
  const [
    dbActiveDoctors,
    dbTotalUsers,
    dbActiveUsers,
    dbAppointments,
    dbPatients,
  ] = await Promise.all([
    prisma.doctor.findMany({ where: { clinicId: clinic.id, deletedAt: null, status: 'active' } }),
    prisma.user.findMany({ where: { tenantId: tenant.id, deletedAt: null } }),
    prisma.user.findMany({ where: { tenantId: tenant.id, deletedAt: null, status: 'active' } }),
    prisma.appointment.findMany({ where: { clinicId: clinic.id, deletedAt: null } }),
    prisma.patient.findMany({ where: { clinicId: clinic.id, deletedAt: null } }),
  ]);

  console.log('\n--- 1. POSTGRESQL CANONICAL DB STATE ---');
  console.log(`Active Doctors:      ${dbActiveDoctors.length}`);
  dbActiveDoctors.forEach((d) => console.log(`   - [${d.id}] ${d.displayName} (${d.specialization}) - ${d.email} [${d.status}]`));
  console.log(`Active Team Users:   ${dbActiveUsers.length}`);
  dbActiveUsers.forEach((u) => console.log(`   - [${u.id}] ${u.firstName} ${u.lastName} (${u.role}) - ${u.email} [${u.status}]`));
  console.log(`Appointments:        ${dbAppointments.length}`);
  console.log(`Patients:            ${dbPatients.length}`);

  // 2. Clinic Backend Query Simulation
  const mockPublisher = { publish: async () => {} };
  const doctorRepo = new DoctorRepository(prisma);
  const doctorService = new DoctorService(doctorRepo, mockPublisher as any);

  const userRepo = new UserRepository(prisma);
  const userService = new UserService(userRepo, mockPublisher as any, prisma);

  const clinicDoctors = await doctorService.listDoctors({ tenantId: tenant.id, clinicId: clinic.id, status: 'active' as any });
  const clinicUsers = await userService.listUsers({ tenantId: tenant.id });

  console.log('\n--- 2. CLINIC BACKEND SERVICE LAYER ---');
  console.log(`Clinic Service Doctors: ${clinicDoctors.length}`);
  clinicDoctors.forEach((d) => console.log(`   - [${d.id}] ${d.displayName} (${d.specialization}) [${d.status}]`));
  console.log(`Clinic Service Users:   ${clinicUsers.length}`);
  clinicUsers.forEach((u) => console.log(`   - [${u.id}] ${u.firstName} ${u.lastName} (${u.role}) [${u.status}]`));

  // 3. Admin Backend Controller Simulation
  const adminDoctors = await prisma.doctor.findMany({
    where: { clinicId: clinic.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const adminUsers = await prisma.user.findMany({
    where: {
      tenantId: clinic.tenantId,
      deletedAt: null,
      OR: [
        { clinicId: clinic.id },
        { id: clinic.ownerId },
        { clinicId: null },
      ],
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n--- 3. ADMIN BACKEND CONTROLLER LAYER ---');
  console.log(`Admin API Doctors:      ${adminDoctors.length}`);
  adminDoctors.forEach((d) => console.log(`   - [${d.id}] ${d.displayName} (${d.specialization}) - ${d.email} [${d.status}]`));
  console.log(`Admin API Users:        ${adminUsers.length}`);
  adminUsers.forEach((u) => console.log(`   - [${u.id}] ${u.firstName} ${u.lastName} (${u.role}) - ${u.email} [${u.status}]`));

  // 4. Assert Invariants
  console.log('\n--- 4. CROSS-INTERFACE INVARIANT CHECKS ---');

  const check1 = dbActiveDoctors.length === clinicDoctors.length && clinicDoctors.length === adminDoctors.length;
  console.log(`[CHECK 1] Doctor Count Invariant (DB: ${dbActiveDoctors.length} == Clinic: ${clinicDoctors.length} == Admin: ${adminDoctors.length}): ${check1 ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!check1) throw new Error('Doctor count mismatch across layers!');

  const check2 = dbTotalUsers.length === clinicUsers.length && clinicUsers.length === adminUsers.length;
  console.log(`[CHECK 2] User Count Invariant (DB: ${dbTotalUsers.length} == Clinic: ${clinicUsers.length} == Admin: ${adminUsers.length}): ${check2 ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!check2) throw new Error('User count mismatch across layers!');

  const check3 = adminDoctors.length === 1 && adminDoctors[0].displayName === 'Dr. Kunal nale';
  console.log(`[CHECK 3] Canonical Doctor Identity: ${check3 ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!check3) throw new Error('Canonical Doctor identity mismatch!');

  const check4 = adminUsers.length === 1 && adminUsers[0].role === 'clinic_owner';
  console.log(`[CHECK 4] Practice Owner Distinction: ${check4 ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!check4) throw new Error('Practice Owner role distinction mismatch!');

  const check5 = dbAppointments.length === 7 && dbAppointments.every((a) => a.doctorId === adminDoctors[0].id);
  console.log(`[CHECK 5] All 7 Appointments Bound to Canonical Doctor: ${check5 ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (!check5) throw new Error('Appointments doctor relation mismatch!');

  console.log('\n===============================================================');
  console.log('   ALL INVARIANTS PERFECTLY VERIFIED & AUTHORITATIVE IN DB     ');
  console.log('===============================================================');
}

verifyCrossInterfaceReconciliation()
  .catch((err) => {
    console.error('[Error] Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
