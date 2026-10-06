const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDashboard() {
  const [counts] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM tenants WHERE deleted_at IS NULL) as total_tenants,
      (SELECT COUNT(*)::int FROM clinics WHERE deleted_at IS NULL) as total_clinics,
      (SELECT COUNT(*)::int FROM clinics WHERE status = 'active' AND deleted_at IS NULL) as active_clinics,
      (SELECT COUNT(*)::int FROM clinics WHERE status = 'suspended' AND deleted_at IS NULL) as suspended_clinics,
      (SELECT COUNT(*)::int FROM clinics WHERE status = 'pending_setup' AND deleted_at IS NULL) as pending_setup_clinics,
      (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) as total_users,
      (SELECT COUNT(*)::int FROM doctors WHERE status = 'active' AND deleted_at IS NULL) as active_doctors,
      (SELECT COUNT(*)::int FROM patients WHERE deleted_at IS NULL) as total_patients,
      (SELECT COUNT(*)::int FROM appointments WHERE deleted_at IS NULL) as total_appointments,
      (SELECT COUNT(*)::int FROM whatsapp_integrations WHERE deleted_at IS NULL) as total_whatsapp,
      (SELECT COUNT(*)::int FROM whatsapp_integrations WHERE is_enabled = true AND deleted_at IS NULL) as active_whatsapp,
      (SELECT COUNT(*)::int FROM admin_sessions WHERE status = 'active' AND expires_at > NOW()) as active_admin_sessions
  `;

  console.log('============================================================');
  console.log('LIVE SUPER ADMIN DASHBOARD METRICS:');
  console.log('============================================================');
  console.log(JSON.stringify(counts, null, 2));

  const recentAuditLogs = await prisma.adminAuditLog.findMany({
    take: 5,
    orderBy: { occurredAt: 'desc' },
    select: {
      action: true,
      outcome: true,
      occurredAt: true,
      admin: { select: { email: true } }
    }
  });
  console.log('\nRECENT PLATFORM AUDIT LOGS:');
  recentAuditLogs.forEach(l => console.log(`  [${l.occurredAt.toISOString()}] ${l.action} (${l.outcome}) by ${l.admin?.email}`));
  console.log('============================================================\n');

  await prisma.$disconnect();
}

checkDashboard().catch(console.error);
