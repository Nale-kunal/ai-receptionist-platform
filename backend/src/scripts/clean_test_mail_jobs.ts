import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanTestMailJobs() {
  console.log('=== CLEANING TEST MAIL JOBS ===');

  const existingTenants = await prisma.tenant.findMany({ select: { id: true } });
  const validTenantIds = new Set(existingTenants.map((t) => t.id));

  const allJobs = await prisma.mailJob.findMany();
  const orphanJobs = allJobs.filter((j) => j.tenantId && !validTenantIds.has(j.tenantId));

  console.log(`Found ${orphanJobs.length} orphan test mail jobs out of ${allJobs.length} total mail jobs.`);

  if (orphanJobs.length > 0) {
    const orphanIds = orphanJobs.map((j) => j.id);
    const deleted = await prisma.mailJob.deleteMany({
      where: { id: { in: orphanIds } },
    });
    console.log(`Deleted ${deleted.count} orphan test mail jobs.`);
  }

  console.log('=== CLEANUP COMPLETE ===');
}

cleanTestMailJobs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
