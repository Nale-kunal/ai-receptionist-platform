/**
 * Transfer Ownership Payload Validator
 */

import { z } from 'zod';

export const TransferOwnershipSchema = z.object({
  ownerId: z.string().uuid('Owner ID must be a valid UUID'),
});

export type TransferOwnershipDto = z.infer<typeof TransferOwnershipSchema>;
