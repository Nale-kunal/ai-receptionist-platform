import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectData() {
  console.log('=== 1. INVITATIONS ===');
  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { tenant: true },
  });
  console.log(`Total Invitations: ${invitations.length}`);
  invitations.forEach((inv) => {
    console.log({
      id: inv.id,
      tenantId: inv.tenantId,
      tenantName: inv.tenant?.name,
      email: inv.email,
      roleName: inv.roleName,
      status: inv.status,
      type: inv.type,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
      expiresAt: inv.expiresAt,
    });
  });

  console.log('\n=== 2. NOTIFICATIONS ===');
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total Notifications: ${notifications.length}`);
  notifications.forEach((n) => {
    console.log({
      id: n.id,
      tenantId: n.tenantId,
      recipient: n.recipient,
      type: n.type,
      channel: n.channel,
      status: n.status,
      subject: n.subject,
      provider: n.provider,
      createdAt: n.createdAt,
      sentAt: n.sentAt,
      deliveredAt: n.deliveredAt,
      failedAt: n.failedAt,
    });
  });

  console.log('\n=== 3. MAIL JOBS ===');
  const mailJobs = await prisma.mailJob.findMany({
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total Mail Jobs: ${mailJobs.length}`);
  mailJobs.forEach((mj) => {
    console.log({
      id: mj.id,
      tenantId: mj.tenantId,
      type: mj.type,
      recipient: mj.recipient,
      subject: mj.subject,
      status: mj.status,
      attempts: mj.attempts,
      maxAttempts: mj.maxAttempts,
      idempotencyKey: mj.idempotencyKey,
      providerMessageId: mj.providerMessageId,
      createdAt: mj.createdAt,
      deliveredAt: mj.deliveredAt,
      failedAt: mj.failedAt,
      failureReason: mj.failureReason,
    });
  });

  console.log('\n=== 4. TENANTS & CLINICS ===');
  const tenants = await prisma.tenant.findMany({
    include: { clinics: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total Tenants: ${tenants.length}`);
  tenants.forEach((t) => {
    console.log({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      createdAt: t.createdAt,
      clinics: t.clinics.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    });
  });
}

inspectData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
