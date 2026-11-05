import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Disaster } from '@/lib/api/disasters';
import { renderRoute } from '@/test/render';
import { ActiveDisasterCard } from './ActiveDisasterCard';

const disaster = {
  id: 'd1',
  type: 'EARTHQUAKE',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
  radiusKm: 302,
  meetsThreshold: true,
  affectedEnvironmentIds: ['e1'],
  safeEnvironmentIds: ['e2'],
  plans: [
    {
      serviceId: 's1',
      planId: 'p1',
      outcome: 'PENDING_APPROVAL',
      reason: 'SECURITY_GATE_BLOCKED',
      targetEnvironmentId: 'e2',
      planStatus: 'PENDING_APPROVAL',
    },
  ],
} as Disaster;

describe('ActiveDisasterCard', () => {
  it('재난이 만든 긴급 이전과 멈춘 이유를 보이고 이전 화면으로 잇는다', () => {
    renderRoute(
      <ActiveDisasterCard
        orgId="o1"
        orgSlug="echo-demo"
        disaster={disaster}
        names={
          new Map([
            ['e1', 'aws-tokyo'],
            ['e2', 'gcp-seoul'],
          ])
        }
      />,
    );

    expect(screen.getByRole('link', { name: 'Emergency migration → gcp-seoul' })).toHaveAttribute(
      'href',
      '/o/echo-demo/migrations/p1',
    );
    expect(screen.getByText('The security gate is holding it')).toBeInTheDocument();
  });
});
