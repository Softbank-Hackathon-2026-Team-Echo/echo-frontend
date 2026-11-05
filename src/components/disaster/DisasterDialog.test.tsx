import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { DisasterDialog } from './DisasterDialog';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const environment = (id: string, name: string) => ({
  id,
  name,
  kind: 'aws',
  location: null,
  coordinates: { lat: 35.68, lng: 139.69 },
});

function serve({
  meetsThreshold = true,
  affected = ['e1'],
  allowSelfApproval = true,
}: {
  meetsThreshold?: boolean;
  affected?: string[];
  allowSelfApproval?: boolean;
} = {}) {
  const created: unknown[] = [];
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
            allowSelfApproval,
          },
        ],
      }),
    ),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({
        items: [environment('e1', 'aws-tokyo'), environment('e2', 'gcp-seoul')],
        total: 2,
        page: 0,
        size: 100,
      }),
    ),
    http.get(`${API}/orgs/o1/disasters/preview`, () =>
      ok({ radiusKm: 302, meetsThreshold, affected, safe: ['e2'], unknown: [] }),
    ),
    http.post(`${API}/orgs/o1/disasters`, async ({ request }) => {
      created.push(await request.json());
      return ok({ id: 'd1', plans: [] }, 201);
    }),
  );
  return created;
}

function renderDialog(onCreated = vi.fn()) {
  return renderRoute(
    <DisasterDialog open onOpenChange={() => {}} orgId="o1" onCreated={onCreated} />,
  );
}

describe('DisasterDialog', () => {
  it('이전 기준(규모)과 출처(시뮬레이션 · 실제 피드 자리)를 보여 준다', async () => {
    serve();
    renderDialog();

    expect(await screen.findByText('Magnitude 7.0 or above')).toBeInTheDocument();
    expect(screen.getByText('Manual (simulated)')).toBeInTheDocument();
    expect(screen.getByText(/Live feed \(P2P地震情報\) not connected yet/)).toBeInTheDocument();
  });

  it('기준을 넘으면 실제 이전이라고 밝히고 확인해야 보낸다', async () => {
    const created = serve();
    const onCreated = vi.fn();
    renderDialog(onCreated);

    expect(await screen.findByText('This moves live traffic off aws-tokyo.')).toBeInTheDocument();
    expect(
      screen.getByText('Self-approval is on, so migrations start as soon as you confirm.'),
    ).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Start disaster and migrate' });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(submit);

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(created).toEqual([
      { type: 'EARTHQUAKE', magnitude: 7.2, epicenter: { lat: 35.2, lng: 139.4 } },
    ]);
  });

  it('자기 승인이 꺼져 있으면 승인을 기다린다고 말한다', async () => {
    serve({ allowSelfApproval: false });
    renderDialog();

    expect(
      await screen.findByText('Each migration waits for another developer to approve it.'),
    ).toBeInTheDocument();
  });

  it('기준 미달이면 확인 없이 낼 수 있고 실제 이전을 말하지 않는다', async () => {
    serve({ meetsThreshold: false });
    renderDialog();

    const submit = await screen.findByRole('button', { name: 'Simulate' });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
