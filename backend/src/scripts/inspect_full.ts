import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectFull() {
  console.log('=== USERS FULL ===');
  const users = await prisma.user.findMany();
  console.log(JSON.stringify(users, null, 2));

  console.log('=== DOCTORS FULL ===');
  const doctors = await prisma.doctor.findMany();
  console.log(JSON.stringify(doctors, null, 2));
}

inspectFull()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
