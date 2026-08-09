import type {
  IFaqService,
  IFaqRepository,
  CreateFaqParams,
  UpdateFaqParams,
  ListFaqsParams,
} from '../interfaces/faq.interfaces';
import type { IFaqEventPublisher } from '../events/faq-event.publisher';
import type { SafeFaq } from '../types/faq.types';
import {
  FaqNotFoundError,
  FaqIsolationViolationError,
} from '../errors/faq.errors';
import {
  EVENT_FAQ_CREATED,
  EVENT_FAQ_UPDATED,
  EVENT_FAQ_DELETED,
  EVENT_FAQ_RESTORED,
} from '../constants/faq.constants';

export class FaqService implements IFaqService {
  constructor(
    private readonly repository: IFaqRepository,
    private readonly publisher: IFaqEventPublisher,
  ) {}

  public async createFaq(params: CreateFaqParams): Promise<SafeFaq> {
    const { tenantId, question, answer, actorId, requestId } = params;

    const record = await this.repository.create({
      tenantId,
      question,
      answer,
    });

    const safe = this.toSafe(record);

    await this.publisher.publish({
      type: EVENT_FAQ_CREATED,
      payload: {
        tenantId,
        faqId: safe.id,
        actorId,
        requestId,
        occurredAt: new Date(),
        question,
        answer,
      },
    });

    return safe;
  }

  public async updateFaq(params: UpdateFaqParams): Promise<SafeFaq> {
    const { id, tenantId, question, answer, actorId, requestId } = params;

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new FaqNotFoundError(id);
    }
    if (existing.tenantId !== tenantId) {
      throw new FaqIsolationViolationError();
    }

    const previous = this.toSafe(existing);

    const updated = await this.repository.update(id, {
      question,
      answer,
    });

    const current = this.toSafe(updated);
    const changedFields: string[] = [];
    if (question !== undefined && question !== previous.question) changedFields.push('question');
    if (answer !== undefined && answer !== previous.answer) changedFields.push('answer');

    await this.publisher.publish({
      type: EVENT_FAQ_UPDATED,
      payload: {
        tenantId,
        faqId: current.id,
        actorId,
        requestId,
        occurredAt: new Date(),
        changedFields,
        previous,
        current,
      },
    });

    return current;
  }

  public async getFaqById(id: string, tenantId: string): Promise<SafeFaq> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new FaqNotFoundError(id);
    }
    if (record.tenantId !== tenantId) {
      throw new FaqIsolationViolationError();
    }
    return this.toSafe(record);
  }

  public async listFaqs(params: ListFaqsParams): Promise<SafeFaq[]> {
    const records = await this.repository.findMany(params);
    return records.map((r) => this.toSafe(r));
  }

  public async deleteFaq(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeFaq> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new FaqNotFoundError(id);
    }
    if (existing.tenantId !== tenantId) {
      throw new FaqIsolationViolationError();
    }

    const deleted = await this.repository.softDelete(id);
    const safe = this.toSafe(deleted);

    await this.publisher.publish({
      type: EVENT_FAQ_DELETED,
      payload: {
        tenantId,
        faqId: safe.id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    return safe;
  }

  public async restoreFaq(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeFaq> {
    // For restore, findById should search without deletedAt filter
    const existing = await this.repository.findById(id, true);
    if (!existing) {
      throw new FaqNotFoundError(id);
    }
    if (existing.tenantId !== tenantId) {
      throw new FaqIsolationViolationError();
    }

    const restored = await this.repository.restore(id);
    const safe = this.toSafe(restored);

    await this.publisher.publish({
      type: EVENT_FAQ_RESTORED,
      payload: {
        tenantId,
        faqId: safe.id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    return safe;
  }

  private toSafe(record: any): SafeFaq {
    return {
      id: record.id,
      publicId: record.publicId,
      tenantId: record.tenantId,
      question: record.question,
      answer: record.answer,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt ?? null,
    };
  }
}
