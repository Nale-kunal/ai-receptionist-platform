import type { IContextSynchronizer } from './conversation-orchestrator.interfaces';
import type { OrchestrationContext } from './conversation-orchestrator.types';

export class ContextSynchronizer implements IContextSynchronizer {
  private readonly contexts: Map<string, OrchestrationContext> = new Map();

  public synchronizeContext(
    sessionId: string,
    updates: Partial<OrchestrationContext>
  ): OrchestrationContext {
    const existing = this.contexts.get(sessionId);

    if (!existing) {
      const base: OrchestrationContext = {
        tenantId: updates.tenantId ?? '',
        clinicId: updates.clinicId ?? null,
        patientId: updates.patientId ?? null,
        doctorId: updates.doctorId ?? null,
        appointmentId: updates.appointmentId ?? null,
        conversationId: updates.conversationId ?? '',
        aiSessionId: updates.aiSessionId ?? null,
        promptVersion: updates.promptVersion ?? null,
        variables: updates.variables ?? {},
        providerMetadata: updates.providerMetadata ?? {},
      };
      this.contexts.set(sessionId, base);
      return base;
    }

    const merged: OrchestrationContext = {
      tenantId: updates.tenantId !== undefined ? updates.tenantId : existing.tenantId,
      clinicId: updates.clinicId !== undefined ? updates.clinicId : existing.clinicId,
      patientId: updates.patientId !== undefined ? updates.patientId : existing.patientId,
      doctorId: updates.doctorId !== undefined ? updates.doctorId : existing.doctorId,
      appointmentId: updates.appointmentId !== undefined ? updates.appointmentId : existing.appointmentId,
      conversationId: updates.conversationId !== undefined ? updates.conversationId : existing.conversationId,
      aiSessionId: updates.aiSessionId !== undefined ? updates.aiSessionId : existing.aiSessionId,
      promptVersion: updates.promptVersion !== undefined ? updates.promptVersion : existing.promptVersion,
      variables: updates.variables !== undefined ? { ...existing.variables, ...updates.variables } : existing.variables,
      providerMetadata: updates.providerMetadata !== undefined ? { ...existing.providerMetadata, ...updates.providerMetadata } : existing.providerMetadata,
    };

    this.contexts.set(sessionId, merged);
    return merged;
  }

  public getContext(sessionId: string): OrchestrationContext {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`[ContextSynchronizer] No context exists for session ${sessionId}.`);
    }
    return context;
  }

  public clearSessionContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}
