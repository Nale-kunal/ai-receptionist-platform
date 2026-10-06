import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkReferences() {
  const doc1Id = '6449646c-76b1-4e7a-b5bb-3e9b4048393a';
  const doc2Id = '63b7952f-2f5d-433e-affc-c198a2348c23';

  console.log('=== DOCTOR 1 REFERENCES ===');
  const d1Appointments = await prisma.appointment.count({ where: { doctorId: doc1Id } });
  const d1Conversations = await prisma.conversation.count({ where: { doctorId: doc1Id } });
  const d1Calendars = await prisma.calendarConnection.count({ where: { doctorId: doc1Id } });
  console.log(`Doctor 1 (${doc1Id}):`, {
    appointments: d1Appointments,
    conversations: d1Conversations,
    calendarConnections: d1Calendars,
  });

  console.log('=== DOCTOR 2 REFERENCES ===');
  const d2Appointments = await prisma.appointment.count({ where: { doctorId: doc2Id } });
  const d2Conversations = await prisma.conversation.count({ where: { doctorId: doc2Id } });
  const d2Calendars = await prisma.calendarConnection.count({ where: { doctorId: doc2Id } });
  console.log(`Doctor 2 (${doc2Id}):`, {
    appointments: d2Appointments,
    conversations: d2Conversations,
    calendarConnections: d2Calendars,
  });
}

checkReferences()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
