const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('=== FULL DATABASE RECORD INSPECTION ===\n');

  // 1. Tenants
  const tenants = await prisma.tenant.findMany({
    include: {
      clinics: true,
      users: { select: { id: true, email: true, role: true, firstName: true, lastName: true, createdAt: true } },
      doctors: { select: { id: true, fullName: true, email: true, status: true, createdAt: true } },
      patients: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true } },
      appointments: { select: { id: true, status: true, startTime: true, endTime: true, createdAt: true } },
      invitations: true,
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`--- ALL TENANTS (${tenants.length}) ---`);
  tenants.forEach((t, i) => {
    console.log(`[${i+1}] Tenant ID: ${t.id} | Name: "${t.name}" | Slug: "${t.slug}" | Status: ${t.status} | CreatedAt: ${t.createdAt.toISOString()} | DeletedAt: ${t.deletedAt}`);
    console.log(`    Users (${t.users.length}):`, t.users.map(u => `${u.email} [${u.role}]`));
    console.log(`    Clinics (${t.clinics.length}):`, t.clinics.map(c => `[${c.id}] ${c.name} (${c.status})`));
    console.log(`    Doctors (${t.doctors.length}):`, t.doctors.map(d => `${d.fullName} <${d.email}>`));
    console.log(`    Patients (${t.patients.length}):`, t.patients.map(p => `${p.email} (${p.phone})`));
    console.log(`    Appointments (${t.appointments.length}):`, t.appointments.map(a => `${a.status}`));
    console.log(`    Invitations (${t.invitations.length}):`, t.invitations.map(inv => `${inv.email} (${inv.status})`));
    console.log('');
  });

  // 2. Clinics
  const clinics = await prisma.clinic.findMany({
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      doctors: { select: { id: true, fullName: true, email: true } },
      staff: { select: { id: true, email: true, role: true } },
    }
  });
  console.log(`--- ALL CLINICS (${clinics.length}) ---`);
  for (const c of clinics) {
    console.log(`Clinic ID: ${c.id} | Name: "${c.name}" | Slug: "${c.slug}" | Status: ${c.status} | Tenant: ${c.tenant?.name} (${c.tenantId}) | Created: ${c.createdAt.toISOString()} | DeletedAt: ${c.deletedAt}`);
  }
  console.log('');

  // 3. Doctors
  const doctors = await prisma.doctor.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
    }
  });
  console.log(`--- ALL DOCTORS (${doctors.length}) ---`);
  for (const d of doctors) {
    console.log(`Doctor ID: ${d.id} | Name: ${d.fullName} | Email: ${d.email} | Status: ${d.status} | Tenant: ${d.tenant?.name} | Clinic: ${d.clinic?.name} | Created: ${d.createdAt.toISOString()}`);
  }
  console.log('');

  // 4. Patients
  const patients = await prisma.patient.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
    }
  });
  console.log(`--- ALL PATIENTS (${patients.length}) ---`);
  for (const p of patients) {
    console.log(`Patient ID: ${p.id} | Name: ${p.firstName} ${p.lastName} | Email: ${p.email} | Phone: ${p.phone} | Tenant: ${p.tenant?.name} | Clinic: ${p.clinic?.name} | Created: ${p.createdAt.toISOString()}`);
  }
  console.log('');

  // 5. Appointments
  const appointments = await prisma.appointment.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
      doctor: { select: { id: true, fullName: true } },
      patient: { select: { id: true, firstName: true, lastName: true } },
    }
  });
  console.log(`--- ALL APPOINTMENTS (${appointments.length}) ---`);
  for (const a of appointments) {
    console.log(`Appointment ID: ${a.id} | Status: ${a.status} | Start: ${a.startTime.toISOString()} - End: ${a.endTime.toISOString()} | Doctor: ${a.doctor?.fullName} | Patient: ${a.patient?.firstName} ${a.patient?.lastName} | Tenant: ${a.tenant?.name} | Created: ${a.createdAt.toISOString()}`);
  }
  console.log('');

  // 6. Invitations
  const invitations = await prisma.invitation.findMany({
    include: {
      tenant: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, email: true } },
    }
  });
  console.log(`--- ALL INVITATIONS (${invitations.length}) ---`);
  for (const inv of invitations) {
    console.log(`Invitation ID: ${inv.id} | Email: ${inv.email} | Role: ${inv.role} | Status: ${inv.status} | Tenant: ${inv.tenant?.name} (${inv.tenantId}) | Inviter: ${inv.invitedBy?.email} | Created: ${inv.createdAt.toISOString()}`);
  }
  console.log('');

  // 7. WhatsApp
  const whatsappIntegrations = await prisma.whatsAppIntegration.findMany();
  console.log(`--- WHATSAPP INTEGRATIONS (${whatsappIntegrations.length}) ---`);
  for (const wi of whatsappIntegrations) {
    console.log(`WhatsAppIntegration ID: ${wi.id} | TenantId: ${wi.tenantId} | ClinicId: ${wi.clinicId} | Phone: ${wi.phoneNumber} | Enabled: ${wi.isEnabled}`);
  }
  console.log('');

  // 8. Super Admin & Admin Sessions
  const superAdmins = await prisma.superAdmin.findMany();
  console.log(`--- SUPER ADMINS (${superAdmins.length}) ---`);
  for (const sa of superAdmins) {
    console.log(`SuperAdmin ID: ${sa.id} | Email: ${sa.email} | DisplayName: ${sa.displayName} | Active: ${sa.isActive}`);
  }
  console.log('');

  const adminSessions = await prisma.adminSession.findMany({
    include: { admin: { select: { email: true } } }
  });
  console.log(`--- ADMIN SESSIONS (${adminSessions.length}) ---`);
  for (const as of adminSessions) {
    console.log(`AdminSession ID: ${as.id} | Admin: ${as.admin?.email} | Status: ${as.status} | IP: ${as.ipAddress} | UserAgent: ${as.userAgent} | ExpiresAt: ${as.expiresAt.toISOString()} | Created: ${as.createdAt.toISOString()}`);
  }
  console.log('');

  // 9. All Tables Count
  const tables = [
    'tenant', 'user', 'session', 'passwordResetToken', 'emailVerificationToken',
    'invitation', 'role', 'permission', 'rolePermission', 'userRole',
    'rbacAuditLog', 'configuration', 'clinic', 'doctor', 'patient',
    'appointment', 'conversation', 'notification', 'mailJob',
    'calendarConnection', 'calendarEventMapping', 'calendarSyncLog',
    'aiAuditLog', 'promptTemplate', 'promptAuditLog', 'faq',
    'whatsAppIntegration', 'whatsAppJob', 'whatsAppMessage', 'whatsAppWebhookEvent',
    'superAdmin', 'adminSession', 'adminAuditLog'
  ];

  console.log('--- ALL TABLE ROW COUNTS ---');
  for (const t of tables) {
    try {
      const count = await prisma[t].count();
      console.log(`${t}: ${count}`);
    } catch (e) {
      console.log(`${t}: ERROR (${e.message})`);
    }
  }

  await prisma.$disconnect();
}

inspect().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
