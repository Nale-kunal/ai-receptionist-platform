/**
 * Apply Partial Unique Index on Invitations
 *
 * Ensures PostgreSQL enforces the invariant:
 * At most ONE active (pending or viewed) invitation per (tenantId, email).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyIndex() {
  console.log('=== APPLYING PARTIAL UNIQUE INDEX ON INVITATIONS ===');

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_invitation_per_tenant_email
    ON invitations (tenant_id, email)
    WHERE status IN ('pending', 'viewed');
  `);

  console.log('✅ Partial unique index unique_active_invitation_per_tenant_email applied successfully.');

  // Verify index existence in pg_indexes
  const indexes: any[] = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'invitations' AND indexname = 'unique_active_invitation_per_tenant_email';
  `);

  console.log('Verified in pg_indexes:', indexes);
}

applyIndex()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
