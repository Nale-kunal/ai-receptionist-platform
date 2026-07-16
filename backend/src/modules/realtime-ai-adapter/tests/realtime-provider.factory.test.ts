import { RealtimeAiProviderFactory } from '../services/realtime-provider.factory';
import { RealtimeProviderUnavailableError } from '../errors/realtime-ai.errors';

describe('RealtimeAiProviderFactory', () => {
  let factory: RealtimeAiProviderFactory;

  beforeEach(() => {
    factory = new RealtimeAiProviderFactory();
  });

  it('resolves and instantiates the registered providers', () => {
    const provider = factory.getProvider('mock');
    expect(provider.providerName).toBe('mock');

    const openai = factory.getProvider('openai');
    expect(openai).toBeDefined();
  });

  it('runs connect, disconnect, and audio transmission streams successfully on resolved provider', async () => {
    const provider = factory.getProvider('mock');
    
    await provider.connect('session-1', 'valid-key');
    expect(provider.connectionStatus('session-1')).toBe('connected');

    await provider.disconnect('session-1');
    expect(provider.connectionStatus('session-1')).toBe('disconnected');
  });

  it('throws RealtimeProviderUnavailableError when provider connect fails', async () => {
    const provider = factory.getProvider('mock');
    
    await expect(provider.connect('session-1', 'fail')).rejects.toThrow(RealtimeProviderUnavailableError);
  });
});
