/**
 * WhatsApp Admin Controller
 *
 * REST API for managing WhatsApp integrations per clinic.
 * All routes require authentication + PERM_WHATSAPP_WRITE/READ.
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { WhatsAppIntegrationRepository } from '../repositories/whatsapp-integration.repository';

const E164 = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format');

const CreateIntegrationSchema = z.object({
  phoneNumber: E164,
  phoneNumberId: z.string().default('PENDING_PROVISIONING'),
  wabaId: z.string().default('PENDING_PROVISIONING'),
  displayName: z.string().min(1).max(120),
  webhookVerifyToken: z.string().default(() => `wa_verify_${Math.random().toString(36).slice(2, 12)}`),
  settings: z.record(z.unknown()).optional(),
});

const UpdateIntegrationSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  isEnabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export class WhatsAppAdminController {
  constructor(
    private readonly integrationRepo: WhatsAppIntegrationRepository,
  ) {}

  public listIntegrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const clinicId = req.params['clinicId'] ?? (req as any).user?.clinicId;
      if (!tenantId || !clinicId) { res.status(400).json({ error: 'Missing tenantId or clinicId' }); return; }

      const integrations = await this.integrationRepo.findByClinic(tenantId, clinicId);
      res.json({ integrations });
    } catch (err) { next(err); }
  };

  public getIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const { id } = req.params;
      if (!tenantId || !id) { res.status(400).json({ error: 'Missing params' }); return; }

      const integration = await this.integrationRepo.findById(id, tenantId);
      if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

      res.json({ integration });
    } catch (err) { next(err); }
  };

  public createIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const clinicId = req.params['clinicId'] ?? (req as any).user?.clinicId;
      const actorId = (req as any).user?.id;
      if (!tenantId || !clinicId) { res.status(400).json({ error: 'Missing tenantId or clinicId' }); return; }

      const body = CreateIntegrationSchema.parse(req.body);

      const integration = await this.integrationRepo.create({
        tenantId,
        clinicId,
        ...body,
        actorId,
        requestId: (req as any).id ?? 'req',
      });

      res.status(201).json({ integration });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(422).json({ error: 'Validation failed', details: err.errors }); return; }
      next(err);
    }
  };

  public updateIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const clinicId = req.params['clinicId'] ?? (req as any).user?.clinicId;
      const actorId = (req as any).user?.id;
      const { id } = req.params;
      if (!tenantId || !clinicId || !id) { res.status(400).json({ error: 'Missing params' }); return; }

      const body = UpdateIntegrationSchema.parse(req.body);

      const integration = await this.integrationRepo.update({
        id,
        tenantId,
        clinicId,
        ...body,
        actorId,
        requestId: (req as any).id ?? 'req',
      });

      res.json({ integration });
    } catch (err) {
      if (err instanceof z.ZodError) { res.status(422).json({ error: 'Validation failed', details: err.errors }); return; }
      next(err);
    }
  };

  public activateIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const { id } = req.params;
      if (!tenantId || !id) { res.status(400).json({ error: 'Missing params' }); return; }

      const existing = await this.integrationRepo.findById(id, tenantId);
      if (!existing) { res.status(404).json({ error: 'Integration not found' }); return; }

      if (existing.phoneNumberId === 'PENDING_PROVISIONING' || existing.wabaId === 'PENDING_PROVISIONING') {
        res.status(422).json({
          error: 'WhatsApp channel setup is pending platform configuration. Please try again after setup is complete.',
        });
        return;
      }

      const integration = await this.integrationRepo.activate(id, tenantId);
      res.json({ integration });
    } catch (err) { next(err); }
  };

  public deactivateIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const { id } = req.params;
      const integration = await this.integrationRepo.deactivate(id, tenantId);
      res.json({ integration });
    } catch (err) { next(err); }
  };

  public deleteIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).user?.tenantId;
      const { id } = req.params;
      await this.integrationRepo.softDelete(id, tenantId);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
