import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import ShakeRemotePage from './ShakeRemotePage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-07T03:00:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const disaster = {
  id: 'd-shake-1',
  type: 'EARTHQUAKE',
  simulated: true,
  magnitude: 7.2,
  epicenter: { lat: 35.68, lng: 139.69 },
  status: 'ACTIVE',
  plans: [
    {
      serviceId: 's-demo',
      planId: 'p1',
      outcome: 'APPROVED',
      reason: null,
      targetEnvironmentId: 'e-gcp',
      planStatus: 'RUNNING',
    },
  ],
};

function serve({ active = [] as unknown[] } = {}) {
  const bodies: unknown[] = [];
  const calls: string[] = [];
  const state = { active };
  server.use(
    http.get(`${API}/me`, () =>
      ok({
        user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
        organizations: [
          {
            id: 'o1',
            slug: 'echo-demo',
            name: 'Echo',
            personal: false,
            role: 'DEVELOPER',
            allowSelfApproval: true,
            createdAt: AT,
          },
        ],
      }),
    ),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({
        items: [
          { id: 'e-gcp', name: 'gcp-osaka', location: 'asia-northeast2', coordinates: null },
          { id: 'e-aws', name: 'aws-tokyo', location: 'ap-northeast-1', coordinates: null },
        ],
        total: 2,
        page: 0,
        size: 100,
      }),
    ),
    http.get(`${API}/orgs/o1/services`, () =>
      ok({
        items: [
          { id: 's-other', name: 'shop' },
          { id: 's-demo', name: 'demo' },
        ],
        total: 2,
        page: 0,
        size: 100,
      }),
    ),
    http.get(`${API}/orgs/o1/disasters`, () =>
      ok({ items: state.active, total: state.active.length, page: 0, size: 50 }),
    ),
    http.post(`${API}/orgs/o1/disasters`, async ({ request }) => {
      calls.push('create');
      bodies.push(await request.json());
      state.active = [disaster];
      return ok(disaster, 201);
    }),
    http.post(`${API}/orgs/o1/disasters/:id/end`, () => {
      calls.push('end');
      state.active = [];
      return ok({ ...disaster, status: 'ENDED' });
    }),
  );
  return { calls, bodies };
}

function renderPage() {
  return renderRoute(<ShakeRemotePage />, {
    path: '/o/:slug/remote/shake',
    url: '/o/echo-demo/remote/shake',
  });
}

describe('ShakeRemotePage', () => {
  it('목업임을 큰 글씨로 밝히고 기본값은 demo · aws-tokyo · M7.2 다', async () => {
    serve();
    renderPage();
    expect(await screen.findByTestId('simulated-badge')).toHaveTextContent('SIMULATED');
    expect(
      screen.getByText('Shake or drop the phone to declare a disaster (simulated drill disaster).'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Service')).toHaveTextContent('demo'));
    expect(screen.getByLabelText('Affected environment')).toHaveTextContent('aws-tokyo');
    expect(screen.getByLabelText('Magnitude')).toHaveTextContent('M7.2');
  });

  it('충격 흉내내기는 aws-tokyo 좌표로 재난을 한 번만 낸다(잠금)', async () => {
    const { calls, bodies } = serve();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText('Affected environment')).toHaveTextContent('aws-tokyo'),
    );
    const simulate = screen.getByRole('button', { name: /Simulate an impact/ });
    await user.click(simulate);
    await user.click(simulate);

    expect(await screen.findByTestId('disaster-id')).toHaveTextContent('d-shake-1');
    expect(calls).toEqual(['create']);
    expect(bodies[0]).toEqual({
      type: 'EARTHQUAKE',
      magnitude: 7.2,
      epicenter: { lat: 35.68, lng: 139.69 },
    });
    expect(screen.getByRole('link', { name: /Open it/ })).toHaveAttribute(
      'href',
      '/o/echo-demo/migrations/p1',
    );
  });

  it('진행 중 재난이 있으면 감지·흉내내기를 막고 종료 버튼을 준다', async () => {
    const { calls } = serve({ active: [disaster] });
    const user = userEvent.setup();
    renderPage();
    const endButton = await screen.findByRole('button', { name: 'End simulation' });
    expect(screen.getByRole('button', { name: /Simulate an impact/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Start watching|Allow motion/ })).toBeDisabled();

    await user.click(endButton);
    await waitFor(() => expect(calls).toEqual(['end']));
  });
});
