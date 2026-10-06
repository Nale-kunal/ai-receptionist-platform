import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditWholeDb() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true, status: true } });
  console.log(`Total Tenants: ${tenants.length}`, tenants);

  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true, slug: true, tenantId: true, status: true } });
  console.log(`Total Clinics: ${clinics.length}`, clinics);

  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, tenantId: true, status: true, deletedAt: true } });
  console.log(`Total Users: ${users.length}`, users);

  const doctors = await prisma.doctor.findMany({ select: { id: true, fullName: true, displayName: true, email: true, tenantId: true, clinicId: true, status: true, deletedAt: true } });
  console.log(`Total Doctors: ${doctors.length}`, doctors);

  const patients = await prisma.patient.findMany({ select: { id: true, fullName: true, phone: true, tenantId: true, clinicId: true, status: true, deletedAt: true } });
  console.log(`Total Patients: ${patients.length}`);

  const appointments = await prisma.appointment.findMany({ select: { id: true, tenantId: true, clinicId: true, doctorId: true, patientId: true, status: true } });
  console.log(`Total Appointments: ${appointments.length}`);
}

auditWholeDb()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
