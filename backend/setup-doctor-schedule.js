const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const tenantId = 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0';

  const clinic = await prisma.clinic.findFirst({
    where: { tenantId, deletedAt: null },
  });
  console.log('Clinic:', clinic);

  const doctors = await prisma.doctor.findMany({
    where: { tenantId, deletedAt: null },
  });
  console.log('Doctors in tenant:', doctors);

  // If doctor has empty workingHours, set standard schedule with lunch 12:00 - 13:00
  for (const doc of doctors) {
    if (!doc.workingHours || doc.workingHours.length === 0) {
      const schedule = [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '17:00', isClosed: true },
        { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isClosed: true },
      ];
      await prisma.doctor.update({
        where: { id: doc.id },
        data: { workingHours: schedule }
      });
      console.log(`Updated workingHours with lunch break for doctor ${doc.fullName} (${doc.id})`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
