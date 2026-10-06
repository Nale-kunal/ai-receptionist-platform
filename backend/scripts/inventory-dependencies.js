const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEST_TENANT_IDS = [
  '076c8d04-3ae1-4593-a7a1-f2b14a0681aa',
  'f8228cf3-4d1a-4cd5-87d0-6aa467b25a34',
  'f59f004d-3c5d-432f-bf22-b7cc601c5095',
  '973ce18e-cc4f-4d97-a755-b8a806fd2552',
  '65041998-d058-42ab-a043-0c0bffd6644a',
  '935c86be-02cf-4337-944f-79b2fcc87828',
  '1114dd8b-ff03-4249-8f0b-546f83ac99cf',
  'f5566da8-950f-4e5b-9ca5-c827422a6fd4',
  'a8584206-c8f9-483b-82e3-94a7102de101',
  '2030b45b-dfaf-4d7e-b496-f7e5729a34a0',
  '96a0a9ef-8495-42c4-94c6-7cae54e04b3c',
  '6d23ce87-296f-418b-bcb6-83d913b93067',
  '467a5d47-a2cf-45d0-83aa-d8cf8634dc17',
  'e2b8dff4-66f1-4b79-8bae-b5836d79a707',
  '3cb8e45f-5e16-41f5-a922-2a59f42b8c69'
];

const GENUINE_TENANT_ID = 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0';

async function inventory() {
  console.log('=== DEPENDENCY & INVENTORY ANALYSIS ===\n');

  // 1. Users attached to Test Tenants vs Genuine Tenant
  const testUsers = await prisma.user.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } },
    select: { id: true, email: true, role: true, tenantId: true }
  });
  const genuineUsers = await prisma.user.findMany({
    where: { tenantId: GENUINE_TENANT_ID },
    select: { id: true, email: true, role: true, tenantId: true }
  });
  console.log(`Test Users Count: ${testUsers.length}`);
  console.log(`Genuine Users Count: ${genuineUsers.length}`);
  console.log('Genuine Users:', genuineUsers);

  const testUserIds = testUsers.map(u => u.id);
  const genuineUserIds = genuineUsers.map(u => u.id);

  // 2. Clinics attached to Test Tenants vs Genuine Tenant
  const testClinics = await prisma.clinic.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } },
    select: { id: true, name: true, slug: true, status: true, tenantId: true }
  });
  const genuineClinics = await prisma.clinic.findMany({
    where: { tenantId: GENUINE_TENANT_ID },
    select: { id: true, name: true, slug: true, status: true, tenantId: true }
  });
  console.log(`\nTest Clinics Count: ${testClinics.length}`);
  testClinics.forEach(c => console.log(`  - [${c.id}] "${c.name}" (${c.status}) in tenant ${c.tenantId}`));
  console.log(`Genuine Clinics Count: ${genuineClinics.length}`);
  genuineClinics.forEach(c => console.log(`  - [${c.id}] "${c.name}" (${c.status}) in tenant ${c.tenantId}`));

  // 3. User Roles (RBAC)
  const testUserRoles = await prisma.userRole.findMany({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { tenantId: { in: TEST_TENANT_IDS } }
      ]
    }
  });
  const genuineUserRoles = await prisma.userRole.findMany({
    where: {
      OR: [
        { userId: { in: genuineUserIds } },
        { tenantId: GENUINE_TENANT_ID }
      ]
    }
  });
  console.log(`\nTest UserRoles Count: ${testUserRoles.length}`);
  console.log(`Genuine UserRoles Count: ${genuineUserRoles.length}`);

  // 4. Roles (Tenant-scoped custom roles vs System Roles)
  const tenantScopedRoles = await prisma.role.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } }
  });
  const systemGlobalRoles = await prisma.role.findMany({
    where: { tenantId: null }
  });
  const genuineTenantRoles = await prisma.role.findMany({
    where: { tenantId: GENUINE_TENANT_ID }
  });
  console.log(`\nTest-Tenant Scoped Roles: ${tenantScopedRoles.length}`);
  console.log(`System Global Roles (null tenantId): ${systemGlobalRoles.length}`);
  console.log(`Genuine-Tenant Scoped Roles: ${genuineTenantRoles.length}`);

  // 5. Role Permissions for tenant scoped roles
  const testRoleIds = tenantScopedRoles.map(r => r.id);
  const testRolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: { in: testRoleIds } }
  });
  console.log(`Test RolePermissions: ${testRolePermissions.length}`);

  // 6. User Sessions
  const testSessions = await prisma.session.findMany({
    where: {
      OR: [
        { userId: { in: testUserIds } },
        { tenantId: { in: TEST_TENANT_IDS } }
      ]
    }
  });
  const genuineSessions = await prisma.session.findMany({
    where: {
      OR: [
        { userId: { in: genuineUserIds } },
        { tenantId: GENUINE_TENANT_ID }
      ]
    }
  });
  console.log(`\nTest User Sessions Count: ${testSessions.length}`);
  console.log(`Genuine User Sessions Count: ${genuineSessions.length}`);

  // 7. Password Reset & Email Verification Tokens
  const testPwTokens = await prisma.passwordResetToken.findMany({
    where: { userId: { in: testUserIds } }
  });
  const genuinePwTokens = await prisma.passwordResetToken.findMany({
    where: { userId: { in: genuineUserIds } }
  });
  console.log(`\nTest Password Reset Tokens: ${testPwTokens.length}`);
  console.log(`Genuine Password Reset Tokens: ${genuinePwTokens.length}`);

  const testEmailTokens = await prisma.emailVerificationToken.findMany({
    where: { userId: { in: testUserIds } }
  });
  const genuineEmailTokens = await prisma.emailVerificationToken.findMany({
    where: { userId: { in: genuineUserIds } }
  });
  console.log(`Test Email Verification Tokens: ${testEmailTokens.length}`);
  console.log(`Genuine Email Verification Tokens: ${genuineEmailTokens.length}`);

  // 8. Configurations
  const testConfigs = await prisma.configuration.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } }
  });
  const genuineConfigs = await prisma.configuration.findMany({
    where: { tenantId: GENUINE_TENANT_ID }
  });
  console.log(`\nTest Configurations: ${testConfigs.length}`);
  console.log(`Genuine Configurations: ${genuineConfigs.length}`);

  // 9. Notifications
  const testNotifications = await prisma.notification.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } }
  });
  const genuineNotifications = await prisma.notification.findMany({
    where: { tenantId: GENUINE_TENANT_ID }
  });
  console.log(`\nTest Notifications: ${testNotifications.length}`);
  console.log(`Genuine Notifications: ${genuineNotifications.length}`);

  // 10. RbacAuditLogs
  const testRbacAuditLogs = await prisma.rbacAuditLog.findMany({
    where: { tenantId: { in: TEST_TENANT_IDS } }
  });
  const genuineRbacAuditLogs = await prisma.rbacAuditLog.findMany({
    where: { tenantId: GENUINE_TENANT_ID }
  });
  console.log(`\nTest RbacAuditLogs: ${testRbacAuditLogs.length}`);
  console.log(`Genuine RbacAuditLogs: ${genuineRbacAuditLogs.length}`);

  // 11. Test Patient in Genuine Clinic: testsync@example.com
  const testPatient = await prisma.patient.findFirst({
    where: { email: 'testsync@example.com' }
  });
  console.log('\nTest Patient testsync@example.com in DB:', testPatient);

  // 12. Test Invitations in Genuine Tenant (created during live tests)
  const testInvitations = await prisma.invitation.findMany({
    where: {
      tenantId: GENUINE_TENANT_ID,
      email: { in: ['live.dentist.1788164550868@example.com', 'test.dentist.1788164400406@example.com', 'ui.decline.test@example.com'] }
    }
  });
  console.log('\nTest Invitations in Genuine Tenant:', testInvitations.map(i => `${i.id}: ${i.email} (${i.status})`));

  // 13. MailJobs
  const testMailJobs = await prisma.mailJob.findMany({
    where: {
      OR: [
        { toEmail: { contains: '1788' } },
        { toEmail: { contains: 'example.com' } },
        { subject: { contains: 'Test' } },
        { subject: { contains: 'Live Audit' } }
      ]
    }
  });
  console.log(`\nTest MailJobs: ${testMailJobs.length}`);

  await prisma.$disconnect();
}

inventory().catch(console.error);
