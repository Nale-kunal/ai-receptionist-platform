/**
 * Appointment Availability & Conflict Detection Integration Tests
 *
 * Verifies end-to-end HTTP request handling for:
 * 1. Booking during lunch break -> 422 DOCTOR_BREAK_CONFLICT
 * 2. Booking overlapping lunch break -> 422 DOCTOR_BREAK_CONFLICT
 * 3. Booking outside working hours -> 422 APPOINTMENT_OUTSIDE_WORKING_HOURS
 * 4. Booking on closed days -> 422 DOCTOR_SCHEDULE_CLOSED
 * 5. Booking on doctor leave -> 422 DOCTOR_ON_LEAVE
 * 6. Booking valid slot -> 201 Created
 * 7. Rescheduling to lunch break -> 422 DOCTOR_BREAK_CONFLICT
 * 8. Rescheduling to valid slot -> 200 OK
 */

import express from 'express';
import request from 'supertest';
import { AppointmentController, appointmentErrorHandler } from '../controllers/appointment.controller';
import { AppointmentService } from '../services/appointment.service';
import { createAppointmentRouter } from '../routes/appointment.routes';

describe('Appointment Availability & Conflict API Integration', () => {
  let app: express.Application;
  let mockRepo: any;
  let mockPublisher: any;

  const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
  const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
  const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440002';
  const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440003';
  const APPT_ID = '550e8400-e29b-41d4-a716-446655440004';

  const doctorSchedule = {
    id: DOCTOR_ID,
    status: 'active',
    workingHours: [
      {
        dayOfWeek: 1, // Monday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 6, // Saturday
        isClosed: true,
      },
    ],
    leaves: [
      { startDate: '2026-12-25', endDate: '2026-12-25', reason: 'Christmas' },
    ],
    clinic: { id: CLINIC_ID, timezone: 'UTC' },
  };

  beforeEach(() => {
    mockRepo = {
      clinicIsActive: jest.fn().mockResolvedValue(true),
      doctorBelongsToClinic: jest.fn().mockResolvedValue(true),
      patientBelongsToClinic: jest.fn().mockResolvedValue(true),
      getDoctorStatus: jest.fn().mockResolvedValue('active'),
      getDoctorDetails: jest.fn().mockResolvedValue(doctorSchedule),
      getPatientStatus: jest.fn().mockResolvedValue('active'),
      findConflicts: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({
        id: APPT_ID,
        publicId: 'pub-1',
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: new Date('2026-09-07T09:00:00Z'),
        endTime: new Date('2026-09-07T09:30:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        source: 'dashboard',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      create: jest.fn().mockImplementation((data) => Promise.resolve({
        id: APPT_ID,
        publicId: 'pub-created-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: jest.fn().mockImplementation((id, data) => Promise.resolve({
        id,
        publicId: 'pub-1',
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const service = new AppointmentService(mockRepo, mockPublisher);
    const controller = new AppointmentController(service);

    app = express();
    app.use(express.json());

    // Inject tenant & user auth middleware
    app.use((req, _res, next) => {
      req.tenantId = TENANT_ID;
      req.user = { userId: 'user-1', tenantId: TENANT_ID, role: 'owner', permissions: ['*'] } as any;
      next();
    });

    const router = createAppointmentRouter({
      controller,
      authenticate: (_req, _res, next) => next(),
      resolveTenant: (_req, _res, next) => next(),
      authorize: { requirePermission: () => (_req, _res, next) => next() },
    });

    app.use('/api/v1/appointments', router);
    app.use(appointmentErrorHandler);
  });

  // 2026-09-07 is Monday
  const MONDAY = '2026-09-07';

  it('rejects booking directly inside lunch break (12:00 - 12:30) with DOCTOR_BREAK_CONFLICT', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: `${MONDAY}T12:00:00Z`,
        endTime: `${MONDAY}T12:30:00Z`,
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCTOR_BREAK_CONFLICT');
    expect(res.body.error.message).toContain('overlaps practitioner lunch/break');
  });

  it('rejects booking partially overlapping lunch break (11:45 - 12:15) with DOCTOR_BREAK_CONFLICT', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: `${MONDAY}T11:45:00Z`,
        endTime: `${MONDAY}T12:15:00Z`,
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCTOR_BREAK_CONFLICT');
  });

  it('rejects booking outside working hours (08:00 - 08:30) with APPOINTMENT_OUTSIDE_WORKING_HOURS', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: `${MONDAY}T08:00:00Z`,
        endTime: `${MONDAY}T08:30:00Z`,
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('APPOINTMENT_OUTSIDE_WORKING_HOURS');
  });

  it('rejects booking on closed day (Saturday 2026-09-12) with DOCTOR_SCHEDULE_CLOSED', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: '2026-09-12T10:00:00Z',
        endTime: '2026-09-12T10:30:00Z',
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCTOR_SCHEDULE_CLOSED');
  });

  it('rejects booking on doctor leave date with DOCTOR_ON_LEAVE', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: '2026-12-25T10:00:00Z',
        endTime: '2026-12-25T10:30:00Z',
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCTOR_ON_LEAVE');
  });

  it('successfully books a valid morning slot (09:30 - 10:00)', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({
        clinicId: CLINIC_ID,
        doctorId: DOCTOR_ID,
        patientId: PATIENT_ID,
        startTime: `${MONDAY}T09:30:00Z`,
        endTime: `${MONDAY}T10:00:00Z`,
        timezone: 'UTC',
        source: 'dashboard',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.appointment.id).toBe(APPT_ID);
  });

  it('rejects rescheduling to a lunch break slot with DOCTOR_BREAK_CONFLICT', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/reschedule`)
      .send({
        startTime: `${MONDAY}T12:00:00Z`,
        endTime: `${MONDAY}T12:30:00Z`,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DOCTOR_BREAK_CONFLICT');
  });

  it('successfully reschedules to a valid afternoon slot (14:00 - 14:30)', async () => {
    const res = await request(app)
      .post(`/api/v1/appointments/${APPT_ID}/reschedule`)
      .send({
        startTime: `${MONDAY}T14:00:00Z`,
        endTime: `${MONDAY}T14:30:00Z`,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
