import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { EnvironmentSummary, Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import OnboardingPage from './OnboardingPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-03T00:00:00Z';
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

function environment(id: string, name: string, location: string): EnvironmentSummary {
  return {
    id,
    name,
    kind: 'aws',
    location,
    config: {},
    secretRef: null,
    connectionStatus: 'CONNECTED',
    connectionCheckedAt: AT,
    connectionError: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function serve(environments: EnvironmentSummary[]) {
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/environments`, () =>
      ok({ items: environments, total: environments.length, page: 0, size: 100 }),
    ),
    http.get(`${API}/orgs/o1/services`, () => ok({ items: [], total: 0, page: 0, size: 100 })),
    http.get(`${API}/environment-kinds`, () => ok([])),
  );
}

function renderPage() {
  return renderRoute(<OnboardingPage />, {
    path: '/o/:slug/onboarding',
    url: '/o/echo-demo/onboarding',
  });
}

describe('OnboardingPage', () => {
  it('환경이 없으면 주 환경 연결 단계에서 시작하고 Skip setup 은 대시보드로 간다', async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText('Where does your app run today?')).toBeInTheDocument();
    expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip setup' })).toHaveAttribute(
      'href',
      '/o/echo-demo',
    );
  });

  it('예비 환경이 주 환경과 같은 재난 반경 안이면 경고하고, Continue 로 배포 단계로 간다', async () => {
    serve([
      environment('e1', 'aws-tokyo-prod', 'ap-northeast-1'),
      environment('e2', 'aws-osaka', 'ap-northeast-3'),
    ]);
    renderPage();

    // 환경이 둘이면 배포 단계에서 시작한다. 예비 단계로 돌아가 본다
    await userEvent.click(await screen.findByRole('button', { name: 'Add standby' }));
    expect(await screen.findByText(/Inside the same M8 impact radius/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Deploy your app' })).toBeInTheDocument();
  });
});
