/**
 * FAQ Module Types
 */

export interface SafeFaq {
  id: string;
  publicId: string;
  tenantId: string;
  question: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
