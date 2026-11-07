import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { DeployDialog } from '@/components/DeployDialog';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';

const API = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/orgs/org-1`;

function environment(id: string, name: string, connectionStatus: string) {
  return { id, name, kind: 'aws', location: 'ap-northeast-1', connectionStatus };
}

const ENVIRONMENTS = [
  environment('env-primary', 'tokyo', 'CONNECTED'),
  environment('env-seoul', 'seoul', 'CONNECTED'),
  environment('env-down', 'osaka', 'FAILED'),
  environment('env-new', 'fukuoka', 'UNCHECKED'),
];

function serve(items = ENVIRONMENTS) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.get(`${API}/environments`, () =>
      HttpResponse.json({
        success: true,
        data: { items, total: items.length, page: 1, size: 50 },
      }),
    ),
    http.post(`${API}/services/svc-1/deploy-requests`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ success: true, data: { id: 'deploy-1' } }, { status: 201 });
    }),
  );
  return bodies;
}

function renderDialog() {
  return renderRoute(
    <DeployDialog
      open
      onOpenChange={() => {}}
      orgId="org-1"
      orgSlug="echo-demo"
      serviceId="svc-1"
      serviceName="shop"
      defaultEnvironmentId="env-primary"
    />,
  );
}

describe('DeployDialog 예비 환경', () => {
  it('주 환경은 후보에서 빠지고 접속 실패 환경은 고를 수 없다', async () => {
    serve();
    renderDialog();

    expect(await screen.findByRole('checkbox', { name: /seoul/ })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /osaka/ })).toBeDisabled();
    expect(screen.queryByRole('checkbox', { name: /tokyo/ })).not.toBeInTheDocument();
  });

  it('확인 전 환경은 정상으로 보이지 않게 Not checked 를 단다', async () => {
    serve();
    renderDialog();

    expect(await screen.findByRole('checkbox', { name: /fukuoka.*Not checked/ })).toBeEnabled();
  });

  it('고르지 않으면 빈 목록을 보낸다', async () => {
    const bodies = serve();
    renderDialog();
    await screen.findByRole('checkbox', { name: /seoul/ });

    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]?.standbyEnvironmentIds).toEqual([]);
    expect(bodies[0]?.environmentId).toBe('env-primary');
  });

  it('고른 예비 환경을 요청에 싣는다', async () => {
    const bodies = serve();
    renderDialog();

    await userEvent.click(await screen.findByRole('checkbox', { name: /seoul/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Deploy' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]?.standbyEnvironmentIds).toEqual(['env-seoul']);
  });

  it('5개를 고르면 남은 후보는 비활성이다', async () => {
    const many = [
      environment('env-primary', 'tokyo', 'CONNECTED'),
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((name) =>
        environment(`env-${name}`, `region-${name}`, 'CONNECTED'),
      ),
    ];
    serve(many);
    renderDialog();

    await screen.findByRole('checkbox', { name: /region-a/ });
    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      await userEvent.click(screen.getByRole('checkbox', { name: new RegExp(`region-${name}`) }));
    }

    expect(screen.getByRole('checkbox', { name: /region-f/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /region-a/ })).toBeEnabled();
  });
});
