import { RealtimeSecurityValidator } from '../middleware/realtime-security.validator';
import { RealtimeFrameOverflowError, RealtimeUnauthorizedProviderError } from '../errors/realtime-ai.errors';

describe('RealtimeSecurityValidator', () => {
  let validator: RealtimeSecurityValidator;

  beforeEach(() => {
    validator = new RealtimeSecurityValidator({ maxPayloadSizeBytes: 100 });
  });

  it('allows valid non-duplicate frames and rejects replay sequences', () => {
    const payload = Buffer.alloc(50);
    expect(() => {
      validator.validateFrame('s1', payload, 1);
      validator.validateFrame('s1', payload, 2);
    }).not.toThrow();

    // Replay sequence
    expect(() => {
      validator.validateFrame('s1', payload, 1);
    }).toThrow();
  });

  it('rejects oversized frame bytes with RealtimeFrameOverflowError', () => {
    const payload = Buffer.alloc(101); // Limit is 100
    expect(() => {
      validator.validateFrame('s1', payload, 1);
    }).toThrow(RealtimeFrameOverflowError);
  });

  it('verifies minimum API key length limits', () => {
    expect(() => {
      validator.validateApiKey('sk-abcdefghijklmnopqrstuvwxyz'); // 29 chars (ok)
    }).not.toThrow();

    expect(() => {
      validator.validateApiKey('short'); // too short (error)
    }).toThrow(RealtimeUnauthorizedProviderError);
  });
});
