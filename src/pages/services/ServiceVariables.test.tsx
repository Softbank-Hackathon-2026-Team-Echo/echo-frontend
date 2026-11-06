import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Me, MemberRole, ServiceDetail } from '@/lib/api/types';
import { variableKeyProblem } from '@/lib/api/variables';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ServiceVariables } from './ServiceVariables';

const API = 'http://api.test/api/v1';
const AT = '2026-11-05T00:00:00Z';
const BASE = `${API}/orgs/o1/services/s1/environments/e1/variables`;
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

const link = (id: string, name: string) => ({
  serviceEnvironmentId: `se-${id}`,
  environment: { id, name, kind: 'aws' },
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

function serve({ role = 'ADMIN' as MemberRole, items = [variable()], simulated = false } = {}) {
  const puts: { key: string; body: unknown }[] = [];
  const deletes: string[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me(role))),
    http.get(BASE, () => ok({ items, simulated })),
    http.put(`${BASE}/:key`, async ({ params, request }) => {
      puts.push({ key: String(params.key), body: await request.json() });
      return ok({ ...variable(), simulated }, 201);
    }),
    http.delete(`${BASE}/:key`, ({ params }) => {
      deletes.push(String(params.key));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { puts, deletes };
}

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
  it('환경이 없으면 먼저 배포하라고 말한다', async () => {
    serve();
    renderPanel(vi.fn(), []);

    expect(await screen.findByText('Deploy first')).toBeInTheDocument();
  });

  it('키 · 저장 위치 · 버전만 보이고 다시 배포가 필요하다고 알린다', async () => {
    const onDeploy = vi.fn();
    serve();
    renderPanel(onDeploy);

    expect(await screen.findByText('DATABASE_URL')).toBeInTheDocument();
    expect(screen.getByText('GCP Secret Manager')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('Redeploy to apply')).toBeInTheDocument();

    await clickWhenAllowed('Redeploy now');
    expect(onDeploy).toHaveBeenCalledWith('e1');
  });

  it('새 키를 넣으면 PUT 으로 보내고 닫으면 값이 남지 않는다', async () => {
    const { puts } = serve({ items: [] });
    renderPanel();

    await clickWhenAllowed('Add variable');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Key'), 'API_KEY');
    await userEvent.type(within(dialog).getByLabelText('New value'), 'top-secret');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(puts).toEqual([{ key: 'API_KEY', body: { value: 'top-secret' } }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Add variable' }));
    expect(await screen.findByLabelText('New value')).toHaveValue('');
  });

  it('예약 이름은 보내지 않고 이유를 보인다', async () => {
    const { puts } = serve({ items: [] });
    renderPanel();

    await clickWhenAllowed('Add variable');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Key'), 'ECHO_TOKEN');
    await userEvent.type(within(dialog).getByLabelText('New value'), 'x');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByText(/are reserved/)).toBeInTheDocument();
    expect(puts).toEqual([]);
  });

  it('값 바꾸기는 키를 고정하고 값만 받는다', async () => {
    const { puts } = serve();
    renderPanel();

    await clickWhenAllowed('Replace value');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Key')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('New value'), 'next');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(puts[0]?.key).toBe('DATABASE_URL'));
  });

  it('삭제는 키 이름을 입력해야 보낸다', async () => {
    const { deletes } = serve();
    renderPanel();

    await clickWhenAllowed('Delete DATABASE_URL');
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'DATABASE_URL');
    await userEvent.click(within(dialog).getByRole('button', { name: /Delete/ }));

    await waitFor(() => expect(deletes).toEqual(['DATABASE_URL']));
  });

  it('뷰어는 넣을 수 없고 개발자는 지울 수 없다', async () => {
    serve({ role: 'VIEWER' });
    const view = renderPanel();

    expect(await screen.findByRole('button', { name: 'Add variable' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    view.unmount();

    serve({ role: 'DEVELOPER' });
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Delete DATABASE_URL' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('가짜 보관함이면 simulated 를 단다', async () => {
    serve({ simulated: true });
    renderPanel();

    expect(await screen.findByText('simulated')).toBeInTheDocument();
  });
});
