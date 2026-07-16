/**
 * Create Patient Payload Validator
 */

import { z } from 'zod';
import { CONTACT_METHOD_SMS, CONTACT_METHODS } from '../constants/patient.constants';

export const EmergencyContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  relationship: z.string().min(1, 'Relationship is required').max(50),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
});

export const CreatePatientSchema = z.object({
  clinicId: z.string().uuid('Clinic ID must be a valid UUID'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid primary phone number format'),
  email: z.string().email('Invalid email format').nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .or(z.date())
    .nullable()
    .optional(),
  gender: z.string().max(30).nullable().optional(),
  preferredLanguage: z.string().min(2).max(10).default('en'),
  preferredContactMethod: z.enum(CONTACT_METHODS).default(CONTACT_METHOD_SMS),
  emergencyContact: EmergencyContactSchema.nullable().optional(),
});

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
