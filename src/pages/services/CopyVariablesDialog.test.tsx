import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { Me, ServiceDetail } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { ServiceVariables } from './ServiceVariables';

const API = 'http://api.test/api/v1';
const AT = '2026-11-07T00:00:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

const me: Me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'DEVELOPER',
      allowSelfApproval: false,
      createdAt: AT,
    },
  ],
};

const variable = (key: string) => ({
  key,
  version: 1,
  secretRef: 'gcp-sm:x',
  updatedAt: AT,
  updatedBy: null,
  appliedVersion: 1,
  pendingRedeploy: false,
});

const link = (id: string, name: string, role: string) => ({
  serviceEnvironmentId: `se-${id}`,
  environment: { id, name, kind: 'aws' },
  role,
});

const service = {
  id: 's1',
  name: 'demo',
  environments: [
    link('e1', 'aws-tokyo', 'SERVING'),
    link('e2', 'gcp-seoul', 'STANDBY'),
    link('e3', 'onprem', 'STANDBY'),
  ],
} as unknown as ServiceDetail;

const items: Record<string, unknown[]> = {
  e1: [variable('DATABASE_URL'), variable('API_KEY')],
  e2: [variable('DATABASE_URL')],
  e3: [],
};

function serve(response: unknown) {
  const bodies: unknown[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () => ok({ items: [] })),
    http.get(`${API}/orgs/o1/services/s1/environments/:env/variables`, ({ params }) =>
      ok({ items: items[String(params.env)] ?? [], simulated: false }),
    ),
    http.post(`${API}/orgs/o1/services/s1/variables:copy`, async ({ request }) => {
      bodies.push(await request.json());
      return ok(response);
    }),
  );
  return bodies;
}

async function openDialog() {
  renderRoute(<ServiceVariables orgId="o1" service={service} onDeploy={vi.fn()} />, {
    path: '/o/:slug/services',
    url: '/o/echo-demo/services',
  });
  // 역할을 받기 전에는 버튼이 툴팁에 감싸인 비활성 버튼이라, 활성이 된 뒤 다시 찾는다
  const open = () => screen.getByRole('button', { name: 'Copy to environments' });
  await waitFor(() => expect(open()).not.toHaveAttribute('aria-disabled', 'true'));
  await userEvent.click(open());
  return screen.findByRole('dialog');
}

describe('CopyVariablesDialog', () => {
  it('서비스 중 환경을 원본으로 모든 키를 다른 환경에 보내고 값은 보내지 않는다', async () => {
    const bodies = serve({
      copied: [
        { environmentId: 'e3', key: 'API_KEY', version: 1, pendingRedeploy: true },
        { environmentId: 'e3', key: 'DATABASE_URL', version: 1, pendingRedeploy: true },
        { environmentId: 'e2', key: 'API_KEY', version: 1, pendingRedeploy: true },
      ],
      failed: [{ environmentId: 'e2', key: 'DATABASE_URL', code: 'ENV_VAR_ALREADY_EXISTS' }],
      simulated: false,
    });
    const dialog = await openDialog();
    expect(within(dialog).getByRole('radio', { name: 'aws-tokyo' })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: 'onprem' })).toBeDisabled();
    expect(
      within(dialog).getByText('gcp-seoul: 1 existing keys will be skipped'),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy 2 keys' }));

    expect(await within(dialog).findByText('Copied 3 variables.')).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Already set here. Turn on replace to overwrite./),
    ).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        sourceEnvironmentId: 'e1',
        targetEnvironmentIds: ['e2', 'e3'],
        keys: ['API_KEY', 'DATABASE_URL'],
        overwrite: false,
      },
    ]);
  });

  it('고른 키 · 환경 · 덮어쓰기만 보낸다', async () => {
    const bodies = serve({ copied: [], failed: [], simulated: false });
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'API_KEY' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'onprem' }));
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Replace keys that already exist' }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy 1 key' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          sourceEnvironmentId: 'e1',
          targetEnvironmentIds: ['e2'],
          keys: ['DATABASE_URL'],
          overwrite: true,
        },
      ]),
    );
  });

  it('키나 대상 환경이 없으면 보내지 않는다', async () => {
    serve({ copied: [], failed: [], simulated: false });
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'gcp-seoul' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'onprem' }));
    expect(within(dialog).getByRole('button', { name: 'Copy 2 keys' })).toBeDisabled();
  });

  it('서버가 거절하면 이유를 보인다', async () => {
    serve({ copied: [], failed: [], simulated: false });
    server.use(
      http.post(`${API}/orgs/o1/services/s1/variables:copy`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'SECRET_STORE_UNAVAILABLE', message: 'x', details: [] },
          },
          { status: 503 },
        ),
      ),
    );
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Copy 2 keys' }));
    expect(await within(dialog).findByText(/not responding/i)).toBeInTheDocument();
  });
});
