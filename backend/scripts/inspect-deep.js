const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectDeep() {
  console.log('=== DEEP INSPECTION OF TENANT 1 & TEST ENTITIES ===\n');

  // Inspect Tenant 1 Patients in detail
  const t1Patients = await prisma.patient.findMany({
    where: { tenantId: 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0' },
    include: {
      appointments: true,
      conversations: true,
    }
  });
  console.log('--- TENANT 1 PATIENTS ---');
  t1Patients.forEach(p => {
    console.log(`Patient ID: ${p.id} | Name: ${p.firstName} ${p.lastName} | Email: ${p.email} | Phone: ${p.phone} | Created: ${p.createdAt.toISOString()}`);
    console.log(`  Appointments (${p.appointments.length}):`, p.appointments.map(a => `${a.id} [${a.status}]`));
    console.log(`  Conversations (${p.conversations.length}):`, p.conversations.map(c => `${c.id} [${c.channel}]`));
  });
  console.log('');

  // Inspect Tenant 1 Invitations
  const t1Invitations = await prisma.invitation.findMany({
    where: { tenantId: 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0' },
  });
  console.log('--- TENANT 1 INVITATIONS ---');
  t1Invitations.forEach(inv => {
    console.log(`Invitation ID: ${inv.id} | Email: ${inv.email} | Role: ${inv.role} | Status: ${inv.status} | Token: ${inv.token?.substring(0, 10)}... | Created: ${inv.createdAt.toISOString()}`);
  });
  console.log('');

  // Inspect Admin Sessions & Audit Logs
  const adminSessions = await prisma.adminSession.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.log('--- ALL ADMIN SESSIONS ---');
  adminSessions.forEach(as => {
    console.log(`Session ID: ${as.id} | Status: ${as.status} | IP: ${as.ipAddress} | UserAgent: ${as.userAgent} | ExpiresAt: ${as.expiresAt.toISOString()} | Created: ${as.createdAt.toISOString()}`);
  });
  console.log('');

  const adminAuditLogs = await prisma.adminAuditLog.findMany({
    orderBy: { occurredAt: 'desc' },
  });
  console.log(`--- ALL ADMIN AUDIT LOGS (${adminAuditLogs.length}) ---`);
  adminAuditLogs.forEach(al => {
    console.log(`AuditLog ID: ${al.id} | Action: ${al.action} | EntityType: ${al.entityType} | EntityId: ${al.entityId} | AdminId: ${al.adminId} | OccurredAt: ${al.occurredAt.toISOString()}`);
  });
  console.log('');

  // Inspect User Sessions
  const userSessions = await prisma.session.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true, tenantId: true } }
    }
  });
  console.log(`--- ALL USER SESSIONS (${userSessions.length}) ---`);
  userSessions.forEach(s => {
    console.log(`Session ID: ${s.id} | User: ${s.user?.email} | Tenant: ${s.tenantId} | Status: ${s.deviceType} | Created: ${s.createdAt.toISOString()}`);
  });
  console.log('');

  // Inspect Notifications & MailJobs
  const notifications = await prisma.notification.findMany();
  console.log(`--- ALL NOTIFICATIONS (${notifications.length}) ---`);
  notifications.forEach(n => {
    console.log(`Notification ID: ${n.id} | Tenant: ${n.tenantId} | Type: ${n.type} | Recipient: ${n.recipientEmail || n.recipientPhone} | Status: ${n.status} | Created: ${n.createdAt.toISOString()}`);
  });
  console.log('');

  const mailJobs = await prisma.mailJob.findMany();
  console.log(`--- ALL MAIL JOBS (${mailJobs.length}) ---`);
  mailJobs.forEach(m => {
    console.log(`MailJob ID: ${m.id} | To: ${m.toEmail} | Subject: ${m.subject} | Status: ${m.status} | Created: ${m.createdAt.toISOString()}`);
  });
  console.log('');

  await prisma.$disconnect();
}

inspectDeep().catch(console.error);
