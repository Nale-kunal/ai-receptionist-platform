import type { SafeFaq } from '../types/faq.types';

export interface CreateFaqParams {
  tenantId: string;
  question: string;
  answer: string;
  actorId: string;
  requestId: string;
}

export interface UpdateFaqParams {
  id: string;
  tenantId: string;
  question?: string;
  answer?: string;
  actorId: string;
  requestId: string;
}

export interface ListFaqsParams {
  tenantId: string;
  limit?: number;
  offset?: number;
}

export interface IFaqRepository {
  create(data: { tenantId: string; question: string; answer: string }): Promise<any>;
  update(id: string, data: { question?: string; answer?: string }): Promise<any>;
  findById(id: string, includeDeleted?: boolean): Promise<any | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<any | null>;
  findMany(params: { tenantId: string; limit?: number; offset?: number }): Promise<any[]>;
  softDelete(id: string): Promise<any>;
  restore(id: string): Promise<any>;
  count(tenantId: string): Promise<number>;
}

export interface IFaqService {
  createFaq(params: CreateFaqParams): Promise<SafeFaq>;
  updateFaq(params: UpdateFaqParams): Promise<SafeFaq>;
  getFaqById(id: string, tenantId: string): Promise<SafeFaq>;
  listFaqs(params: ListFaqsParams): Promise<SafeFaq[]>;
  deleteFaq(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeFaq>;
  restoreFaq(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeFaq>;
}

