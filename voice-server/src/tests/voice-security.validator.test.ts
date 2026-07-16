import { VoiceSecurityValidator } from '../middleware/voice-security.validator';
import { InvalidFrameError, UnauthorizedProviderError } from '../errors/voice-server.errors';

describe('VoiceSecurityValidator', () => {
  let validator: VoiceSecurityValidator;

  beforeEach(() => {
    validator = new VoiceSecurityValidator({ maxPayloadSizeBytes: 100 });
  });

  it('allows valid, non-duplicate audio frames', () => {
    const payload = Buffer.alloc(50);
    expect(() => {
      validator.validateAudioFrame('session-1', payload, 1);
      validator.validateAudioFrame('session-1', payload, 2);
    }).not.toThrow();
  });

  it('rejects duplicate sequences preventing replay attacks', () => {
    const payload = Buffer.alloc(50);
    validator.validateAudioFrame('s1', payload, 1);
    
    // Duplicate sequence
    expect(() => {
      validator.validateAudioFrame('s1', payload, 1);
    }).toThrow(InvalidFrameError);
  });

  it('rejects oversized payload sizes', () => {
    const payload = Buffer.alloc(101); // max is 100
    expect(() => {
      validator.validateAudioFrame('s1', payload, 1);
    }).toThrow(InvalidFrameError);
  });

  it('rejects empty payloads', () => {
    const payload = Buffer.alloc(0);
    expect(() => {
      validator.validateAudioFrame('s1', payload, 1);
    }).toThrow(InvalidFrameError);
  });

  it('authenticates provider identity via secrets signature matching', () => {
    expect(() => {
      validator.validateProviderIdentity('twilio', 'signature-hash', 'signature-hash');
    }).not.toThrow();

    expect(() => {
      validator.validateProviderIdentity('twilio', 'signature-hash', 'wrong-hash');
    }).toThrow(UnauthorizedProviderError);
  });
});
