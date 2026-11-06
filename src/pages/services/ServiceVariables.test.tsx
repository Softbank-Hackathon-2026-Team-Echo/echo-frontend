import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Me, MemberRole, ServiceDetail } from '@/lib/api/types';
import { variableKeyProblem } from '@/lib/api/variables';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ServiceVariables } from './ServiceVariables';

const API = 'http://api.test/api/v1';
const AT = '2026-11-05T00:00:00Z';
const base = (environmentId: string) =>
  `${API}/orgs/o1/services/s1/environments/${environmentId}/variables`;
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const me = (role: MemberRole): Me => ({
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role,
      allowSelfApproval: false,
      createdAt: AT,
    },
  ],
});

const link = (id: string, name: string, role = 'SERVING') => ({
  serviceEnvironmentId: `se-${id}`,
  environment: { id, name, kind: 'aws' },
  role,
});

const service = (environments: unknown[]) =>
  ({ id: 's1', name: 'demo', environments }) as unknown as ServiceDetail;

const variable = (extra = {}) => ({
  key: 'DATABASE_URL',
  version: 3,
  secretRef: 'gcp-sm:projects/p/secrets/s/versions/3',
  updatedAt: AT,
  updatedBy: { id: 'u1', githubLogin: 'octocat' },
  appliedVersion: 2,
  pendingRedeploy: true,
  ...extra,
});

type Put = { environmentId: string; key: string; body: unknown };

function serve({
  role = 'ADMIN' as MemberRole,
  items = [variable()],
  standbyItems = [] as unknown[],
  simulated = false,
  failKey = '',
  connected = ['e1'],
} = {}) {
  const puts: Put[] = [];
  const deletes: string[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me(role))),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({
        items: [
          { id: 'e1', name: 'aws-tokyo' },
          { id: 'e2', name: 'gcp-seoul' },
        ],
      }),
    ),
    // 연결 전 환경은 지금 운영처럼 404 다. echo-was #96 이 켜지면 답한다
    http.get(`${API}/orgs/o1/services/s1/environments/:env/variables`, ({ params }) => {
      if (!connected.includes(String(params.env)))
        return HttpResponse.json(
          {
            success: false,
            error: { code: 'SERVICE_ENVIRONMENT_NOT_FOUND', message: 'x', details: [] },
          },
          { status: 404 },
        );
      return ok({ items: params.env === 'e1' ? items : standbyItems, simulated });
    }),
    http.put(
      `${API}/orgs/o1/services/s1/environments/:env/variables/:key`,
      async ({ params, request }) => {
        if (params.key === failKey)
          return HttpResponse.json(
            {
              success: false,
              error: { code: 'SECRET_STORE_UNAVAILABLE', message: 'x', details: [] },
            },
            { status: 502 },
          );
        puts.push({
          environmentId: String(params.env),
          key: String(params.key),
          body: await request.json(),
        });
        return ok({ ...variable(), simulated }, 201);
      },
    ),
    http.delete(`${base('e1')}/:key`, ({ params }) => {
      deletes.push(String(params.key));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { puts, deletes };
}

const both = [link('e1', 'aws-tokyo'), link('e2', 'gcp-seoul', 'STANDBY')];

function renderPanel(onDeploy = vi.fn(), environments: unknown[] = [link('e1', 'aws-tokyo')]) {
  return renderRoute(
    <ServiceVariables orgId="o1" service={service(environments)} onDeploy={onDeploy} />,
    { path: '/o/:slug/services', url: '/o/echo-demo/services' },
  );
}

/** 역할은 /me 를 받은 뒤에 정해진다. 그 전에는 버튼이 비활성이다 */
async function clickWhenAllowed(name: string) {
  await waitFor(() =>
    expect(screen.getByRole('button', { name })).not.toHaveAttribute('aria-disabled', 'true'),
  );
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('variableKeyProblem', () => {
  it('서버 규칙대로 이름을 가른다', () => {
    expect(variableKeyProblem('DATABASE_URL')).toBeNull();
    expect(variableKeyProblem('database_url')).toBe('invalid');
    expect(variableKeyProblem('1KEY')).toBe('invalid');
    expect(variableKeyProblem('PORT')).toBe('reserved');
    expect(variableKeyProblem('ECHO_TOKEN')).toBe('reserved');
  });
});

describe('ServiceVariables', () => {
  beforeAll(() => {
    // Radix 메뉴가 쓰는데 jsdom 에 없다
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.scrollIntoView = () => {};
  });

  it('환경이 없으면 먼저 배포하게 한다', async () => {
    const onDeploy = vi.fn();
    serve({ connected: [] });
    renderPanel(onDeploy, []);

    expect(await screen.findByText('Deploy first')).toBeInTheDocument();
    await clickWhenAllowed('Deploy');
    expect(onDeploy).toHaveBeenCalled();
  });

  it('키 × 환경 표에 버전과 적용 상태가 보이고 값은 없다', async () => {
    serve();
    renderPanel();

    expect(await screen.findByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'aws-tokyo' })).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('Redeploy to apply')).toBeInTheDocument();
  });

  it('서비스 중 환경에 있는 키가 예비에 없으면 이전이 막힌다고 알리고 바로 넣게 한다', async () => {
    const { puts } = serve({ connected: ['e1', 'e2'] });
    renderPanel(vi.fn(), both);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'gcp-seoul is missing DATABASE_URL',
    );
    expect(screen.getByText('Missing')).toBeInTheDocument();

    await clickWhenAllowed('Add DATABASE_URL to gcp-seoul');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('New value'), 'next');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await expect.poll(() => puts.map((put) => put.environmentId)).toEqual(['e2']);
  });

  it('한 줄 입력으로 고른 환경 모두에 넣고 이어서 넣을 수 있다', async () => {
    const { puts } = serve({ items: [], connected: ['e1', 'e2'] });
    renderPanel(vi.fn(), both);

    await clickWhenAllowed('New variable');
    await userEvent.type(screen.getByLabelText('Key'), 'API_KEY');
    await userEvent.type(screen.getByLabelText('Value'), 'top-secret');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(puts.map((put) => put.environmentId).sort()).toEqual(['e1', 'e2']));
    await waitFor(() => expect(screen.getByLabelText('Value')).toHaveValue(''));
  });

  it('예약 이름은 보내지 않고 이유를 보인다', async () => {
    const { puts } = serve({ items: [] });
    renderPanel();

    await clickWhenAllowed('New variable');
    await userEvent.type(screen.getByLabelText('Key'), 'ECHO_TOKEN');
    await userEvent.type(screen.getByLabelText('Value'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText(/are reserved/)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('.env 를 붙여 넣으면 키를 미리 보이고 고른 환경에 저장한다', async () => {
    const { puts } = serve({ connected: ['e1', 'e2'] });
    renderPanel(vi.fn(), both);

    await clickWhenAllowed('Paste .env');
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('.env contents'));
    await userEvent.paste('A_KEY=1\nB_KEY=2\nPORT=80');

    expect(within(dialog).getByText('A_KEY')).toBeInTheDocument();
    expect(within(dialog).getByText('Line 3: PORT is reserved.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText('gcp-seoul'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save 2 variables' }));

    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts.every((put) => put.environmentId === 'e1')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('일부만 실패하면 실패한 키만 다시 보낸다', async () => {
    const { puts } = serve({ failKey: 'B_KEY' });
    renderPanel();

    await clickWhenAllowed('Paste .env');
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('.env contents'));
    await userEvent.paste('A_KEY=1\nB_KEY=2');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save 2 variables' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('B_KEY');
    expect(puts.map((put) => put.key)).toEqual(['A_KEY']);
    expect(within(dialog).getByRole('button', { name: 'Retry failed' })).toBeInTheDocument();
  });

  it('값 바꾸기는 키를 고정하고 값만 받는다', async () => {
    const { puts } = serve();
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for DATABASE_URL on aws-tokyo' }),
    );
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Replace value' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Key')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('New value'), 'next');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(puts[0]?.key).toBe('DATABASE_URL'));
  });

  it('삭제는 키 이름을 입력해야 보낸다', async () => {
    const { deletes } = serve();
    renderPanel();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for DATABASE_URL on aws-tokyo' }),
    );
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'DATABASE_URL');
    await userEvent.click(within(dialog).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(deletes).toEqual(['DATABASE_URL']));
  });

  it('뷰어는 넣을 수 없고 개발자는 지울 수 없다', async () => {
    serve({ role: 'VIEWER' });
    const view = renderPanel();

    expect(await screen.findByRole('button', { name: 'New variable' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    view.unmount();

    serve({ role: 'DEVELOPER' });
    renderPanel();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Actions for DATABASE_URL on aws-tokyo' }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('배포한 적 없는 환경은 배포로 안내한다', async () => {
    const onDeploy = vi.fn();
    serve();
    renderPanel(onDeploy);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deploy to gcp-seoul' })).not.toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deploy to gcp-seoul' }));
    expect(onDeploy).toHaveBeenCalledWith('e2');
  });

  it('서버가 첫 배포 전 변수를 받으면 연결 전 환경도 표의 칸이 된다', async () => {
    serve({ connected: ['e1', 'e2'] });
    renderPanel();

    expect(await screen.findByRole('columnheader', { name: 'gcp-seoul' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deploy to gcp-seoul' })).not.toBeInTheDocument();
  });

  it('가짜 보관함이면 simulated 를 단다', async () => {
    serve({ simulated: true });
    renderPanel();

    expect(await screen.findByText('simulated')).toBeInTheDocument();
  });
});
