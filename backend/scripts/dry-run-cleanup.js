const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GENUINE_TENANT_ID = 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0';

async function dryRun() {
  console.log('============================================================');
  console.log('DRY RUN: DUMMY / DEMO / TEST DATA CLEANUP INVENTORY');
  console.log('============================================================\n');

  // 1. Environment & Database Safety Check
  const dbUrl = process.env.DATABASE_URL || '';
  const parsedHost = dbUrl.match(/@([^/:]+)/)?.[1] || 'unknown-host';
  const parsedDb = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1] || 'unknown-db';
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database Host: ${parsedHost}`);
  console.log(`Database Name: ${parsedDb}`);
  console.log('------------------------------------------------------------\n');

  // 2. Tenants Breakdown
  const totalTenants = await prisma.tenant.count();
  const dummyTenants = await prisma.tenant.findMany({
    where: {
      id: { not: GENUINE_TENANT_ID }
    },
    orderBy: { createdAt: 'asc' }
  });
  const genuineTenants = await prisma.tenant.findMany({ where: { id: GENUINE_TENANT_ID } });
  const dummyTenantIds = dummyTenants.map(t => t.id);

  console.log(`TOTAL TENANTS INSPECTED: ${totalTenants}`);
  console.log(`  Dummy/Test Tenants to Remove: ${dummyTenants.length}`);
  dummyTenants.forEach((t, i) => console.log(`    [${i+1}] [${t.id}] "${t.name}" (slug: ${t.slug}, status: ${t.status}, created: ${t.createdAt.toISOString()})`));
  console.log(`  Genuine Tenants to Preserve: ${genuineTenants.length}`);
  genuineTenants.forEach(t => console.log(`    - [${t.id}] "${t.name}" (slug: ${t.slug}, status: ${t.status}, created: ${t.createdAt.toISOString()})`));
  console.log('');

  // 3. Clinics Breakdown
  const totalClinics = await prisma.clinic.count();
  const dummyClinics = await prisma.clinic.findMany({ where: { tenantId: { in: dummyTenantIds } } });
  const genuineClinics = await prisma.clinic.findMany({ where: { tenantId: GENUINE_TENANT_ID } });

  console.log(`TOTAL CLINICS INSPECTED: ${totalClinics}`);
  console.log(`  Dummy/Test Clinics to Remove: ${dummyClinics.length}`);
  dummyClinics.forEach(c => console.log(`    - [${c.id}] "${c.name}" (status: ${c.status}, slug: ${c.slug})`));
  console.log(`  Genuine Clinics to Preserve: ${genuineClinics.length}`);
  genuineClinics.forEach(c => console.log(`    - [${c.id}] "${c.name}" (status: ${c.status}, slug: ${c.slug})`));
  console.log('');

  // 4. Users Breakdown
  const totalUsers = await prisma.user.count();
  const dummyUsers = await prisma.user.findMany({ where: { tenantId: { in: dummyTenantIds } } });
  const genuineUsers = await prisma.user.findMany({ where: { tenantId: GENUINE_TENANT_ID } });

  console.log(`TOTAL USERS INSPECTED: ${totalUsers}`);
  console.log(`  Dummy/Test Users to Remove: ${dummyUsers.length}`);
  console.log(`  Genuine Users to Preserve: ${genuineUsers.length}`);
  genuineUsers.forEach(u => console.log(`    - [${u.id}] ${u.email} (${u.role}, created: ${u.createdAt.toISOString()})`));
  console.log('');

  // 5. Doctors Breakdown
  const totalDoctors = await prisma.doctor.count();
  const dummyDoctors = await prisma.doctor.findMany({ where: { tenantId: { in: dummyTenantIds } } });
  const genuineDoctors = await prisma.doctor.findMany({ where: { tenantId: GENUINE_TENANT_ID } });

  console.log(`TOTAL DOCTORS INSPECTED: ${totalDoctors}`);
  console.log(`  Dummy/Test Doctors to Remove: ${dummyDoctors.length}`);
  console.log(`  Genuine Doctors to Preserve: ${genuineDoctors.length}`);
  genuineDoctors.forEach(d => console.log(`    - [${d.id}] ${d.fullName} <${d.email}> (${d.status})`));
  console.log('');

  // 6. Patients Breakdown
  const totalPatients = await prisma.patient.count();
  const dummyPatients = await prisma.patient.findMany({
    where: {
      OR: [
        { tenantId: { in: dummyTenantIds } },
        { email: 'testsync@example.com' }
      ]
    }
  });
  const genuinePatients = await prisma.patient.findMany({
    where: {
      tenantId: GENUINE_TENANT_ID,
      email: { not: 'testsync@example.com' }
    }
  });

  console.log(`TOTAL PATIENTS INSPECTED: ${totalPatients}`);
  console.log(`  Dummy/Test Patients to Remove: ${dummyPatients.length}`);
  dummyPatients.forEach(p => console.log(`    - [${p.id}] ${p.fullName || p.email} <${p.email}> (${p.phone}) -> Origin: admin-appointment-sync.test.ts`));
  console.log(`  Genuine Patients to Preserve: ${genuinePatients.length}`);
  genuinePatients.forEach(p => console.log(`    - [${p.id}] <${p.email}> (${p.phone})`));
  console.log('');

  // 7. Appointments Breakdown
  const totalAppointments = await prisma.appointment.count();
  const dummyAppointments = await prisma.appointment.findMany({ where: { tenantId: { in: dummyTenantIds } } });
  const genuineAppointments = await prisma.appointment.findMany({ where: { tenantId: GENUINE_TENANT_ID } });

  console.log(`TOTAL APPOINTMENTS INSPECTED: ${totalAppointments}`);
  console.log(`  Dummy/Test Appointments to Remove: ${dummyAppointments.length}`);
  console.log(`  Genuine Appointments to Preserve: ${genuineAppointments.length}`);
  genuineAppointments.forEach(a => console.log(`    - [${a.id}] status: ${a.status}, start: ${a.startTime.toISOString()}`));
  console.log('');

  // 8. Invitations Breakdown
  const totalInvitations = await prisma.invitation.count();
  const dummyInvitations = await prisma.invitation.findMany({
    where: {
      OR: [
        { tenantId: { in: dummyTenantIds } },
        { email: { in: ['live.dentist.1788164550868@example.com', 'test.dentist.1788164400406@example.com', 'ui.decline.test@example.com'] } }
      ]
    }
  });
  const genuineInvitations = await prisma.invitation.findMany({
    where: {
      tenantId: GENUINE_TENANT_ID,
      email: { notIn: ['live.dentist.1788164550868@example.com', 'test.dentist.1788164400406@example.com', 'ui.decline.test@example.com'] }
    }
  });

  console.log(`TOTAL INVITATIONS INSPECTED: ${totalInvitations}`);
  console.log(`  Dummy/Test Invitations to Remove: ${dummyInvitations.length}`);
  dummyInvitations.forEach(i => console.log(`    - [${i.id}] ${i.email} (status: ${i.status})`));
  console.log(`  Genuine Invitations to Preserve: ${genuineInvitations.length}`);
  genuineInvitations.forEach(i => console.log(`    - [${i.id}] ${i.email} (status: ${i.status})`));
  console.log('');

  // 9. RBAC Roles & Permissions
  const systemGlobalRoles = await prisma.role.findMany({ where: { tenantId: null } });
  const genuineTenantRoles = await prisma.role.findMany({ where: { tenantId: GENUINE_TENANT_ID } });
  const dummyTenantRoles = await prisma.role.findMany({ where: { tenantId: { in: dummyTenantIds } } });

  console.log(`TOTAL ROLES: ${await prisma.role.count()}`);
  console.log(`  System Global Roles to Preserve: ${systemGlobalRoles.length}`);
  console.log(`  Genuine Tenant Roles to Preserve: ${genuineTenantRoles.length}`);
  console.log(`  Dummy Tenant Roles to Remove: ${dummyTenantRoles.length}`);
  console.log(`TOTAL PERMISSIONS: ${await prisma.permission.count()} (All Preserved)`);
  console.log('');

  // 10. Super Admin & Admin Sessions & Admin Audit Logs
  const superAdmin = await prisma.superAdmin.findFirst();
  const adminSessions = await prisma.adminSession.findMany();
  const adminAuditLogs = await prisma.adminAuditLog.findMany();

  console.log(`SUPER ADMIN: [${superAdmin?.id}] ${superAdmin?.email} (${superAdmin?.displayName}) -> PRESERVED`);
  console.log(`ADMIN SESSIONS: ${adminSessions.length} total (3 active & non-expired) -> ALL PRESERVED`);
  console.log(`ADMIN AUDIT LOGS: ${adminAuditLogs.length} total -> ALL PRESERVED`);
  console.log('');

  // 11. MailJobs & Notifications
  const dummyMailJobs = await prisma.mailJob.findMany({
    where: {
      OR: [
        { tenantId: { in: dummyTenantIds } },
        { recipient: { contains: 'example.com' } },
        { recipient: { contains: '1788' } },
        { recipient: 'carzaura1@gmail.com' }
      ]
    }
  });
  const genuineMailJobs = await prisma.mailJob.findMany({
    where: {
      id: { notIn: dummyMailJobs.map(m => m.id) }
    }
  });

  console.log(`TOTAL MAIL JOBS: ${await prisma.mailJob.count()}`);
  console.log(`  Dummy Mail Jobs to Remove: ${dummyMailJobs.length}`);
  console.log(`  Genuine Mail Jobs to Preserve: ${genuineMailJobs.length}`);
  genuineMailJobs.forEach(m => console.log(`    - [${m.id}] To: ${m.recipient} | Subject: "${m.subject}"`));
  console.log('');

  const dummyNotifications = await prisma.notification.findMany({ where: { tenantId: { in: dummyTenantIds } } });
  const genuineNotifications = await prisma.notification.findMany({ where: { tenantId: GENUINE_TENANT_ID } });
  console.log(`TOTAL NOTIFICATIONS: ${await prisma.notification.count()}`);
  console.log(`  Dummy Notifications to Remove: ${dummyNotifications.length}`);
  console.log(`  Genuine Notifications to Preserve: ${genuineNotifications.length}`);
  console.log('');

  // 12. Projected Super Admin Dashboard Numbers After Cleanup:
  console.log('============================================================');
  console.log('PROJECTED SUPER ADMIN DASHBOARD NUMBERS AFTER CLEANUP');
  console.log('============================================================');
  console.log(`Total Tenants:         ${genuineTenants.length}  (was ${totalTenants})`);
  console.log(`Total Clinics:         ${genuineClinics.length}  (was ${totalClinics})`);
  console.log(`Active Clinics:        ${genuineClinics.filter(c => c.status === 'active').length}  (was 1)`);
  console.log(`Suspended Clinics:     ${genuineClinics.filter(c => c.status === 'suspended').length}  (was 1)`);
  console.log(`Pending Setup Clinics: ${genuineClinics.filter(c => c.status === 'pending_setup').length}  (was 2)`);
  console.log(`Total Clinic Users:    ${genuineUsers.length}  (was ${totalUsers})`);
  console.log(`Active Doctors:        ${genuineDoctors.filter(d => d.status === 'active').length}  (was ${totalDoctors})`);
  console.log(`Total Patients:        ${genuinePatients.length}  (was ${totalPatients})`);
  console.log(`Total Appointments:    ${genuineAppointments.length}  (was ${totalAppointments})`);
  console.log(`WhatsApp Channels:     0  (was 0)`);
  console.log(`Admin Active Sessions: 3  (was 3)`);
  console.log('============================================================\n');

  await prisma.$disconnect();
}

dryRun().catch(console.error);
