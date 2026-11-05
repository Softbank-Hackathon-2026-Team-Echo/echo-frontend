import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AuditLog, Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import AuditPage from './AuditPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-05T03:00:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

const me: Me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'VIEWER',
      allowSelfApproval: false,
      createdAt: AT,
    },
  ],
};

const log = (id: string, extra: Partial<AuditLog> = {}): AuditLog => ({
  id,
  at: AT,
  actor: {
    type: 'USER',
    userId: 'u1',
    githubLogin: 'echoport',
    agentTokenId: null,
    agentTokenName: null,
    component: null,
  },
  action: 'MIGRATION_PLAN_APPROVED',
  route: null,
  path: null,
  target: { type: 'migration_plan', id: 'p1', label: 'demo · aws-tokyo → gcp-seoul' },
  result: 'SUCCEEDED',
  reason: null,
  details: {},
  requestId: '9f2c11aa22bb',
  ...extra,
});

function serve(items: AuditLog[], total = items.length) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/me`, () => ok(me)),
    http.get(`${API}/orgs/o1/audit-logs`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      queries.push(query);
      return ok({ items, total, page: Number(query.get('page')), size: 1 });
    }),
  );
  return queries;
}

function renderPage() {
  return renderRoute(<AuditPage />, { path: '/o/:slug/audit', url: '/o/echo-demo/audit' });
}

describe('AuditPage', () => {
  it('누가 · 무엇을 · 대상 · 결과를 한 줄로 보인다', async () => {
    serve([log('a1')]);
    renderPage();

    const row = (await screen.findByText('echoport')).closest('li') as HTMLElement;
    expect(within(row).getByText(/approved migration plan/)).toBeInTheDocument();
    expect(within(row).getByText(/demo · aws-tokyo → gcp-seoul/)).toBeInTheDocument();
    expect(within(row).getByText('Succeeded')).toBeInTheDocument();
    expect(within(row).getByText(/req 9f2c11aa/)).toBeInTheDocument();
  });

  it('거부된 에이전트 시도는 토큰 이름과 이유를 보인다', async () => {
    serve([
      log('a2', {
        actor: {
          type: 'AGENT',
          userId: null,
          githubLogin: null,
          agentTokenId: 't1',
          agentTokenName: 'echoport-agent',
          component: null,
        },
        result: 'DENIED',
        reason: 'INSUFFICIENT_ROLE',
      }),
    ]);
    renderPage();

    expect(await screen.findByText('echoport-agent')).toBeInTheDocument();
    expect(screen.getByText('Denied')).toBeInTheDocument();
    expect(screen.getByText(/INSUFFICIENT_ROLE/)).toBeInTheDocument();
  });

  it('모르는 행동과 결과는 서버 값을 그대로 보인다', async () => {
    serve([log('a3', { action: 'POST /api/v1/orgs/{org_id}/services', target: null })]);
    renderPage();

    expect(await screen.findByText('POST /api/v1/orgs/{org_id}/services')).toBeInTheDocument();
  });

  it('가짜 실행 기록에는 simulated 를 단다', async () => {
    serve([log('a4', { details: { simulated: true } })]);
    renderPage();

    expect(await screen.findByText('simulated')).toBeInTheDocument();
  });

  it('행위자 탭과 검색어를 서버 조건으로 보낸다', async () => {
    const queries = serve([log('a5')]);
    renderPage();

    await userEvent.click(await screen.findByRole('tab', { name: 'AI Agent' }));
    await userEvent.type(screen.getByRole('textbox'), 'demo');

    await waitFor(() => {
      const last = queries.at(-1);
      expect(last?.get('actorType')).toBe('AGENT');
      expect(last?.get('q')).toBe('demo');
    });
  });

  it('더 있으면 다음 페이지를 이어 붙인다', async () => {
    const queries = serve([log('a6')], 60);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(queries.at(-1)?.get('page')).toBe('1'));
  });

  it('조건에 맞는 줄이 없으면 다른 조건을 안내한다', async () => {
    serve([]);
    renderPage();

    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'System' }));
    expect(await screen.findByText('No matching entries')).toBeInTheDocument();
  });
});
