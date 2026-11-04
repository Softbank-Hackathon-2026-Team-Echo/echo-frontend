import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { EnvironmentSummary, Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import SecurityPage from './SecurityPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-04T03:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

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

const environment = (id: string, name: string, kind: string): EnvironmentSummary => ({
  id,
  name,
  kind,
  location: null,
  config: {},
  secretRef: null,
  connectionStatus: 'CONNECTED',
  connectionCheckedAt: AT,
  connectionError: null,
  createdAt: AT,
  updatedAt: AT,
});

function serve(items: EnvironmentSummary[]) {
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items, total: items.length, page: 0, size: 100 }),
    ),
  );
}

function renderPage() {
  return renderRoute(<SecurityPage />, { path: '/o/:slug/security', url: '/o/echo-demo/security' });
}

const ENVIRONMENTS = [
  environment('e1', 'aws-tokyo', 'aws'),
  environment('e2', 'gcp-seoul', 'gcp'),
  environment('e3', 'onprem-k3s', 'onprem'),
];

describe('SecurityPage', () => {
  it('환경마다 네 칸을 빈칸 없이 그리고 simulated 를 밝힌다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    expect(await screen.findByRole('button', { name: 'aws-tokyo IAM: Pass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'gcp-seoul Policy: 2 issues' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'onprem-k3s Encryption: Unknown' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('simulated').length).toBeGreaterThan(0);
  });

  it('칸을 누르면 그 칸의 근거가 열린다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'gcp-seoul Policy: 2 issues' }),
    );

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('gcp-seoul · Policy')).toBeInTheDocument();
    expect(within(sheet).getByText('Bucket without retention policy')).toBeInTheDocument();
    expect(within(sheet).getAllByText('Evidence')).toHaveLength(2);
  });

  it('미수집 칸은 판정이 없다고 말한다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'onprem-k3s Encryption: Unknown' }),
    );

    expect(await screen.findByText(/has not been collected yet/)).toBeInTheDocument();
  });

  it('Compare 탭은 두 환경을 나란히 보여 준다', async () => {
    serve(ENVIRONMENTS);
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'Compare' }));

    expect(
      await screen.findByRole('heading', { name: 'Compare environments' }),
    ).toBeInTheDocument();
    expect(screen.getByText('warning only')).toBeInTheDocument();
    expect(screen.queryByText('blocks migration')).not.toBeInTheDocument();
  });

  it('환경이 없으면 등록을 안내한다', async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText('No environments yet')).toBeInTheDocument();
  });
});
