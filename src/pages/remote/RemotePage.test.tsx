import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { MemberRole } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import RemotePage from './RemotePage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-05T03:00:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const disaster = {
  id: 'd1',
  type: 'EARTHQUAKE',
  magnitude: 7.2,
  epicenter: { lat: 35.2, lng: 139.4 },
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
};

function serve({
  role = 'DEVELOPER' as MemberRole,
  meetsThreshold = true,
  active = [] as unknown[],
} = {}) {
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
            role,
            allowSelfApproval: true,
            createdAt: AT,
          },
        ],
      }),
    ),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items: [{ id: 'e1', name: 'aws-tokyo' }], total: 1, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/disasters`, () =>
      ok({ items: state.active, total: state.active.length, page: 0, size: 50 }),
    ),
    http.get(`${API}/orgs/o1/disasters/preview`, () =>
      ok({ radiusKm: 302, meetsThreshold, affected: ['e1'], safe: [], unknown: [] }),
    ),
    http.post(`${API}/orgs/o1/disasters`, () => {
      calls.push('create');
      state.active = [disaster];
      return ok(disaster, 201);
    }),
    http.post(`${API}/orgs/o1/disasters/:id/end`, () => {
      calls.push('end');
      state.active = [];
      return ok({ ...disaster, status: 'ENDED' });
    }),
  );
  return calls;
}

function renderPage() {
  return renderRoute(<RemotePage />, { path: '/o/:slug/remote', url: '/o/echo-demo/remote' });
}

async function readyButton(name: string) {
  await waitFor(() => {
    const button = screen.getByRole('button', { name }) as HTMLButtonElement;
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
  });
  return screen.getByRole('button', { name });
}

describe('RemotePage', () => {
  it('실제 이전이 시작되면 두 번 눌러야 보내고 Sent 를 보인다', async () => {
    const calls = serve();
    renderPage();

    expect(await screen.findByText(/This moves live traffic off aws-tokyo/)).toBeInTheDocument();
    await userEvent.click(await readyButton('Trigger disaster'));
    expect(calls).toEqual([]);

    await userEvent.click(await readyButton('Press again to move traffic'));

    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(calls).toEqual(['create']);
    expect(
      screen.getByText('Migration waiting: The security gate is holding it'),
    ).toBeInTheDocument();
  });

  it('기준 미달이면 한 번에 보낸다', async () => {
    const calls = serve({ meetsThreshold: false });
    renderPage();

    await userEvent.click(await readyButton('Trigger disaster'));

    await waitFor(() => expect(calls).toEqual(['create']));
  });

  it('진행 중인 재난이 있으면 새로 내지 않고 끝낼 수 있다', async () => {
    const calls = serve({ active: [disaster] });
    renderPage();

    expect(await screen.findByText('Sent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trigger disaster' })).not.toBeInTheDocument();

    await userEvent.click(await readyButton('End simulation'));

    await waitFor(() => expect(calls).toEqual(['end']));
  });

  it('뷰어는 누를 수 없고 이유가 보인다', async () => {
    serve({ role: 'VIEWER' });
    renderPage();

    expect(await screen.findByText('Requires Developer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trigger disaster' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
