import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ServiceMetricsStatus, ServiceMetricsSummary } from '@/lib/api/types';
import { KpiTiles } from './KpiTiles';

const empty: ServiceMetricsSummary = {
  successRate: null,
  p95Ms: null,
  replicationLagMs: null,
  errorBudgetLeft: null,
  sloTarget: 0.999,
};

function renderTiles(
  summary: ServiceMetricsSummary | undefined,
  status: ServiceMetricsStatus | undefined,
  simulated = false,
) {
  render(
    <TooltipProvider>
      <KpiTiles serving={undefined} summary={summary} status={status} simulated={simulated} />
    </TooltipProvider>,
  );
}

describe('KpiTiles', () => {
  it('서버 값을 그린다', () => {
    renderTiles(
      { ...empty, successRate: 0.9997, p95Ms: 182.4, replicationLagMs: 120, errorBudgetLeft: 0.72 },
      'OK',
    );

    expect(screen.getByText('99.97%')).toBeInTheDocument();
    expect(screen.getByText('182 ms')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(screen.getByText('SLO 99.9%')).toBeInTheDocument();
    expect(screen.queryByText('simulated')).not.toBeInTheDocument();
  });

  it('요청이 없으면 값을 지어내지 않는다', () => {
    renderTiles(empty, 'OK');

    expect(screen.getAllByText('No requests yet')).toHaveLength(3);
    expect(screen.getByText('No replication data')).toBeInTheDocument();
  });

  it.each([
    ['UNAVAILABLE', 'Metrics unavailable'],
    ['NOT_CONFIGURED', 'Metrics not configured'],
  ] as const)('%s 면 이유를 보이고 깨지지 않는다', (status, text) => {
    renderTiles(empty, status);

    expect(screen.getAllByText(text)).toHaveLength(4);
  });

  it('가짜 값이면 simulated 를 단다', () => {
    renderTiles({ ...empty, successRate: 0.99 }, 'OK', true);

    expect(screen.getByText('simulated')).toBeInTheDocument();
  });
});
