import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './restTimerStore';

describe('rest timer store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
    useRestTimer.setState({ endsAt: undefined, durationSec: 0, finishedAt: undefined });
  });
  afterEach(() => vi.useRealTimers());

  it('starts with an absolute end time so it survives backgrounding', () => {
    useRestTimer.getState().start(90, 'Pec Deck · set 2');
    const s = useRestTimer.getState();
    expect(s.endsAt).toBe(Date.parse('2026-09-27T10:01:30Z'));
    expect(s.label).toBe('Pec Deck · set 2');
  });

  it('adds 30 s and skips', () => {
    useRestTimer.getState().start(60);
    useRestTimer.getState().addTime(30);
    expect(useRestTimer.getState().endsAt).toBe(Date.parse('2026-09-27T10:01:30Z'));
    useRestTimer.getState().skip();
    expect(useRestTimer.getState().endsAt).toBeUndefined();
  });

  it('finish records completion', () => {
    useRestTimer.getState().start(60);
    useRestTimer.getState().finish();
    expect(useRestTimer.getState().endsAt).toBeUndefined();
    expect(useRestTimer.getState().finishedAt).toBe(Date.now());
  });
});
