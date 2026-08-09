/**
 * Create Patient Payload Validator
 */

import { z } from 'zod';
import { CONTACT_METHOD_SMS, CONTACT_METHODS } from '../constants/patient.constants';

export const EmergencyContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  relationship: z.string().min(1, 'Relationship is required').max(50),
  phone: z.string().regex(/^\+?\d{1,15}$/, 'Invalid phone number format'),
});

export const RawCreatePatientSchema = z.object({
  clinicId: z.string().uuid('Clinic ID must be a valid UUID').optional(),
  fullName: z.string().max(100).optional(),
  firstName: z.string().max(50).optional(),
  lastName: z.string().max(50).optional(),
  phone: z
    .string()
    .transform((val) => {
      let cleaned = val.replace(/\D/g, '');
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        cleaned = cleaned.slice(1);
      }
      return cleaned;
    })
    .refine((digits) => digits.length === 10, {
      message: 'Phone number must be exactly 10 digits.',
    }),
  email: z.string().email('Invalid email format').or(z.literal('')).nullable().optional(),
  dateOfBirth: z
    .string()
    .transform((val) => (val ? val.split('T')[0] : val))
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Must be YYYY-MM-DD format',
    })
    .or(z.date())
    .or(z.literal(''))
    .nullable()
    .optional(),
  gender: z.string().max(30).nullable().optional(),
  preferredLanguage: z.string().min(2).max(10).default('en'),
  preferredContactMethod: z.enum(CONTACT_METHODS).default(CONTACT_METHOD_SMS),
  emergencyContact: EmergencyContactSchema.nullable().optional(),
  allowExisting: z.boolean().optional(),
  allowEmailSharing: z.boolean().optional(),
});

export const CreatePatientSchema = RawCreatePatientSchema.transform((data) => {
  const computedName =
    data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim();
  return {
    ...data,
    fullName: computedName || 'New Patient',
    email: data.email === '' ? null : data.email,
    dateOfBirth: data.dateOfBirth === '' ? null : data.dateOfBirth,
  };
});

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>;
