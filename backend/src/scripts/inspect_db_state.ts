import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectDb() {
  console.log('=== TENANTS ===');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, status: true, subscriptionPlan: true },
  });
  console.log(JSON.stringify(tenants, null, 2));

  console.log('=== CLINICS ===');
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, slug: true, tenantId: true, ownerId: true, status: true },
  });
  console.log(JSON.stringify(clinics, null, 2));

  console.log('=== USERS ===');
  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, clinicId: true, status: true },
  });
  console.log(JSON.stringify(users, null, 2));

  console.log('=== DOCTORS ===');
  const doctors = await prisma.doctor.findMany({
    select: { id: true, publicId: true, tenantId: true, clinicId: true, fullName: true, displayName: true, specialization: true, email: true, phone: true, status: true, createdAt: true, deletedAt: true },
  });
  console.log(JSON.stringify(doctors, null, 2));

  console.log('=== USER ROLES ===');
  const userRoles = await prisma.userRole.findMany({
    include: { role: true },
  });
  console.log(JSON.stringify(userRoles, null, 2));

  console.log('=== PATIENTS COUNT ===');
  const patientsCount = await prisma.patient.count();
  console.log('Total patients:', patientsCount);

  console.log('=== APPOINTMENTS ===');
  const appointments = await prisma.appointment.findMany({
    select: { id: true, tenantId: true, clinicId: true, doctorId: true, patientId: true, status: true, startTime: true },
  });
  console.log(JSON.stringify(appointments, null, 2));
}

inspectDb()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
