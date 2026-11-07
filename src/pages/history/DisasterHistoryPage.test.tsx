import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import DisasterHistoryPage from './DisasterHistoryPage';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

const me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'VIEWER',
      allowSelfApproval: false,
      createdAt: '2026-11-05T04:42:00Z',
    },
  ],
};

function trackRequests(feed: () => Response) {
  const methods: string[] = [];
  server.events.on('request:start', ({ request }) => methods.push(request.method));
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/disasters/feed`, feed),
  );
  return methods;
}

const render = () =>
  renderRoute(<DisasterHistoryPage />, { path: '/o/:slug/history', url: '/o/echo-demo/history' });

describe('DisasterHistoryPage', () => {
  afterEach(() => server.events.removeAllListeners());

  it('들어와도 조회만 하고 서버가 꺼짐을 확인하면 꺼짐으로 보인다', async () => {
    const methods = trackRequests(() => ok({ connectionStatus: 'DISABLED', lastPolledAt: null }));
    render();
    expect(await screen.findByText('Live intake off')).toBeInTheDocument();
    expect(screen.getByText('Past disaster records are not connected yet')).toBeInTheDocument();
    expect(screen.getByText("Auto migration: can't confirm")).toBeInTheDocument();
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((method) => method === 'GET')).toBe(true);
  });

  it('피드 조회가 실패하면 꺼짐이 아니라 확인 불가다', async () => {
    trackRequests(() => HttpResponse.json({ success: false, code: 'X' }, { status: 500 }));
    render();
    expect(await screen.findByText("Live intake: can't confirm")).toBeInTheDocument();
    expect(screen.queryByText('Live intake off')).not.toBeInTheDocument();
  });
});
