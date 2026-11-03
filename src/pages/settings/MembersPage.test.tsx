import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Me, Member, MemberRole } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import MembersPage from './MembersPage';

const API = 'http://api.test/api/v1/orgs/o1';
const AT = '2026-11-03T00:00:00Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 0, size: 100 });

function me(role: MemberRole): Me {
  return {
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
  };
}

function member(id: string, githubLogin: string, role: MemberRole): Member {
  return { id, githubLogin, name: null, avatarUrl: null, role, joinedAt: AT };
}

function serve(role: MemberRole) {
  const calls: string[] = [];
  server.use(
    http.get('http://api.test/api/v1/me', () => ok(me(role))),
    http.get(`${API}/members`, () =>
      ok(page([member('u1', 'echoport', role), member('u2', 'echoport-dev', 'DEVELOPER')])),
    ),
    http.get(`${API}/invitations`, () => {
      calls.push('invitations');
      return ok(page([]));
    }),
    http.get(`${API}/agent-tokens`, () => {
      calls.push('agent-tokens');
      return ok(page([]));
    }),
    http.post(`${API}/invitations`, () =>
      HttpResponse.json(
        {
          success: false,
          code: 'GITHUB_USER_NOT_FOUND',
          message: 'github user not found',
          details: [{ field: 'githubLogin', reason: 'GITHUB_USER_NOT_FOUND' }],
        },
        { status: 422 },
      ),
    ),
    http.post(`${API}/agent-tokens`, () =>
      ok(
        {
          id: 't1',
          name: 'echoport-agent',
          last4: 'x9Qa',
          createdBy: 'u1',
          createdAt: AT,
          expiresAt: '2026-12-03T00:00:00Z',
          revokedAt: null,
          lastUsedAt: null,
          token: 'echo_agt_secret-value',
        },
        201,
      ),
    ),
  );
  return calls;
}

function renderPage() {
  return renderRoute(<MembersPage />, {
    path: '/o/:slug/settings/members',
    url: '/o/echo-demo/settings/members',
  });
}

describe('MembersPage', () => {
  it('어드민은 다른 사람의 역할만 바꿀 수 있다(자기 역할은 글자로만)', async () => {
    serve('ADMIN');
    renderPage();

    expect(
      await screen.findByRole('combobox', { name: 'Role of echoport-dev' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Role of echoport' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
  });

  it('없는 GitHub 아이디로 초대하면 칸 아래에 이유를 보여 준다', async () => {
    serve('ADMIN');
    renderPage();

    await screen.findByRole('combobox', { name: 'Role of echoport-dev' });
    await userEvent.click(screen.getByRole('button', { name: 'Invite by GitHub ID' }));
    await userEvent.type(screen.getByLabelText('GitHub username'), 'nobody-here');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('No GitHub user has this username.')).toBeInTheDocument();
  });

  it('에이전트 토큰을 발급하면 원문을 한 번 보여 준다', async () => {
    serve('DEVELOPER');
    renderPage();

    await screen.findByText('No agent tokens yet.');
    await userEvent.click(screen.getByRole('button', { name: 'Issue token' }));
    await userEvent.type(screen.getByLabelText('Name'), 'echoport-agent');
    await userEvent.click(screen.getByRole('button', { name: 'Issue token' }));

    expect(await screen.findByLabelText('Agent token')).toHaveValue('echo_agt_secret-value');
  });

  it('뷰어는 초대·토큰 목록을 부르지 않고 버튼은 비활성이다', async () => {
    const calls = serve('VIEWER');
    renderPage();

    expect(
      await screen.findByText('Only admins can see and send invitations.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite by GitHub ID' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Issue token' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(calls).toEqual([]);
  });
});
