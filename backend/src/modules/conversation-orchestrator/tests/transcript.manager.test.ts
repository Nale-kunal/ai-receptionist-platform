import { TranscriptManager } from '../services/transcript.manager';

describe('TranscriptManager', () => {
  let manager: TranscriptManager;

  beforeEach(() => {
    manager = new TranscriptManager();
  });

  it('accumulates and finalizes real-time transcripts', () => {
    manager.appendTranscript('session-1', 'user', 'Hello assistant', true);
    manager.appendTranscript('session-1', 'assistant', 'Hello patient', false); // partial

    let history = manager.getTranscriptHistory('session-1');
    expect(history.length).toBe(1);
    expect(history[0].transcript).toBe('Hello assistant');

    manager.finalizeTranscript('session-1');
    history = manager.getTranscriptHistory('session-1');
    expect(history.length).toBe(2);
    expect(history[1].transcript).toBe('Hello patient');
  });

  it('tracks character size totals', () => {
    manager.appendTranscript('s1', 'user', '12345', true);
    expect(manager.getTranscriptCharacterCount('s1')).toBe(5);
  });
});
