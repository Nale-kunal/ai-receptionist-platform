const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const doc = await prisma.doctor.findFirst({ include: { clinic: true } });
  console.log('DOCTOR RECORD:');
  console.log(JSON.stringify(doc, null, 2));

  const clinic = await prisma.clinic.findFirst();
  console.log('\nCLINIC RECORD:');
  console.log(JSON.stringify(clinic, null, 2));

  const appts = await prisma.appointment.findMany();
  console.log('\nAPPOINTMENTS RECORD:');
  console.log(JSON.stringify(appts, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
