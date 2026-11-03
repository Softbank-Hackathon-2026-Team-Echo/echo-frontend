import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { migrationPlan } from '@/test/migration-fixtures';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { CompletionCard, recentCompletion } from './CompletionCard';

const FINISHED = '2026-11-05T03:00:25Z';
const done = migrationPlan({ status: 'SUCCEEDED', finishedAt: FINISHED });

afterEach(() => window.sessionStorage.clear());

describe('recentCompletion', () => {
  it('30분 안에 성공한 이전만 고르고, 한 번 닫은 것은 다시 고르지 않는다', () => {
    const now = Date.parse(FINISHED) + 60_000;
    expect(recentCompletion('o1', [done], now)?.id).toBe(done.id);
    expect(recentCompletion('o1', [done], Date.parse(FINISHED) + 31 * 60_000)).toBeUndefined();
    expect(recentCompletion('o1', [{ ...done, status: 'ROLLED_BACK' }], now)).toBeUndefined();

    window.sessionStorage.setItem('echoport.completion-seen.o1', JSON.stringify([done.id]));
    expect(recentCompletion('o1', [done], now)).toBeUndefined();
  });
});

describe('CompletionCard', () => {
  it('총 시간·실패 요청과 결과 화면 링크를 보여 주고, 닫으면 다시 뜨지 않게 기억한다', async () => {
    server.use(
      http.get('http://api.test/api/v1/orgs/o1/migration-plans/:id', () =>
        HttpResponse.json({ success: true, data: done }),
      ),
    );
    renderRoute(
      <CompletionCard
        orgId="o1"
        orgSlug="echo-demo"
        planId={done.id}
        sourceName="aws-tokyo-prod"
        targetName="gcp-seoul-standby"
      />,
    );

    expect(await screen.findByText('Evacuation complete')).toBeInTheDocument();
    expect(screen.getByText('25s')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view full result/i })).toHaveAttribute(
      'href',
      `/o/echo-demo/migrations/${done.id}`,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Stay on dashboard' }));
    expect(
      JSON.parse(window.sessionStorage.getItem('echoport.completion-seen.o1') ?? '[]'),
    ).toEqual([done.id]);
  });
});
