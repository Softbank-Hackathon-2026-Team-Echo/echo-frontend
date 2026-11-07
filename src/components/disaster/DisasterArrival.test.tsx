import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Disaster } from '@/lib/api/disasters';
import { renderRoute } from '@/test/render';
import { ARRIVAL_SHOW_MS, DisasterArrival } from './DisasterArrival';

const disaster = {
  id: 'd1',
  type: 'EARTHQUAKE',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
  epicenterLabel: 'near Tokyo',
  radiusKm: 302,
  meetsThreshold: true,
  source: 'SIMULATED',
  simulated: true,
  feedEvent: null,
  affectedEnvironmentIds: ['e1'],
  safeEnvironmentIds: ['e2'],
  unknownEnvironmentIds: [],
  startedAt: '2026-11-08T05:00:00Z',
  plans: [
    {
      serviceId: 's1',
      planId: 'p1',
      outcome: 'APPROVED',
      reason: null,
      targetEnvironmentId: 'e2',
      planStatus: 'RUNNING',
    },
  ],
} as unknown as Disaster;

describe('DisasterArrival', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('규모 · 위험 환경 수 · SIMULATED 를 보이고 파동을 그린다', () => {
    renderRoute(
      <DisasterArrival
        disaster={disaster}
        environments={[]}
        reducedMotion={false}
        onDone={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('M7.2 · near Tokyo');
    expect(screen.getByText(/At risk: 1 · radius 302 km/)).toBeInTheDocument();
    expect(screen.getByText(/Migration started/)).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
    expect(screen.getAllByTestId('disaster-ripple')).toHaveLength(3);
  });

  it('움직임 줄이기면 파동을 그리지 않는다', () => {
    renderRoute(
      <DisasterArrival disaster={disaster} environments={[]} reducedMotion onDone={() => {}} />,
    );
    expect(screen.queryByTestId('disaster-ripple')).toBeNull();
  });

  it('시간이 지나거나 누르거나 Esc 면 닫힌다', () => {
    const onDone = vi.fn();
    renderRoute(
      <DisasterArrival disaster={disaster} environments={[]} reducedMotion onDone={onDone} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('alert'));
    act(() => vi.advanceTimersByTime(ARRIVAL_SHOW_MS));
    expect(onDone).toHaveBeenCalledTimes(3);
  });
});
