import type { PrismaClient } from '@prisma/client';
import type { IFaqRepository } from '../interfaces/faq.interfaces';

export class FaqRepository implements IFaqRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: { tenantId: string; question: string; answer: string }): Promise<any> {
    return this.prisma.faq.create({
      data: {
        tenantId: data.tenantId,
        question: data.question,
        answer: data.answer,
      },
    });
  }

  public async update(id: string, data: { question?: string; answer?: string }): Promise<any> {
    return this.prisma.faq.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.faq.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.faq.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findMany(params: { tenantId: string; limit?: number; offset?: number }): Promise<any[]> {
    return this.prisma.faq.findMany({
      where: {
        tenantId: params.tenantId,
        deletedAt: null,
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { createdAt: 'asc' },
    });
  }

  public async softDelete(id: string): Promise<any> {
    return this.prisma.faq.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  public async restore(id: string): Promise<any> {
    return this.prisma.faq.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  public async count(tenantId: string): Promise<number> {
    return this.prisma.faq.count({
      where: {
        tenantId,
        deletedAt: null,
      },
    });
  }
}
