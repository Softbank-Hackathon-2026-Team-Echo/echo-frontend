import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DemoRestoreResult, failedSteps, restoreUntilDone } from '@/lib/api/demo';
import type { Me, MemberRole } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { DemoSnapshotCard } from './DemoSnapshotCard';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return { ...actual, toast: Object.assign(actual.toast, { error: toastError }) };
});

const API = 'http://api.test/api/v1/orgs/o1';
const AT = '2026-11-08T01:02:03Z';
const ok = <T,>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });

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
        allowSelfApproval: true,
        createdAt: AT,
      },
    ],
  };
}

const snapshot = {
  id: 'abcdef12-3456-7890-abcd-ef1234567890',
  takenAt: AT,
  takenByUserId: 'u1',
  services: [],
};

function result(overrides: Partial<DemoRestoreResult> = {}): DemoRestoreResult {
  return {
    snapshotId: snapshot.id,
    snapshotTakenAt: AT,
    dryRun: false,
    restored: false,
    callAgain: true,
    steps: [
      { step: 'MIGRATION_PLANS', status: 'OK', items: [] },
      { step: 'TRAFFIC', status: 'STARTED', items: [] },
      { step: 'DEMO_APP_DATA', status: 'MANUAL_REQUIRED', items: [] },
    ],
    manualRequired: ['DEMO_APP_DATA'],
    ...overrides,
  };
}

function serve(role: MemberRole, { snapshotFound = true } = {}) {
  server.use(
    http.get('http://api.test/api/v1/me', () => ok(me(role))),
    http.get(`${API}/members`, () =>
      ok({
        items: [
          {
            id: 'u1',
            githubLogin: 'jimin',
            name: null,
            avatarUrl: null,
            role: 'ADMIN',
            joinedAt: AT,
          },
        ],
        total: 1,
        page: 0,
        size: 100,
      }),
    ),
    http.get(`${API}/demo/snapshot`, () =>
      snapshotFound
        ? ok(snapshot)
        : HttpResponse.json(
            { success: false, code: 'DEMO_SNAPSHOT_NOT_FOUND', message: 'no snapshot' },
            { status: 404 },
          ),
    ),
  );
}

function renderCard() {
  return renderRoute(<DemoSnapshotCard orgId="o1" pollIntervalMs={5} />, {
    path: '/o/:slug',
    url: '/o/echo-demo',
  });
}

/** 스냅샷을 읽어 버튼이 열릴 때까지 기다린다(RoleButton 은 비활성 ↔ 활성에서 다른 요소를 그린다) */
async function readyButton() {
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).not.toHaveAttribute(
      'aria-disabled',
    ),
  );
  return screen.getByRole('button', { name: /Restore to snapshot/ });
}

describe('DemoSnapshotCard', () => {
  beforeEach(() => toastError.mockClear());

  it('스냅샷 id 앞 8자·찍은 시각(KST)·찍은 사람을 보인다', async () => {
    serve('ADMIN');
    renderCard();
    const summary = await screen.findByTestId('demo-snapshot-summary');
    await waitFor(() => expect(summary).toHaveTextContent('abcdef12'));
    expect(summary).toHaveTextContent('KST');
    await waitFor(() => expect(summary).toHaveTextContent('jimin'));
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('스냅샷이 없으면(404) 「No snapshot」 비활성', async () => {
    serve('ADMIN', { snapshotFound: false });
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('demo-snapshot-summary')).toHaveTextContent('No snapshot'),
    );
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('ADMIN 이 아니면 비활성이고 스냅샷을 부르지 않는다', async () => {
    const calls: string[] = [];
    serve('DEVELOPER');
    server.use(
      http.get(`${API}/demo/snapshot`, () => {
        calls.push('snapshot');
        return ok(snapshot);
      }),
    );
    renderCard();
    await waitFor(() =>
      expect(screen.getByTestId('demo-snapshot-summary')).toHaveTextContent(
        'Only admins can see and restore the demo snapshot.',
      ),
    );
    const button = screen.getByRole('button', { name: /Restore to snapshot/ });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('확인 → restore 를 callAgain 이 꺼질 때까지 다시 부르고 완료·수동 항목을 보인다', async () => {
    serve('ADMIN');
    const bodies: unknown[] = [];
    let calls = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/demo/restore`, async ({ request }) => {
        bodies.push(await request.json());
        calls += 1;
        if (calls === 1) return ok(result());
        if (calls === 2) {
          await gate;
          return ok(result({ steps: [{ step: 'TRAFFIC', status: 'WAITING', items: [] }] }));
        }
        return ok(
          result({
            restored: true,
            callAgain: false,
            steps: [
              { step: 'MIGRATION_PLANS', status: 'OK', items: [] },
              { step: 'TRAFFIC', status: 'DONE', items: [] },
              { step: 'DEMO_APP_DATA', status: 'MANUAL_REQUIRED', items: [] },
            ],
          }),
        );
      }),
    );
    renderCard();
    await userEvent.click(await readyButton());
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('App data is not restored.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));

    // 두 번째 호출이 걸려 있는 동안: 버튼 비활성 + 진행 줄 + 첫 응답 단계
    await waitFor(() => expect(screen.getByText(/call 1, repeats/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.getByRole('list', { name: 'Restore steps' })).toHaveTextContent(
      'Started — worker finishing',
    );
    release();

    await waitFor(() => expect(screen.getByText(/Restore complete \(/)).toBeInTheDocument());
    expect(calls).toBe(3);
    expect(bodies).toEqual([{ dryRun: false }, { dryRun: false }, { dryRun: false }]);
    expect(screen.getByRole('list', { name: 'Restore steps' })).toHaveTextContent(
      'Restored in this call',
    );
    expect(screen.getByRole('list', { name: 'Manual' })).toHaveTextContent('App data is manual');
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).not.toBeDisabled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('FAILED 단계는 step·code 를 보인다', async () => {
    serve('ADMIN');
    server.use(
      http.post(`${API}/demo/restore`, () =>
        ok(
          result({
            callAgain: false,
            steps: [
              {
                step: 'DEPLOYMENTS',
                status: 'FAILED',
                items: [{ status: 'FAILED', code: 'SECURITY_GATE_BLOCKED' }],
              },
            ],
            manualRequired: [],
          }),
        ),
      ),
    );
    renderCard();
    await userEvent.click(await readyButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }),
    );
    const failed = await screen.findByRole('list', { name: 'Failed steps' });
    expect(failed).toHaveTextContent('Deployments · SECURITY_GATE_BLOCKED');
  });

  it('4xx 는 코드·메시지·요청 id 토스트를 띄우고 버튼을 다시 연다', async () => {
    serve('ADMIN');
    server.use(
      http.post(`${API}/demo/restore`, () =>
        HttpResponse.json(
          { success: false, code: 'FORBIDDEN', message: 'admin human session required' },
          { status: 403, headers: { 'X-Request-ID': 'req-42' } },
        ),
      ),
    );
    renderCard();
    await userEvent.click(await readyButton());
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const description = toastError.mock.calls[0]?.[1]?.description as string;
    expect(description).toContain('FORBIDDEN · admin human session required');
    expect(description).toContain('req-42');
    expect(screen.getByRole('button', { name: /Restore to snapshot/ })).not.toBeDisabled();
  });
});

describe('restoreUntilDone', () => {
  it('callAgain 이 꺼지면 멈추고, 5분을 넘기면 timedOut', async () => {
    let clock = 0;
    const sleep = async (ms: number) => {
      clock += ms;
    };
    const always = vi.fn(async () => result());
    const run = await restoreUntilDone(always, {
      intervalMs: 2_000,
      timeoutMs: 10_000,
      now: () => clock,
      sleep,
    });
    expect(run.timedOut).toBe(true);
    expect(always).toHaveBeenCalledTimes(6);

    const once = vi.fn(async () => result({ restored: true, callAgain: false }));
    const done = await restoreUntilDone(once, { now: () => clock, sleep });
    expect(done).toMatchObject({ calls: 1, timedOut: false });
  });

  it('failedSteps 는 FAILED 단계의 코드를 모은다', () => {
    expect(
      failedSteps(
        result({
          steps: [
            { step: 'OK_STEP', status: 'OK', items: [] },
            { step: 'TRAFFIC', status: 'FAILED', items: [{ status: 'FAILED', code: 'X' }] },
          ],
        }),
      ),
    ).toEqual([{ step: 'TRAFFIC', codes: ['X'] }]);
  });
});
