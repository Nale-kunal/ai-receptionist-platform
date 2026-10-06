const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkModels() {
  const modelKeys = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
  console.log('Available Prisma Models:', modelKeys.sort());
  await prisma.$disconnect();
}

checkModels().catch(console.error);
