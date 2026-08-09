import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true },
  });
  console.log('--- ALL USERS IN DB ---');
  console.log(JSON.stringify(users, null, 2));

  const invitations = await prisma.invitation.findMany();
  console.log('--- ALL INVITATIONS IN DB ---');
  console.log(JSON.stringify(invitations, null, 2));
}

check()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
