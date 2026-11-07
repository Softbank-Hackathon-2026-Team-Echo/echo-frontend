import { QueryClient } from '@tanstack/react-query';
import { act, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/api/query-keys';
import { canaryPlan, migrationPlan, step } from '@/test/migration-fixtures';
import { mockReducedMotion } from '@/test/motion';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { MigrationStatusCard } from './MigrationStatusCard';
import { StatusPill } from './StatusPill';

const API = 'http://api.test/api/v1';
const names = new Map([
  ['e1', 'aws-tokyo-prod'],
  ['e2', 'gcp-seoul-standby'],
]);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MigrationStatusCard', () => {
  it('지금 적용된 A·B 비율과 단계를 보인다', async () => {
    server.use(
      http.get(`${API}/orgs/o1/migration-plans/:id`, () =>
        HttpResponse.json({ success: true, data: migrationPlan() }),
      ),
    );
    renderRoute(
      <MigrationStatusCard orgId="o1" orgSlug="echo-demo" planId="plan-1234abcd" names={names} />,
    );

    expect(
      await screen.findByRole('img', { name: 'aws-tokyo-prod 50%, gcp-seoul-standby 50%' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 3 \/ 5 · traffic shift → 50%/)).toBeInTheDocument();
  });
  it('새 계획 갱신 시 막대는 700ms 전환하고 숫자는 중간값을 거치며 줄이기 설정은 즉시 반영한다', () => {
    vi.useFakeTimers();
    const setReduced = mockReducedMotion();
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    const key = queryKeys.migrationPlan('o1', 'plan-1234abcd');
    const atWeight = (weight: number) =>
      canaryPlan({
        status: 'PENDING_APPROVAL',
        steps: [step(1, 'SHIFT', weight, 'RUNNING')],
      });
    client.setQueryData(key, atWeight(0));
    renderRoute(
      <MigrationStatusCard orgId="o1" orgSlug="echo-demo" planId="plan-1234abcd" names={names} />,
      { queryClient: client },
    );
    const bar = screen.getByRole('img');
    const segments = [...bar.children];
    act(() => {
      client.setQueryData(key, atWeight(50));
      vi.advanceTimersByTime(1);
    });
    expect(segments[1]).toHaveStyle({ width: '50%' });
    for (const segment of segments) {
      expect(segment).toHaveClass(
        'transition-[width]',
        'duration-700',
        'ease-out',
        'motion-reduce:transition-none',
      );
    }
    act(() => vi.advanceTimersByTime(350));
    const panel = bar.closest('section');
    if (!panel) throw new Error('Migration 카드 없음');
    expect(within(panel).queryByText('0%')).not.toBeInTheDocument();
    expect(within(panel).queryByText('50%')).not.toBeInTheDocument();
    act(() => setReduced(true));
    expect(within(panel).getAllByText('50%')).toHaveLength(2);
    act(() => {
      client.setQueryData(key, atWeight(100));
      vi.advanceTimersByTime(1);
    });
    expect(within(panel).getByText('100%')).toBeInTheDocument();
    expect([...bar.children]).toEqual(segments);
    expect(segments[0]).toHaveStyle({ width: '0%' });
  });
});

describe('StatusPill', () => {
  it('이전 중이면 재난보다 이전 비율을 먼저 보인다', () => {
    renderRoute(
      <StatusPill
        migrating={{ name: 'gcp-seoul-standby', weight: 70 }}
        disaster={undefined}
        names={names}
      />,
    );
    expect(screen.getByText('Evacuating to gcp-seoul-standby · 70%')).toBeInTheDocument();
  });
});
