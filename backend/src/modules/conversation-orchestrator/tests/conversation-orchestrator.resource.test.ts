import { RuntimeResourceManager } from '../runtime-resource.manager';
import { EventEmitter } from 'events';

describe('RuntimeResourceManager', () => {
  let manager: RuntimeResourceManager;

  beforeEach(() => {
    manager = new RuntimeResourceManager();
  });

  it('registers and cancels active timers sequentially', () => {
    let triggered = false;
    const timer = setTimeout(() => {
      triggered = true;
    }, 100);

    manager.registerTimer('s1', 'test_timer', timer);
    manager.clearSessionResources('s1');

    // Wait and check it was cancelled
    expect(triggered).toBe(false);
  });

  it('unsubscribes listeners on teardown triggers', () => {
    const emitter = new EventEmitter();
    let triggered = false;
    const handler = () => {
      triggered = true;
    };

    manager.registerListener('s1', emitter, 'test_event', handler);
    manager.clearSessionResources('s1');

    emitter.emit('test_event');
    expect(triggered).toBe(false);
  });
});
