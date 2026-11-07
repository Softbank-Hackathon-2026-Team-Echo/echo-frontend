import { QueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const ENVIRONMENTS = [
  { id: 'e-gcp', name: 'gcp-osaka', location: 'asia-northeast2', coordinates: null },
  { id: 'e-aws', name: 'aws-tokyo', location: 'ap-northeast-1', coordinates: null },
];

function serve({
  active = [] as unknown[],
  environments = ENVIRONMENTS,
  slowList = false,
  failList = false,
} = {}) {
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
        items: environments,
        total: environments.length,
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
    http.get(`${API}/orgs/o1/disasters`, async () => {
      if (slowList) await delay(300);
      if (failList) {
        return HttpResponse.json(
          { success: false, error: { code: 'INTERNAL_ERROR', message: 'down' } },
          { status: 500 },
        );
      }
      return ok({ items: state.active, total: state.active.length, page: 0, size: 50 });
    }),
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
  return { calls, bodies, state };
}

function renderPage(queryClient?: QueryClient) {
  return renderRoute(<ShakeRemotePage />, {
    path: '/o/:slug/remote/shake',
    url: '/o/echo-demo/remote/shake',
    queryClient,
  });
}

const simulateButton = () => screen.getByRole('button', { name: /Simulate an impact/ });
const watchButton = () => screen.getByRole('button', { name: /Start watching/ });
const confirmBox = () => screen.getByLabelText('I understand real traffic will move');

async function loaded() {
  await waitFor(() =>
    expect(screen.getByLabelText('Affected environment')).toHaveTextContent('aws-tokyo'),
  );
}

/** 체크를 켜고 재난 목록까지 받아 보낼 수 있는 상태가 될 때까지 기다린다 */
async function confirmed(user: ReturnType<typeof userEvent.setup>) {
  await loaded();
  await user.click(confirmBox());
  await waitFor(() => expect(watchButton()).toBeEnabled());
}

function shake(z = 40) {
  act(() => {
    const event = Object.assign(new Event('devicemotion'), {
      accelerationIncludingGravity: { x: 0, y: 0, z },
    });
    window.dispatchEvent(event);
  });
}

describe('ShakeRemotePage', () => {
  beforeEach(() => {
    vi.stubGlobal('DeviceMotionEvent', class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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

  it('실제 이전을 밝히고 체크 전에는 감지 · 흉내내기를 막는다', async () => {
    serve();
    renderPage();
    await loaded();

    expect(
      screen.getByText('The disaster is simulated, but the migrations it starts are real.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Every service on the affected environment moves, not only the one above.'),
    ).toBeInTheDocument();
    expect(watchButton()).toBeDisabled();
    expect(simulateButton()).toBeDisabled();
  });

  it('충격 흉내내기는 두 번 눌러야 aws-tokyo 좌표로 재난을 한 번 낸다', async () => {
    const { calls, bodies } = serve();
    const user = userEvent.setup();
    renderPage();
    await confirmed(user);

    await user.click(simulateButton());
    expect(calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Press again to move traffic' }));

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

  it('두 번째 누름이 5초를 넘기면 처음부터 다시 눌러야 한다', async () => {
    const { calls } = serve();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await confirmed(user);

    await user.click(simulateButton());
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(simulateButton()).toBeEnabled();
    expect(calls).toEqual([]);
  });

  it('재난을 보내면 감지가 꺼져 종료 뒤 흔들어도 다시 나가지 않는다', async () => {
    const { calls } = serve();
    const user = userEvent.setup();
    renderPage();
    await confirmed(user);
    await user.click(watchButton());
    await screen.findByRole('button', { name: /Watching for a drop/ });

    shake();
    await waitFor(() => expect(calls).toEqual(['create']));
    await user.click(await screen.findByRole('button', { name: 'End simulation' }));
    await waitFor(() => expect(calls).toEqual(['create', 'end']));
    await waitFor(() => expect(confirmBox()).not.toBeChecked());

    shake();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toEqual(['create', 'end']);
    expect(watchButton()).toBeDisabled();
  });

  it('감지 중 다른 기기에서 재난이 생기면 감지를 끈다', async () => {
    const { calls, state } = serve();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    renderPage(queryClient);
    await confirmed(user);
    await user.click(watchButton());
    await screen.findByRole('button', { name: /Watching for a drop/ });

    state.active = [disaster];
    await act(() => queryClient.invalidateQueries());
    await screen.findByRole('button', { name: 'End simulation' });
    await user.click(screen.getByRole('button', { name: 'End simulation' }));
    await waitFor(() => expect(calls).toEqual(['end']));
    await waitFor(() => expect(confirmBox()).not.toBeChecked());

    shake();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toEqual(['end']);
  });

  it('진행 중 재난 목록을 받기 전에는 체크해도 보내지 못한다', async () => {
    serve({ active: [disaster], slowList: true });
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(confirmBox());

    expect(simulateButton()).toBeDisabled();
    expect(watchButton()).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'End simulation' })).toBeInTheDocument();
  });

  it('재난 목록을 못 불러오면 이유를 보이고 보내지 못한다', async () => {
    serve({ failList: true });
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(confirmBox());

    expect(
      await screen.findByText(
        'Could not check for active disasters. Sending stays blocked until this loads.',
      ),
    ).toBeInTheDocument();
    expect(simulateButton()).toBeDisabled();
    expect(watchButton()).toBeDisabled();
  });

  it('좌표 없는 환경은 도쿄로 바꾸지 않고 막는다', async () => {
    serve({
      environments: [{ id: 'e-lab', name: 'lab', location: 'unknown-place', coordinates: null }],
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByText(
        'This environment has no coordinates, so nothing can be sent. Pick another one.',
      ),
    ).toBeInTheDocument();
    await user.click(confirmBox());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(simulateButton()).toBeDisabled();
  });

  it('실제 지진이 진행 중이면 SIMULATED 를 숨기고 재난 종료를 보인다', async () => {
    serve({ active: [{ ...disaster, simulated: false, source: 'LIVE_FEED' }] });
    renderPage();

    expect(await screen.findByRole('button', { name: 'End disaster' })).toBeInTheDocument();
    expect(screen.queryByTestId('simulated-badge')).toBeNull();
    expect(screen.queryByText('simulated')).toBeNull();
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
