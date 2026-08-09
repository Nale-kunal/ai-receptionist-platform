import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanDemoData() {
  console.log('[DB Clean] Purging demo/test users and mock invitations from production database...');

  // 1. Delete invitations for demo/test emails or created by demo users
  const deletedInvs = await prisma.invitation.deleteMany({
    where: {
      OR: [
        { email: { contains: 'example.com' } },
        { email: { contains: 'clinic.com' } },
        { email: { contains: 'dentalpractice.com' } },
        { email: { startsWith: 'doctor_' } },
        { email: { startsWith: 'testuser_' } },
      ],
    },
  });
  console.log(`[DB Clean] Deleted ${deletedInvs.count} demo invitations.`);

  // 2. Identify demo users to delete
  const demoUsers = await prisma.user.findMany({
    where: {
      OR: [
        { firstName: 'Jane', lastName: 'Doe' },
        { firstName: 'Test', lastName: 'User' },
        { email: { contains: 'example.com' } },
        { email: { startsWith: 'doctor_' } },
        { email: { startsWith: 'testuser_' } },
        { email: { startsWith: 'clinic_admin_' } },
        { email: { startsWith: 'verified_owner_' } },
      ],
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  console.log(`[DB Clean] Found ${demoUsers.length} demo user records to purge.`);
  const demoUserIds = demoUsers.map((u) => u.id);

  if (demoUserIds.length > 0) {
    // Delete invitations sent by these demo users
    await prisma.invitation.deleteMany({
      where: { invitedByUserId: { in: demoUserIds } },
    });

    // Delete email verification tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    // Delete password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    // Delete user roles
    await prisma.userRole.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    // Delete sessions
    await prisma.session.deleteMany({
      where: { userId: { in: demoUserIds } },
    });

    // Delete demo users
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: demoUserIds } },
    });
    console.log(`[DB Clean] Successfully deleted ${deletedUsers.count} demo user records from PostgreSQL!`);
  }

  // 3. Display remaining clean database users
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });
  console.log('=== CLEAN REAL DATABASE USERS ===');
  console.log(JSON.stringify(remainingUsers, null, 2));

  const remainingInvitations = await prisma.invitation.findMany();
  console.log(`=== REMAINING INVITATIONS: ${remainingInvitations.length} ===`);
}

cleanDemoData()
  .catch((e) => console.error('[DB Clean Error]:', e))
  .finally(() => prisma.$disconnect());
