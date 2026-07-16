import type {
  IRealtimeAiProvider,
  IRealtimeAiProviderFactory,
} from '../interfaces/realtime-ai.interfaces';
import type { RealtimeProviderType } from '../constants/realtime-ai.constants';
import type { RealtimeAudioFrame } from '../types/realtime-ai.types';
import { RealtimeProviderUnavailableError } from '../errors/realtime-ai.errors';

export class MockRealtimeAiProvider implements IRealtimeAiProvider {
  public readonly providerName = 'mock';
  private connectionStates: Map<string, 'connected' | 'connecting' | 'disconnected'> = new Map();
  public sentAudioFrames: Map<string, RealtimeAudioFrame[]> = new Map();
  public sentTexts: Map<string, string[]> = new Map();
  public sessionConfigs: Map<string, Record<string, unknown>> = new Map();

  public async connect(sessionId: string, apiKey: string): Promise<void> {
    if (apiKey === 'fail') {
      throw new RealtimeProviderUnavailableError(this.providerName, 'API key handshake failed.');
    }
    this.connectionStates.set(sessionId, 'connected');
  }

  public async disconnect(sessionId: string): Promise<void> {
    this.connectionStates.set(sessionId, 'disconnected');
  }

  public async createSession(sessionId: string, config: Record<string, unknown>): Promise<void> {
    this.sessionConfigs.set(sessionId, config);
  }

  public async closeSession(sessionId: string): Promise<void> {
    this.sessionConfigs.delete(sessionId);
    this.connectionStates.delete(sessionId);
  }

  public async sendAudio(sessionId: string, frame: RealtimeAudioFrame): Promise<void> {
    const list = this.sentAudioFrames.get(sessionId) ?? [];
    list.push(frame);
    this.sentAudioFrames.set(sessionId, list);
  }

  public async *receiveAudio(sessionId: string): AsyncIterable<RealtimeAudioFrame> {
    // Basic generator yielding mock frames
    yield {
      sequence: 1,
      timestamp: 20,
      payload: Buffer.alloc(10, 0),
      codec: 'audio/PCMU',
      durationMs: 20,
    };
  }

  public async sendText(sessionId: string, text: string): Promise<void> {
    const list = this.sentTexts.get(sessionId) ?? [];
    list.push(text);
    this.sentTexts.set(sessionId, list);
  }

  public async *receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>> {
    yield { type: 'session.updated', status: 'ready' };
  }

  public async updateSession(sessionId: string, config: Record<string, unknown>): Promise<void> {
    this.sessionConfigs.set(sessionId, config);
  }

  public async heartbeat(sessionId: string): Promise<void> {
    // mock heartbeat verification
  }

  public connectionStatus(sessionId: string): 'connected' | 'connecting' | 'disconnected' {
    return this.connectionStates.get(sessionId) ?? 'disconnected';
  }
}

export class RealtimeAiProviderFactory implements IRealtimeAiProviderFactory {
  private readonly mockProvider = new MockRealtimeAiProvider();

  public getProvider(provider: RealtimeProviderType): IRealtimeAiProvider {
    switch (provider) {
      case 'mock':
        return this.mockProvider;
      case 'openai':
        // Future concrete adapters plug in here
        return this.mockProvider; 
      case 'gemini':
        return this.mockProvider;
      default:
        throw new Error(`Realtime provider ${provider} is not registered in this adapter factory.`);
    }
  }
}
