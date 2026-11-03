import { QueryClient } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/api/query-keys';
import type { Me, MemberRole } from '@/lib/api/types';
import { renderRoute } from '@/test/render';
import { RoleButton } from './RoleButton';

function meWithRole(role: MemberRole): Me {
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
        createdAt: '2026-11-02T00:00:00Z',
      },
    ],
  };
}

function renderButton(role: MemberRole, onClick = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(queryKeys.me(), meWithRole(role));
  renderRoute(
    <RoleButton requires="DEVELOPER" onClick={onClick}>
      Deploy
    </RoleButton>,
    { path: '/o/:slug', url: '/o/echo-demo', queryClient },
  );
  return onClick;
}

describe('RoleButton', () => {
  it('역할이 모자라면 숨기지 않고 비활성으로 두고 누름을 무시한다', async () => {
    const onClick = renderButton('VIEWER');

    const button = await screen.findByRole('button', { name: 'Deploy' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('권한이 없으면 "Requires Developer" 툴팁을 보여 준다', async () => {
    renderButton('VIEWER');

    await userEvent.hover(await screen.findByRole('button', { name: 'Deploy' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Requires Developer');
  });

  it.each<MemberRole>(['DEVELOPER', 'ADMIN'])('%s 는 누를 수 있다', async (role) => {
    const onClick = renderButton(role);

    const button = await screen.findByRole('button', { name: 'Deploy' });
    expect(button).not.toHaveAttribute('aria-disabled');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
