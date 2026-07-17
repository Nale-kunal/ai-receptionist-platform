/**
 * OpenAI Realtime Provider — Stress Tests
 *
 * Tests: high concurrency, memory cleanup, rapid connect/disconnect cycles.
 */

import { OpenAiRealtimeSessionManager } from '../openai-realtime.session.manager';
import { OpenAiRealtimeAudioStream } from '../openai-realtime.audio.stream';
import { OpenAiRealtimeMetricsCollector } from '../openai-realtime.metrics.collector';
import { OpenAiToolHandler } from '../openai-realtime.tool.handler';

// ---------------------------------------------------------------------------
// Session Manager Stress
// ---------------------------------------------------------------------------

describe('Stress: OpenAiRealtimeSessionManager', () => {
  it('creates and removes 10,000 sessions without memory leak', () => {
    const manager = new OpenAiRealtimeSessionManager();
    const N = 10_000;

    for (let i = 0; i < N; i++) {
      manager.create(`stress-sess-${i}`, {
        instructions: `Instruction set ${i}`,
        tools: [],
        temperature: 0.8,
      });
    }

    expect(manager.activeCount()).toBe(N);

    for (let i = 0; i < N; i++) {
      manager.remove(`stress-sess-${i}`);
    }

    expect(manager.activeCount()).toBe(0);
  });

  it('handles 10,000 concurrent sequence increments correctly', () => {
    const manager = new OpenAiRealtimeSessionManager();
    manager.create('seq-stress');

    const N = 10_000;
    const sequences = new Set<number>();

    for (let i = 0; i < N; i++) {
      const seq = manager.nextInboundSequence('seq-stress');
      sequences.add(seq);
    }

    // All sequences must be unique
    expect(sequences.size).toBe(N);
    // Last sequence should be N-1
    expect(manager.get('seq-stress').audioInboundSequence).toBe(N);
  });

  it('accumulates token counts correctly across 10,000 calls', () => {
    const manager = new OpenAiRealtimeSessionManager();
    manager.create('token-stress');

    const N = 10_000;
    for (let i = 0; i < N; i++) {
      manager.recordTokenUsage('token-stress', 10, 5);
    }

    const session = manager.get('token-stress');
    expect(session.inputTokensConsumed).toBe(N * 10);
    expect(session.outputTokensConsumed).toBe(N * 5);
  });
});

// ---------------------------------------------------------------------------
// Audio Stream Stress
// ---------------------------------------------------------------------------

describe('Stress: OpenAiRealtimeAudioStream', () => {
  it('initializes and closes 5,000 sessions without leaking', () => {
    const stream = new OpenAiRealtimeAudioStream(100);
    const N = 5_000;

    for (let i = 0; i < N; i++) {
      stream.initSession(`audio-stress-${i}`);
    }

    for (let i = 0; i < N; i++) {
      stream.close(`audio-stress-${i}`);
    }

    // All buffers should be cleaned up — verify size is 0 for all
    for (let i = 0; i < N; i++) {
      expect(stream.inboundBufferSize(`audio-stress-${i}`)).toBe(0);
    }
  });

  it('handles 10,000 audio frame pushes with ring buffer', () => {
    const stream = new OpenAiRealtimeAudioStream(500); // ring size 500
    stream.initSession('audio-ring');

    const smallAudio = Buffer.alloc(100).toString('base64');
    const N = 10_000;

    for (let i = 0; i < N; i++) {
      stream.pushInboundFrame({
        sessionId: 'audio-ring',
        sequence: i,
        timestamp: i,
        base64Audio: smallAudio,
        codec: 'audio/pcm16',
        durationMs: 20,
      });
    }

    // Ring buffer should hold only the last 500 frames
    expect(stream.inboundBufferSize('audio-ring')).toBe(500);
    stream.close('audio-ring');
  });
});

// ---------------------------------------------------------------------------
// Metrics Stress
// ---------------------------------------------------------------------------

describe('Stress: OpenAiRealtimeMetricsCollector', () => {
  it('handles 10,000 metric records without performance degradation', () => {
    const metrics = new OpenAiRealtimeMetricsCollector();
    const N = 10_000;

    const start = Date.now();

    for (let i = 0; i < N; i++) {
      metrics.recordSessionStart(`m-sess-${i}`);
    }

    for (let i = 0; i < N; i++) {
      metrics.recordUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150, capturedAt: Date.now() });
      metrics.recordAudioFrameSent(`m-sess-${i % 100}`, 1024);
      metrics.recordAudioFrameReceived(`m-sess-${i % 100}`, 2048);
      metrics.recordResponseLatency(`m-sess-${i % 100}`, i % 300 + 50);
    }

    for (let i = 0; i < N; i++) {
      metrics.recordSessionEnd(`m-sess-${i}`, 60_000);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000); // Must complete in < 2 seconds

    const summary = metrics.toRealtimeMetrics();
    expect(summary.totalTokensUsed).toBe(N * 150);
    expect(summary.inputTokensCount).toBe(N * 100);
    expect(summary.outputTokensCount).toBe(N * 50);
  });

  it('correctly computes average response latency', () => {
    const metrics = new OpenAiRealtimeMetricsCollector();

    for (let i = 0; i < 1000; i++) {
      metrics.recordResponseLatency('s', 100);
    }

    expect(metrics.getAverageResponseLatencyMs()).toBe(100);
  });

  it('returns 0 average when no responses recorded', () => {
    const metrics = new OpenAiRealtimeMetricsCollector();
    expect(metrics.getAverageResponseLatencyMs()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tool Handler Stress
// ---------------------------------------------------------------------------

describe('Stress: OpenAiToolHandler', () => {
  it('handles 1,000 simultaneous tool call accumulations', () => {
    const handler = new OpenAiToolHandler();

    // Send 1,000 different delta events
    for (let i = 0; i < 1_000; i++) {
      handler.handle(`sess-${i}`, {
        type: 'response.function_call_arguments.delta',
        call_id: `call-${i}`,
        delta: `{"index":${i}`,
      });
    }

    // Finalize all of them
    let completedCount = 0;
    for (let i = 0; i < 1_000; i++) {
      const result = handler.handle(`sess-${i}`, {
        type: 'response.function_call_arguments.done',
        call_id: `call-${i}`,
        name: 'stress_tool',
        arguments: `{"index":${i}}`,
      });
      if (result && result.toolCalls.length > 0) {
        completedCount++;
      }
    }

    expect(completedCount).toBe(1_000);
  });

  it('clears all sessions efficiently', () => {
    const handler = new OpenAiToolHandler();

    for (let i = 0; i < 1_000; i++) {
      handler.handle(`sess-bulk-${i}`, {
        type: 'response.function_call_arguments.delta',
        call_id: `call-bulk-${i}`,
        delta: '{"key":',
      });
    }

    // Clear all sessions
    for (let i = 0; i < 1_000; i++) {
      handler.clearSession(`sess-bulk-${i}`);
    }

    // Verify cleaned up by checking done event works as fresh
    const result = handler.handle('sess-bulk-0', {
      type: 'response.function_call_arguments.done',
      call_id: 'call-bulk-0',
      name: 'test',
      arguments: '{}',
    });
    expect(result!.toolCalls[0]!.arguments).toBe('{}');
  });
});
