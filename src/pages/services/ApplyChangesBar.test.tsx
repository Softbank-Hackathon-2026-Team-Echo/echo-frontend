import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { ServiceDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ApplyChangesBar } from './ApplyChangesBar';

const API = 'http://api.test/api/v1';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });
const SHA = 'a'.repeat(40);

const me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [{ id: 'o1', slug: 'echo-demo', name: 'Echo', role: 'DEVELOPER' }],
};

const link = (id: string, extra = {}) => ({
  serviceEnvironmentId: `se-${id}`,
  environment: { id, name: id, kind: 'aws' },
  role: 'SERVING',
  currentDeployment: { commitSha: SHA },
  activeRequestId: null,
  queuedRequestId: null,
  ...extra,
});

const service = (environments: unknown[]) =>
  ({ id: 's1', name: 'demo', environments }) as unknown as ServiceDetail;

const pending = { key: 'DATABASE_URL', version: 3, appliedVersion: 2, pendingRedeploy: true };

function serve(items: unknown[], history: unknown[] = []) {
  const deploys: unknown[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/services/s1/environments/:env/variables`, () =>
      ok({ items, simulated: false }),
    ),
    http.get(`${API}/orgs/o1/services/s1/deploy-requests`, () =>
      ok({ items: history, total: history.length, page: 0, size: 20 }),
    ),
    http.post(`${API}/orgs/o1/services/s1/deploy-requests`, async ({ request }) => {
      deploys.push(await request.json());
      return ok({ id: 'r1' }, 202);
    }),
  );
  return deploys;
}

function renderBar(environments: unknown[], onApplied = vi.fn(), onChooseRef = vi.fn()) {
  return renderRoute(
    <ApplyChangesBar
      orgId="o1"
      service={service(environments)}
      onApplied={onApplied}
      onChooseRef={onChooseRef}
    />,
    { path: '/o/:slug/services', url: '/o/echo-demo/services' },
  );
}

/** 역할은 /me 를 받은 뒤에 정해지고 그때 버튼이 다시 그려진다 */
async function deployButton() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy changes' })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    ),
  );
  return screen.getByRole('button', { name: 'Deploy changes' });
}

describe('ApplyChangesBar', () => {
  it('적용 전 변수가 없으면 보이지 않는다', async () => {
    serve([{ ...pending, pendingRedeploy: false }]);
    const view = renderBar([link('e1')]);

    await waitFor(() => expect(view.container).toBeEmptyDOMElement());
  });

  it('변경 수를 보이고 현재 커밋으로 그 환경만 다시 배포한다', async () => {
    const deploys = serve([pending]);
    const onApplied = vi.fn();
    renderBar([link('e1')], onApplied);

    expect(await screen.findByText('Apply 1 change')).toBeInTheDocument();
    await userEvent.click(await deployButton());

    await waitFor(() =>
      expect(deploys).toEqual([{ environmentId: 'e1', commitSha: SHA, simulate: null }]),
    );
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
  });

  it('Details 는 키 · 버전 · 재배포될 환경을 보이고 값은 없다', async () => {
    serve([pending]);
    renderBar([link('e1')]);

    await userEvent.click(await screen.findByRole('button', { name: 'Details' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('DATABASE_URL')).toBeInTheDocument();
    expect(within(dialog).getByText('v2 → v3')).toBeInTheDocument();
    expect(within(dialog).getByText('demo will redeploy aaaaaaa on e1.')).toBeInTheDocument();
  });

  it('첫 배포가 실패한 환경은 그때의 커밋으로 다시 배포한다', async () => {
    const deploys = serve(
      [{ ...pending, appliedVersion: null }],
      [{ id: 'r0', environment: { id: 'e1' }, commitSha: 'b'.repeat(40) }],
    );
    renderBar([link('e1', { currentDeployment: null })]);

    await screen.findByText('Apply 1 change');
    await userEvent.click(await deployButton());

    await waitFor(() =>
      expect(deploys).toEqual([{ environmentId: 'e1', commitSha: 'b'.repeat(40), simulate: null }]),
    );
  });

  it('고를 커밋이 없으면 배포 창으로 넘긴다', async () => {
    const deploys = serve([{ ...pending, appliedVersion: null }]);
    const onChooseRef = vi.fn();
    renderBar([link('e1', { currentDeployment: null })], vi.fn(), onChooseRef);

    await userEvent.click(await deployButton());

    await waitFor(() => expect(onChooseRef).toHaveBeenCalledWith('e1'));
    expect(deploys).toEqual([]);
  });

  it('배포 중이면 다시 누를 수 없다', async () => {
    serve([pending]);
    renderBar([link('e1', { activeRequestId: 'r5' })]);

    expect(await screen.findByRole('button', { name: 'Deploying…' })).toBeDisabled();
  });
});
