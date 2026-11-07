import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Disaster } from '@/lib/api/disasters';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ActiveDisasterCard } from './ActiveDisasterCard';

const disaster = {
  id: 'd1',
  type: 'EARTHQUAKE',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
  radiusKm: 302,
  meetsThreshold: true,
  source: 'SIMULATED',
  simulated: true,
  createdBy: { id: 'u1', login: 'echoport' },
  feedEvent: null,
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

  const names = new Map([
    ['e1', 'aws-tokyo'],
    ['e2', 'gcp-seoul'],
  ]);
  const feedDisaster = {
    ...disaster,
    source: 'LIVE_FEED',
    simulated: false,
    createdBy: null,
    plans: [],
    feedEvent: {
      provider: 'USGS',
      eventId: 'us1',
      place: '10 km E of Tokyo',
      occurredAt: '2026-11-07T00:00:00Z',
      depthKm: 10,
      url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us1',
      nearestDistanceKm: 12,
    },
  } as Disaster;
  const renderCard = (value: Disaster) =>
    renderRoute(
      <ActiveDisasterCard orgId="o1" orgSlug="echo-demo" disaster={value} names={names} />,
      { path: '/o/:slug', url: '/o/echo-demo' },
    );

  function serveMe() {
    server.use(
      http.get('http://api.test/api/v1/me', () =>
        HttpResponse.json({
          success: true,
          data: {
            user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
            organizations: [
              { id: 'o1', slug: 'echo-demo', name: 'Echo', personal: false, role: 'DEVELOPER' },
            ],
          },
        }),
      ),
    );
  }

  it('버튼 재난은 수동 출처와 simulated 를 보이고 대피 계획 버튼이 없다', () => {
    renderCard(disaster);

    expect(screen.getByText('Manual (simulated)')).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create evacuation plans' })).toBeNull();
  });

  it('실제 지진은 simulated 없이 사건 정보를 보이고 만든 사람이 없어도 그려진다', () => {
    renderCard(feedDisaster);

    expect(screen.getByText('Real earthquake · USGS')).toBeInTheDocument();
    expect(screen.queryByText('simulated')).toBeNull();
    expect(screen.getByText('10 km E of Tokyo')).toBeInTheDocument();
    expect(screen.getByText('12 km')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End disaster' })).toBeInTheDocument();
  });

  it('시연 주입은 주입 출처와 simulated 를 같이 보인다', () => {
    renderCard({ ...feedDisaster, source: 'FEED_INJECTED', simulated: true });

    expect(screen.getByText('Demo injection')).toBeInTheDocument();
    expect(screen.getByText('simulated')).toBeInTheDocument();
  });

  it('피해 환경이 없으면 대피 계획 버튼이 없다', () => {
    renderCard({ ...feedDisaster, affectedEnvironmentIds: [] });

    expect(screen.queryByRole('button', { name: 'Create evacuation plans' })).toBeNull();
  });

  it('대피 계획은 실제 이전을 밝히는 확인을 거쳐야 보낸다', async () => {
    serveMe();
    let called = 0;
    server.use(
      http.post('http://api.test/api/v1/orgs/o1/disasters/d1/evacuate', () => {
        called += 1;
        return HttpResponse.json({ success: true, data: feedDisaster });
      }),
    );
    renderCard(feedDisaster);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create evacuation plans' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create evacuation plans' }));

    expect(await screen.findByText(/This moves live traffic off aws-tokyo/)).toBeInTheDocument();
    expect(called).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Create plans' }));
    await waitFor(() => expect(called).toBe(1));
  });

  it('이미 끝난 재난이면 409 뒤 확인 창을 닫는다', async () => {
    serveMe();
    server.use(
      http.post('http://api.test/api/v1/orgs/o1/disasters/d1/evacuate', () =>
        HttpResponse.json(
          { success: false, error: { code: 'DISASTER_NOT_ACTIVE', message: 'ended' } },
          { status: 409 },
        ),
      ),
    );
    renderCard(feedDisaster);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create evacuation plans' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create evacuation plans' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Create plans' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
