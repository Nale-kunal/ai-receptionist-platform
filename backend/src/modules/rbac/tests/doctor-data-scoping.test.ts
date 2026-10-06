import { prisma } from '../../../shared/database/prisma';
import { TokenService } from '../../authentication/services/token.service';
import { SessionService } from '../../authentication/services/session.service';
import { SessionRepository } from '../../authentication/repositories/session.repository';
import { DashboardController } from '../../dashboard/dashboard.controller';
import { AppointmentController } from '../../appointment/controllers/appointment.controller';
import { PatientController } from '../../patient/controllers/patient.controller';
import { DoctorController } from '../../doctor/controllers/doctor.controller';
import { AppointmentService } from '../../appointment/services/appointment.service';
import { AppointmentRepository } from '../../appointment/repositories/appointment.repository';
import { PatientService } from '../../patient/services/patient.service';
import { PatientRepository } from '../../patient/repositories/patient.repository';
import { DoctorService } from '../../doctor/services/doctor.service';
import { DoctorRepository } from '../../doctor/repositories/doctor.repository';
import { InProcessAppointmentEventPublisher } from '../../appointment/events/appointment-event.publisher';
import { InProcessPatientEventPublisher } from '../../patient/events/patient-event.publisher';
import { InProcessDoctorEventPublisher } from '../../doctor/events/doctor-event.publisher';

describe('Doctor Least-Privilege Data Scoping & Multi-Tenant Isolation', () => {
  let tenantId: string;
  let clinicId: string;
  let ownerUser: any;
  let doctorUserA: any;
  let doctorRecordA: any;
  let doctorUserB: any;
  let doctorRecordB: any;
  let patientA: any;
  let patientB: any;
  let apptA: any;
  let apptB: any;

  let dashboardController: DashboardController;
  let appointmentController: AppointmentController;
  let patientController: PatientController;
  let doctorController: DoctorController;

  beforeAll(async () => {
    // 1. Create a clean test tenant and clinic
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Doctor Scoping Clinic',
        slug: `scoping-clinic-${Date.now()}`,
        status: 'active',
        subscriptionPlan: 'pro',
      },
    });
    tenantId = tenant.id;

    // 2. Create Owner User
    ownerUser = await prisma.user.create({
      data: {
        tenantId,
        email: `owner-${Date.now()}@example.com`,
        passwordHash: 'argon2_dummy_hash',
        role: 'clinic_owner',
        status: 'active',
        firstName: 'Practice',
        lastName: 'Owner',
      },
    });

    const clinic = await prisma.clinic.create({
      data: {
        tenantId,
        ownerId: ownerUser.id,
        name: 'Doctor Scoping Dental Care',
        slug: `scope-clnc-${Date.now()}`,
        timezone: 'America/New_York',
        country: 'US',
        status: 'active',
      },
    });
    clinicId = clinic.id;

    // 3. Create Doctor A (User + Doctor Record)
    const emailA = `doctor.a.${Date.now()}@example.com`;
    doctorUserA = await prisma.user.create({
      data: {
        tenantId,
        clinicId,
        email: emailA,
        passwordHash: 'argon2_dummy_hash',
        role: 'doctor',
        status: 'active',
        firstName: 'Doctor',
        lastName: 'Alpha',
      },
    });
    doctorRecordA = await prisma.doctor.create({
      data: {
        tenantId,
        clinicId,
        fullName: 'Dr. Alpha',
        displayName: 'Dr. Alpha',
        specialization: 'Orthodontics',
        email: emailA,
        status: 'active',
      },
    });

    // 4. Create Doctor B (User + Doctor Record)
    const emailB = `doctor.b.${Date.now()}@example.com`;
    doctorUserB = await prisma.user.create({
      data: {
        tenantId,
        clinicId,
        email: emailB,
        passwordHash: 'argon2_dummy_hash',
        role: 'doctor',
        status: 'active',
        firstName: 'Doctor',
        lastName: 'Beta',
      },
    });
    doctorRecordB = await prisma.doctor.create({
      data: {
        tenantId,
        clinicId,
        fullName: 'Dr. Beta',
        displayName: 'Dr. Beta',
        specialization: 'Periodontics',
        email: emailB,
        status: 'active',
      },
    });

    // 5. Create Patient A (for Doctor A) and Patient B (for Doctor B)
    patientA = await prisma.patient.create({
      data: {
        tenantId,
        clinicId,
        fullName: 'Alice Patient A',
        phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `alice.${Date.now()}@example.com`,
        status: 'active',
      },
    });

    patientB = await prisma.patient.create({
      data: {
        tenantId,
        clinicId,
        fullName: 'Bob Patient B',
        phone: `+1555${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `bob.${Date.now()}@example.com`,
        status: 'active',
      },
    });

    // 6. Create Appointment for Doctor A with Patient A
    const now = new Date();
    apptA = await prisma.appointment.create({
      data: {
        tenantId,
        clinicId,
        doctorId: doctorRecordA.id,
        patientId: patientA.id,
        startTime: new Date(now.getTime() + 3600000),
        endTime: new Date(now.getTime() + 7200000),
        status: 'scheduled',
        appointmentType: 'checkup',
        durationMinutes: 60,
      },
    });

    // 7. Create Appointment for Doctor B with Patient B
    apptB = await prisma.appointment.create({
      data: {
        tenantId,
        clinicId,
        doctorId: doctorRecordB.id,
        patientId: patientB.id,
        startTime: new Date(now.getTime() + 86400000),
        endTime: new Date(now.getTime() + 90000000),
        status: 'pending',
        appointmentType: 'cleaning',
        durationMinutes: 60,
      },
    });

    // 8. Initialize Controllers
    dashboardController = new DashboardController(prisma);

    const apptRepo = new AppointmentRepository(prisma);
    const apptPub = new InProcessAppointmentEventPublisher();
    const apptService = new AppointmentService(apptRepo, apptPub);
    appointmentController = new AppointmentController(apptService);

    const patRepo = new PatientRepository(prisma);
    const patPub = new InProcessPatientEventPublisher();
    const patService = new PatientService(patRepo, patPub);
    patientController = new PatientController(patService);

    const docRepo = new DoctorRepository(prisma);
    const docPub = new InProcessDoctorEventPublisher();
    const docService = new DoctorService(docRepo, docPub);
    doctorController = new DoctorController(docService);
  });

  afterAll(async () => {
    // Cleanup created records
    await prisma.appointment.deleteMany({ where: { tenantId } });
    await prisma.patient.deleteMany({ where: { tenantId } });
    await prisma.doctor.deleteMany({ where: { tenantId } });
    await prisma.clinic.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  // ── 1. DASHBOARD SUMMARY SCOPING ──
  describe('Dashboard Summary Scoping', () => {
    it('Doctor A should ONLY see Doctor A appointments and patients', async () => {
      const req: any = {
        tenantId,
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
        headers: {},
      };
      let responseBody: any = null;
      let statusCode = 200;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await dashboardController.getSummary(req, res, () => {});

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);

      const appointments = responseBody.data.appointments;
      expect(appointments.length).toBe(1);
      expect(appointments[0].id).toBe(apptA.id);
      expect(appointments[0].patientName).toBe(patientA.fullName);

      const patients = responseBody.data.patients;
      expect(patients.length).toBe(1);
      expect(patients[0].id).toBe(patientA.id);

      const doctors = responseBody.data.doctors;
      expect(doctors.length).toBe(1);
      expect(doctors[0].id).toBe(doctorRecordA.id);
    });

    it('Doctor B should ONLY see Doctor B appointments and patients', async () => {
      const req: any = {
        tenantId,
        user: { role: 'doctor', email: doctorUserB.email, userId: doctorUserB.id },
        headers: {},
      };
      let responseBody: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await dashboardController.getSummary(req, res, () => {});

      expect(responseBody.success).toBe(true);
      const appointments = responseBody.data.appointments;
      expect(appointments.length).toBe(1);
      expect(appointments[0].id).toBe(apptB.id);

      const patients = responseBody.data.patients;
      expect(patients.length).toBe(1);
      expect(patients[0].id).toBe(patientB.id);
    });

    it('Practice Owner should see ALL appointments and patients across the clinic', async () => {
      const req: any = {
        tenantId,
        user: { role: 'clinic_owner', email: ownerUser.email, userId: ownerUser.id },
        headers: {},
      };
      let responseBody: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await dashboardController.getSummary(req, res, () => {});

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.appointments.length).toBe(2);
      expect(responseBody.data.doctors.length).toBe(2);
      expect(responseBody.data.patients.length).toBe(2);
    });
  });

  // ── 2. APPOINTMENTS LIST & COUNTERS SCOPING ──
  describe('Appointments Controller Scoping & IDOR Prevention', () => {
    it('Doctor A listing appointments should only receive Doctor A appointments', async () => {
      const req: any = {
        tenantId,
        query: {},
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let responseBody: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await appointmentController.listAppointments(req, res, () => {});

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.appointments.length).toBe(1);
      expect(responseBody.data.appointments[0].id).toBe(apptA.id);
    });

    it('Doctor A status counters should only count Doctor A appointments', async () => {
      const req: any = {
        tenantId,
        query: {},
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let responseBody: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await appointmentController.getStatusCounters(req, res, () => {});

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.total).toBe(1);
      expect(responseBody.data.scheduled).toBe(1);
      expect(responseBody.data.pending).toBe(0); // apptB is pending, belongs to Doctor B!
    });

    it('Doctor A attempting to get Doctor B appointment by ID should return 404 (IDOR Protection)', async () => {
      const req: any = {
        tenantId,
        params: { id: apptB.id },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await appointmentController.getAppointment(req, res, () => {});

      expect(statusCode).toBe(404);
      expect(responseBody.error.code).toBe('APPOINTMENT_NOT_FOUND');
    });

    it('Doctor A attempting to cancel Doctor B appointment should return 404 (IDOR Mutation Protection)', async () => {
      const req: any = {
        tenantId,
        params: { id: apptB.id },
        body: { cancellationReason: 'Malicious cancellation attempt' },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await appointmentController.cancelAppointment(req, res, () => {});

      expect(statusCode).toBe(404);
      expect(responseBody.error.code).toBe('APPOINTMENT_NOT_FOUND');
    });

    it('Doctor A can successfully get and confirm their own appointment', async () => {
      const req: any = {
        tenantId,
        params: { id: apptA.id },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await appointmentController.getAppointment(req, res, () => {});

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.appointment.id).toBe(apptA.id);
    });
  });

  // ── 3. PATIENTS CONTROLLER SCOPING ──
  describe('Patients Controller Scoping & IDOR Prevention', () => {
    it('Doctor A listing patients should only see patients with appointments for Doctor A', async () => {
      const req: any = {
        tenantId,
        query: {},
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let responseBody: any = null;
      const res: any = {
        status: () => res,
        json: (data: any) => { responseBody = data; return res; },
        setHeader: () => res,
      };

      await patientController.listPatients(req, res, () => {});

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.patients.length).toBe(1);
      expect(responseBody.data.patients[0].id).toBe(patientA.id);
    });

    it('Doctor A accessing Doctor B patient by ID should return 404', async () => {
      const req: any = {
        tenantId,
        params: { id: patientB.id },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await patientController.getPatient(req, res, () => {});

      expect(statusCode).toBe(404);
      expect(responseBody.error.code).toBe('PATIENT_NOT_FOUND');
    });

    it('Doctor A accessing their own patient by ID should succeed', async () => {
      const req: any = {
        tenantId,
        params: { id: patientA.id },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await patientController.getPatient(req, res, () => {});

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.patient.id).toBe(patientA.id);
    });
  });

  // ── 4. DOCTORS CONTROLLER MUTATION RESTRICTIONS ──
  describe('Doctor Controller Mutation Restrictions', () => {
    it('Doctor A attempting to update Doctor B profile should be forbidden (403)', async () => {
      const req: any = {
        tenantId,
        params: { id: doctorRecordB.id },
        body: { fullName: 'Hacked Beta' },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await doctorController.updateDoctor(req, res, () => {});

      expect(statusCode).toBe(403);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('Doctor A attempting to delete a doctor profile should be forbidden (403)', async () => {
      const req: any = {
        tenantId,
        params: { id: doctorRecordB.id },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await doctorController.deleteDoctor(req, res, () => {});

      expect(statusCode).toBe(403);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('Doctor A updating their own profile should succeed', async () => {
      const req: any = {
        tenantId,
        params: { id: doctorRecordA.id },
        body: { fullName: 'Dr. Alpha Updated' },
        user: { role: 'doctor', email: doctorUserA.email, userId: doctorUserA.id },
      };
      let statusCode = 200;
      let responseBody: any = null;
      const res: any = {
        status: (code: number) => { statusCode = code; return res; },
        json: (data: any) => { responseBody = data; return res; },
      };

      await doctorController.updateDoctor(req, res, () => {});

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.doctor.fullName).toBe('Dr. Alpha Updated');
    });
  });

  afterAll(async () => {
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(tenantId, prisma);
    await prisma.$disconnect();
  });
});
