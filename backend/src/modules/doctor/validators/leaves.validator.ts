/**
 * Doctor Leaves Payload Validator
 */

import { z } from 'zod';

export const DoctorLeaveSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
    reason: z.string().max(255).nullable().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start.getTime() <= end.getTime();
    },
    {
      message: 'Start date must be before or equal to end date',
      path: ['endDate'],
    },
  );

export const DoctorLeavesListSchema = z.object({
  leaves: z.array(DoctorLeaveSchema),
});

export type DoctorLeavesListDto = z.infer<typeof DoctorLeavesListSchema>;
