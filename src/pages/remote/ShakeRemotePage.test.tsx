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

/** 기본 M6.8 은 이전 기준 미만이라 체크 없이 재난 목록만 받으면 보낼 수 있다 */
async function ready() {
  await loaded();
  await waitFor(() => expect(watchButton()).toBeEnabled());
}

/** M7.2 로 올리고 체크를 켜서 실제 이전이 시작되는 재난을 보낼 수 있게 한다 */
async function confirmed(user: ReturnType<typeof userEvent.setup>) {
  await loaded();
  await user.click(screen.getByRole('combobox', { name: 'Magnitude' }));
  await user.click(await screen.findByRole('option', { name: 'M7.2' }));
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
    // 규모 선택(Radix Select)이 jsdom 에 없는 포인터 · 스크롤 API 를 부른다
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('목업임을 큰 글씨로 밝히고 기본값은 demo · aws-tokyo · M6.8 다', async () => {
    serve();
    renderPage();
    expect(await screen.findByTestId('simulated-badge')).toHaveTextContent('SIMULATED');
    expect(
      screen.getByText('Shake or drop the phone to declare a disaster (simulated drill disaster).'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Service')).toHaveTextContent('demo'));
    expect(screen.getByLabelText('Affected environment')).toHaveTextContent('aws-tokyo');
    expect(screen.getByLabelText('Magnitude')).toHaveTextContent('M6.8');
  });

  it('기준(M7.0) 미만이면 이전하지 않는다고 적고 체크 없이 보낼 수 있다', async () => {
    serve();
    renderPage();
    await ready();

    expect(
      screen.getByText(
        'Below M7.0. Affected environments are flagged, but no evacuation is proposed.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('I understand real traffic will move')).toBeNull();
    expect(simulateButton()).toBeEnabled();
  });

  it('기준 이상이면 실제 이전을 밝히고 체크 전에는 감지 · 흉내내기를 막는다', async () => {
    serve();
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('combobox', { name: 'Magnitude' }));
    await user.click(await screen.findByRole('option', { name: 'M7.2' }));

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
    await ready();

    await user.click(simulateButton());
    expect(calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Press again to send' }));

    expect(await screen.findByTestId('disaster-id')).toHaveTextContent('d-shake-1');
    expect(calls).toEqual(['create']);
    expect(bodies[0]).toEqual({
      type: 'EARTHQUAKE',
      magnitude: 6.8,
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
    await ready();

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

  it('진행 중 재난 목록을 받기 전에는 보내지 못한다', async () => {
    serve({ active: [disaster], slowList: true });
    renderPage();
    await loaded();

    expect(simulateButton()).toBeDisabled();
    expect(watchButton()).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'End simulation' })).toBeInTheDocument();
  });

  it('재난 목록을 못 불러오면 이유를 보이고 보내지 못한다', async () => {
    serve({ failList: true });
    renderPage();
    await loaded();

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
    renderPage();

    expect(
      await screen.findByText(
        'This environment has no coordinates, so nothing can be sent. Pick another one.',
      ),
    ).toBeInTheDocument();
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
