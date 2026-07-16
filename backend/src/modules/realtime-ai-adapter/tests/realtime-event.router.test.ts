import { RealtimeEventRouter } from '../services/realtime-event.router';
import { InProcessRealtimeEventPublisher } from '../events/realtime-ai-event.publisher';
import {
  EVENT_REALTIME_TRANSCRIPT_GENERATED,
  EVENT_REALTIME_TOOL_CALL_RECEIVED,
  EVENT_REALTIME_INTERRUPTION_DETECTED,
} from '../events/realtime-ai.events';

describe('RealtimeEventRouter', () => {
  let router: RealtimeEventRouter;
  let publisher: InProcessRealtimeEventPublisher;

  beforeEach(() => {
    publisher = new InProcessRealtimeEventPublisher();
    router = new RealtimeEventRouter(publisher);
  });

  it('routes transcripts to subscribers with tenant tracking', async () => {
    let receivedEvent: any = null;
    publisher.subscribe(EVENT_REALTIME_TRANSCRIPT_GENERATED, (event) => {
      receivedEvent = event;
    });

    router.registerSessionTenant('session-1', 'tenant-123');
    await router.routeTranscript('session-1', {
      text: 'Hello world',
      isFinal: true,
      speaker: 'user',
    });

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.payload.tenantId).toBe('tenant-123');
    expect(receivedEvent.payload.event.text).toBe('Hello world');
  });

  it('routes tool calls to subscribers', async () => {
    let receivedEvent: any = null;
    publisher.subscribe(EVENT_REALTIME_TOOL_CALL_RECEIVED, (event) => {
      receivedEvent = event;
    });

    router.registerSessionTenant('session-1', 'tenant-123');
    await router.routeToolCall('session-1', {
      toolCalls: [{ id: 'tc1', name: 'checkAvailability', arguments: '{}' }],
    });

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.payload.toolCalls[0].name).toBe('checkAvailability');
  });

  it('routes interruptions to subscribers', async () => {
    let receivedEvent: any = null;
    publisher.subscribe(EVENT_REALTIME_INTERRUPTION_DETECTED, (event) => {
      receivedEvent = event;
    });

    router.registerSessionTenant('session-1', 'tenant-123');
    await router.routeInterruption('session-1', {
      interruptedAtMs: 1200,
      audioOffsetMs: 400,
    });

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent.payload.event.interruptedAtMs).toBe(1200);
  });

  it('throws error when routing for unregistered session', async () => {
    await expect(
      router.routeTranscript('unregistered-session', { text: 'test', isFinal: true, speaker: 'user' })
    ).rejects.toThrow();
  });
});
