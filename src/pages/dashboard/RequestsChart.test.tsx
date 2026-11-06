import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EnvironmentMetricsSeries } from '@/lib/api/types';
import { hasRequests, RequestsChart } from './RequestsChart';

const series = (name: string, rps: number[]): EnvironmentMetricsSeries => ({
  environmentId: name,
  environmentName: name,
  cloudProvider: 'aws',
  points: rps.map((value, index) => ({
    t: `2026-11-06T00:00:${String(index * 10).padStart(2, '0')}Z`,
    rps: value,
    successRate: null,
    p95Ms: null,
  })),
});

describe('hasRequests', () => {
  it('점이 없거나 전부 0 이면 그리지 않는다', () => {
    expect(hasRequests([])).toBe(false);
    expect(hasRequests([series('standby', [])])).toBe(false);
    expect(hasRequests([series('idle', [0, 0])])).toBe(false);
    expect(hasRequests([series('busy', [0, 20])])).toBe(true);
  });
});

describe('RequestsChart', () => {
  it('점이 있는 환경만 범례에 보인다', () => {
    render(<RequestsChart series={[series('aws-tokyo', [10, 20]), series('gcp-seoul', [])]} />);

    expect(screen.getByText('aws-tokyo')).toBeInTheDocument();
    expect(screen.queryByText('gcp-seoul')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Requests per second by environment, last 15 minutes' }),
    ).toBeInTheDocument();
  });
});
