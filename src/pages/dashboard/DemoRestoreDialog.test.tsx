import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { DemoRestoreButton } from './DemoRestoreDialog';

function serveMe(role: string) {
  server.use(
    http.get('*/api/v1/me', () =>
      HttpResponse.json({
        success: true,
        data: {
          user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
          organizations: [{ id: 'o1', slug: 'echo-demo', name: 'Echo', personal: false, role }],
        },
      }),
    ),
  );
}

const result = (dryRun: boolean) => ({
  snapshotId: 's1',
  snapshotTakenAt: '2026-11-08T00:00:00Z',
  dryRun,
  restored: !dryRun,
  callAgain: false,
  steps: [
    { step: 'MIGRATION_PLANS', status: dryRun ? 'WOULD_DO' : 'DONE', items: [] },
    {
      step: 'DEMO_APP_DATA',
      status: 'MANUAL_REQUIRED',
      items: [
        {
          targetType: 'APP',
          targetId: null,
          label: 'demo.seq_write',
          action: null,
          status: 'MANUAL_REQUIRED',
          code: null,
          detail: 'no reset endpoint',
        },
      ],
    },
  ],
  manualRequired: ['DEMO_APP_DATA'],
});

const renderButton = () =>
  renderRoute(<DemoRestoreButton orgId="o1" />, { path: '/o/:slug', url: '/o/echo-demo' });

describe('DemoRestoreButton', () => {
  it('미리 보기를 먼저 보내고, 되돌리기는 그 뒤에만 보낸다. 수동 필요 단계를 밝힌다', async () => {
    serveMe('ADMIN');
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/v1/orgs/o1/demo/restore', async ({ request }) => {
        const body = (await request.json()) as { dryRun: boolean };
        bodies.push(body);
        return HttpResponse.json({ success: true, data: result(body.dryRun) });
      }),
    );
    renderButton();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restore demo state' })).not.toHaveAttribute(
        'aria-disabled',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Restore demo state' }));
    const restore = screen.getByRole('button', { name: 'Restore' });
    expect(restore).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Preview only. Nothing was changed.')).toBeInTheDocument();
    expect(screen.getByText('Would change')).toBeInTheDocument();
    expect(screen.getByText('Manual step needed: DEMO_APP_DATA')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restored to the snapshot.')).toBeInTheDocument();
    expect(bodies).toEqual([{ dryRun: true }, { dryRun: false }]);
  });

  it('어드민이 아니면 버튼을 비활성으로 보인다', async () => {
    serveMe('DEVELOPER');
    renderButton();

    await userEvent.hover(await screen.findByRole('button', { name: 'Restore demo state' }));
    expect((await screen.findAllByText('Requires Admin')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Restore demo state' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
