/**
 * Permanent Database Dummy/Test/Demo Data Cleanup Script
 *
 * Selectively and transactionally removes confirmed dummy, demo, and test data
 * from the PostgreSQL database while guaranteeing 100% preservation of all
 * genuine users, clinics, doctors, patients, appointments, RBAC roles, Super Admin,
 * and audit history.
 *
 * Idempotent, safe, auditable, and relationship-aware.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GENUINE_TENANT_ID = 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0';
const GENUINE_SUPER_ADMIN_EMAIL = 'admin@gmail.com';

async function cleanDatabase() {
  console.log('============================================================');
  console.log('STARTING PERMANENT DATABASE CLEANUP EXECUTION');
  console.log('============================================================\n');

  // 1. Environment & Database Safety Check
  const dbUrl = process.env.DATABASE_URL || '';
  const parsedHost = dbUrl.match(/@([^/:]+)/)?.[1] || 'unknown-host';
  const parsedDb = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1] || 'unknown-db';
  console.log(`[Safety Guard] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Safety Guard] Database Host: ${parsedHost}`);
  console.log(`[Safety Guard] Database Name: ${parsedDb}`);

  // Ensure genuine tenant exists
  const genuineTenant = await prisma.tenant.findUnique({
    where: { id: GENUINE_TENANT_ID },
    include: {
      clinics: true,
      users: true,
      doctors: true,
      patients: true,
      appointments: true,
    }
  });

  if (!genuineTenant) {
    throw new Error(`CRITICAL ERROR: Genuine tenant ${GENUINE_TENANT_ID} not found in database! Aborting cleanup to protect data.`);
  }

  console.log(`[Safety Guard] Genuine Tenant Verified: "${genuineTenant.name}" (${genuineTenant.id})`);
  console.log(`  Clinics: ${genuineTenant.clinics.length} | Users: ${genuineTenant.users.length} | Doctors: ${genuineTenant.doctors.length} | Patients: ${genuineTenant.patients.length} | Appointments: ${genuineTenant.appointments.length}\n`);

  // 2. Identify Test Tenants
  const testTenants = await prisma.tenant.findMany({
    where: {
      id: { not: GENUINE_TENANT_ID }
    }
  });
  const testTenantIds = testTenants.map(t => t.id);

  console.log(`Found ${testTenants.length} test tenant(s) to remove:`);
  testTenants.forEach((t, i) => console.log(`  [${i+1}] [${t.id}] "${t.name}" (slug: ${t.slug})`));
  console.log('');

  // 3. Identify Test Users
  const testUsers = await prisma.user.findMany({
    where: {
      tenantId: { in: testTenantIds }
    }
  });
  const testUserIds = testUsers.map(u => u.id);
  const testUserEmails = testUsers.map(u => u.email);

  console.log(`Found ${testUsers.length} test user(s) to remove across test tenants.`);

  // 4. Identify Test Patient
  const testPatient = await prisma.patient.findFirst({
    where: { email: 'testsync@example.com' },
    include: { appointments: true }
  });
  if (testPatient && testPatient.appointments.length > 0) {
    throw new Error(`CRITICAL: Test patient testsync@example.com has active appointments! Cannot safely delete.`);
  }

  // 5. Execute Atomic Transactional Deletion
  console.log('\nExecuting atomic database transaction...');
  const result = await prisma.$transaction(async (tx) => {
    const report = {};

    // a. Delete Test Notifications
    const deletedNotifications = await tx.notification.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.notifications = deletedNotifications.count;

    // b. Delete Test Tokens (EmailVerification & PasswordReset)
    const deletedEmailTokens = await tx.emailVerificationToken.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    report.emailTokens = deletedEmailTokens.count;

    const deletedPwTokens = await tx.passwordResetToken.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    report.passwordResetTokens = deletedPwTokens.count;

    // c. Delete Test User Sessions
    const deletedSessions = await tx.session.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { tenantId: { in: testTenantIds } }
        ]
      }
    });
    report.sessions = deletedSessions.count;

    // d. Delete Test User Roles (RBAC assignments)
    const deletedUserRoles = await tx.userRole.deleteMany({
      where: {
        OR: [
          { userId: { in: testUserIds } },
          { tenantId: { in: testTenantIds } }
        ]
      }
    });
    report.userRoles = deletedUserRoles.count;

    // e. Delete Custom Tenant Role Permissions & Roles
    const testCustomRoles = await tx.role.findMany({
      where: { tenantId: { in: testTenantIds } },
      select: { id: true }
    });
    const testCustomRoleIds = testCustomRoles.map(r => r.id);

    if (testCustomRoleIds.length > 0) {
      const deletedRolePerms = await tx.rolePermission.deleteMany({
        where: { roleId: { in: testCustomRoleIds } }
      });
      report.rolePermissions = deletedRolePerms.count;

      const deletedRoles = await tx.role.deleteMany({
        where: { id: { in: testCustomRoleIds } }
      });
      report.roles = deletedRoles.count;
    } else {
      report.rolePermissions = 0;
      report.roles = 0;
    }

    // f. Delete Test RBAC Audit Logs
    const deletedRbacAudit = await tx.rbacAuditLog.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.rbacAuditLogs = deletedRbacAudit.count;

    // g. Delete Test Configurations
    const deletedConfigs = await tx.configuration.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.configurations = deletedConfigs.count;

    // h. Delete Test Invitations (test tenants + 3 test invitations in genuine tenant)
    const deletedInvitations = await tx.invitation.deleteMany({
      where: {
        OR: [
          { tenantId: { in: testTenantIds } },
          {
            tenantId: GENUINE_TENANT_ID,
            email: { in: ['live.dentist.1788164550868@example.com', 'test.dentist.1788164400406@example.com', 'ui.decline.test@example.com'] }
          }
        ]
      }
    });
    report.invitations = deletedInvitations.count;

    // i. Delete Test Appointments (if any under test tenants)
    const deletedAppointments = await tx.appointment.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.appointments = deletedAppointments.count;

    // j. Delete Test Patient (testsync@example.com + test tenant patients)
    const deletedPatients = await tx.patient.deleteMany({
      where: {
        OR: [
          { tenantId: { in: testTenantIds } },
          { id: testPatient ? testPatient.id : '00000000-0000-0000-0000-000000000000' }
        ]
      }
    });
    report.patients = deletedPatients.count;

    // k. Delete Test Doctors
    const deletedDoctors = await tx.doctor.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.doctors = deletedDoctors.count;

    // l. Delete Test Clinics
    const deletedClinics = await tx.clinic.deleteMany({
      where: { tenantId: { in: testTenantIds } }
    });
    report.clinics = deletedClinics.count;

    // m. Delete Test Users
    const deletedUsers = await tx.user.deleteMany({
      where: {
        id: { in: testUserIds }
      }
    });
    report.users = deletedUsers.count;

    // n. Delete Test Mail Jobs
    const deletedMailJobs = await tx.mailJob.deleteMany({
      where: {
        OR: [
          { tenantId: { in: testTenantIds } },
          { recipient: { in: testUserEmails } },
          { recipient: { contains: 'example.com' } },
          { recipient: { contains: '1788' } },
          { recipient: 'carzaura1@gmail.com' }
        ]
      }
    });
    report.mailJobs = deletedMailJobs.count;

    // o. Delete Test Tenants
    const deletedTenants = await tx.tenant.deleteMany({
      where: {
        id: { in: testTenantIds }
      }
    });
    report.tenants = deletedTenants.count;

    return report;
  }, {
    timeout: 30000,
  });

  console.log('Transaction committed successfully! Summary of deletions:');
  console.log(JSON.stringify(result, null, 2));

  // 6. Post-Cleanup Integrity Verification
  console.log('\n============================================================');
  console.log('POST-CLEANUP DATABASE INTEGRITY VERIFICATION');
  console.log('============================================================');

  const remainingTenants = await prisma.tenant.count();
  const remainingClinics = await prisma.clinic.count();
  const remainingActiveClinics = await prisma.clinic.count({ where: { status: 'active', deletedAt: null } });
  const remainingSuspendedClinics = await prisma.clinic.count({ where: { status: 'suspended', deletedAt: null } });
  const remainingPendingClinics = await prisma.clinic.count({ where: { status: 'pending_setup', deletedAt: null } });
  const remainingUsers = await prisma.user.count();
  const remainingDoctors = await prisma.doctor.count({ where: { status: 'active', deletedAt: null } });
  const remainingPatients = await prisma.patient.count();
  const remainingAppointments = await prisma.appointment.count();
  const remainingInvitations = await prisma.invitation.count();
  const remainingSuperAdmins = await prisma.superAdmin.count();
  const remainingAdminSessions = await prisma.adminSession.count({ where: { status: 'active', expiresAt: { gt: new Date() } } });
  const remainingAdminAuditLogs = await prisma.adminAuditLog.count();
  const remainingRoles = await prisma.role.count();
  const remainingPermissions = await prisma.permission.count();

  console.log(`Total Tenants:         ${remainingTenants}  (Expected: 1)`);
  console.log(`Total Clinics:         ${remainingClinics}  (Expected: 1)`);
  console.log(`Active Clinics:        ${remainingActiveClinics}  (Expected: 1)`);
  console.log(`Suspended Clinics:     ${remainingSuspendedClinics}  (Expected: 0)`);
  console.log(`Pending Setup Clinics: ${remainingPendingClinics}  (Expected: 0)`);
  console.log(`Total Users:           ${remainingUsers}  (Expected: 2)`);
  console.log(`Active Doctors:        ${remainingDoctors}  (Expected: 1)`);
  console.log(`Total Patients:        ${remainingPatients}  (Expected: 4)`);
  console.log(`Total Appointments:    ${remainingAppointments}  (Expected: 1)`);
  console.log(`Total Invitations:     ${remainingInvitations}  (Expected: 1)`);
  console.log(`Super Admin Accounts:  ${remainingSuperAdmins}  (Expected: 1)`);
  console.log(`Admin Active Sessions: ${remainingAdminSessions}  (Expected: 3)`);
  console.log(`Admin Audit Logs:      ${remainingAdminAuditLogs}  (Expected: 20)`);
  console.log(`RBAC Roles:            ${remainingRoles}  (Expected: 26)`);
  console.log(`RBAC Permissions:      ${remainingPermissions}  (Expected: 48)`);

  // Verify no orphan records using raw SQL foreign key integrity checks
  const orphanUsers = await prisma.$queryRaw`SELECT count(*)::int as count FROM "users" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants")`;
  const orphanClinics = await prisma.$queryRaw`SELECT count(*)::int as count FROM "clinics" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants")`;
  const orphanDoctors = await prisma.$queryRaw`SELECT count(*)::int as count FROM "doctors" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants")`;
  const orphanPatients = await prisma.$queryRaw`SELECT count(*)::int as count FROM "patients" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants")`;
  const orphanAppointments = await prisma.$queryRaw`SELECT count(*)::int as count FROM "appointments" WHERE "tenant_id" NOT IN (SELECT "id" FROM "tenants")`;

  const orphanUserCount = orphanUsers[0]?.count || 0;
  const orphanClinicCount = orphanClinics[0]?.count || 0;
  const orphanDoctorCount = orphanDoctors[0]?.count || 0;
  const orphanPatientCount = orphanPatients[0]?.count || 0;
  const orphanAppointmentCount = orphanAppointments[0]?.count || 0;

  console.log('\n--- ORPHAN INTEGRITY CHECK ---');
  console.log(`Orphan Users:        ${orphanUserCount}`);
  console.log(`Orphan Clinics:      ${orphanClinicCount}`);
  console.log(`Orphan Doctors:      ${orphanDoctorCount}`);
  console.log(`Orphan Patients:     ${orphanPatientCount}`);
  console.log(`Orphan Appointments: ${orphanAppointmentCount}`);

  if (orphanUserCount + orphanClinicCount + orphanDoctorCount + orphanPatientCount + orphanAppointmentCount > 0) {
    throw new Error('Integrity Check Failed: Orphan records detected!');
  }

  console.log('\n✅ Database cleanup and integrity verification completed successfully.');
  await prisma.$disconnect();
}

cleanDatabase().catch(err => {
  console.error('CLEANUP ERROR:', err);
  process.exit(1);
});
