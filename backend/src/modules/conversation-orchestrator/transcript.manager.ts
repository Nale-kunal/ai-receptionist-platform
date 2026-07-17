import type { ITranscriptManager } from './conversation-orchestrator.interfaces';
import type { OrchestrationTurn } from './conversation-orchestrator.types';

export class TranscriptManager implements ITranscriptManager {
  private readonly histories: Map<string, OrchestrationTurn[]> = new Map();
  private readonly partialTranscripts: Map<string, { speaker: 'user' | 'assistant'; text: string }> = new Map();

  public appendTranscript(sessionId: string, speaker: 'user' | 'assistant', text: string, isFinal: boolean): void {
    if (!isFinal) {
      this.partialTranscripts.set(sessionId, { speaker, text });
      return;
    }

    this.partialTranscripts.delete(sessionId);
    const list = this.histories.get(sessionId) ?? [];

    list.push({
      turnId: `turn_${Math.random().toString(36).substring(2, 10)}`,
      speaker,
      status: 'completed',
      transcript: text,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    this.histories.set(sessionId, list);
  }

  public finalizeTranscript(sessionId: string): OrchestrationTurn[] {
    const partial = this.partialTranscripts.get(sessionId);
    const list = this.histories.get(sessionId) ?? [];

    if (partial && partial.text.trim().length > 0) {
      list.push({
        turnId: `turn_${Math.random().toString(36).substring(2, 10)}`,
        speaker: partial.speaker,
        status: 'completed',
        transcript: partial.text,
        startedAt: new Date(),
        completedAt: new Date(),
      });
      this.partialTranscripts.delete(sessionId);
      this.histories.set(sessionId, list);
    }

    return list;
  }

  public getTranscriptHistory(sessionId: string): OrchestrationTurn[] {
    return this.histories.get(sessionId) ?? [];
  }

  public getTranscriptCharacterCount(sessionId: string): number {
    const list = this.histories.get(sessionId) ?? [];
    let count = 0;
    for (const t of list) {
      count += t.transcript.length;
    }
    const partial = this.partialTranscripts.get(sessionId);
    if (partial) {
      count += partial.text.length;
    }
    return count;
  }

  public clearSessionTranscript(sessionId: string): void {
    this.histories.delete(sessionId);
    this.partialTranscripts.delete(sessionId);
  }
}
