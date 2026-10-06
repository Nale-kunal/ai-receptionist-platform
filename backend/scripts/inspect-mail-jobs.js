const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectMailJobs() {
  const mailJobs = await prisma.mailJob.findMany({
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Total MailJobs: ${mailJobs.length}`);
  mailJobs.forEach(m => {
    console.log(`ID: ${m.id} | Tenant: ${m.tenantId} | Recipient: ${m.recipient} | Type: ${m.type} | Subject: "${m.subject}" | Created: ${m.createdAt.toISOString()}`);
  });
  await prisma.$disconnect();
}

inspectMailJobs().catch(console.error);
