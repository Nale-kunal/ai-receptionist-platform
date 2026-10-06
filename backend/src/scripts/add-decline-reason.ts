import { prisma } from '../shared/database/prisma';

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE invitations ADD COLUMN IF NOT EXISTS decline_reason TEXT;');
  console.log('Successfully ensured decline_reason column exists in invitations table.');
  await prisma.$disconnect();
}

main().catch(console.error);
