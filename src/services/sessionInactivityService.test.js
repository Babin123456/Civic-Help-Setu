import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startInactivityTracker,
  stopInactivityTracker,
  resetInactivityTracker,
  isTrackerActive,
} from './sessionInactivityService';

describe('sessionInactivityService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopInactivityTracker();
  });

  afterEach(() => {
    stopInactivityTracker();
    vi.useRealTimers();
  });

  it('activates tracker and triggers warning when approaching timeout', () => {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();

    startInactivityTracker({
      timeoutSeconds: 60,
      warningSeconds: 10,
      onWarning,
      onTimeout,
    });

    expect(isTrackerActive()).toBe(true);

    // Fast-forward 50 seconds (60 - 10)
    vi.advanceTimersByTime(50000);

    expect(onWarning).toHaveBeenCalledWith(10);
    expect(onTimeout).not.toHaveBeenCalled();

    // Advance 5 more seconds into warning countdown
    vi.advanceTimersByTime(5000);
    expect(onWarning).toHaveBeenCalledWith(5);
    expect(onTimeout).not.toHaveBeenCalled();

    // Advance remaining 5 seconds to full timeout
    vi.advanceTimersByTime(5000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(isTrackerActive()).toBe(false);
  });

  it('resets timer when user activity or resetInactivityTracker is called', () => {
    const onWarning = vi.fn();
    const onTimeout = vi.fn();

    startInactivityTracker({
      timeoutSeconds: 60,
      warningSeconds: 10,
      onWarning,
      onTimeout,
    });

    // Advance 45 seconds
    vi.advanceTimersByTime(45000);
    expect(onWarning).not.toHaveBeenCalled();

    // Reset activity
    resetInactivityTracker();

    // Advance 45 more seconds (would have timed out without reset)
    vi.advanceTimersByTime(45000);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('stops cleanly and removes listeners', () => {
    const onTimeout = vi.fn();

    startInactivityTracker({
      timeoutSeconds: 30,
      warningSeconds: 5,
      onTimeout,
    });

    stopInactivityTracker();
    expect(isTrackerActive()).toBe(false);

    vi.advanceTimersByTime(40000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
