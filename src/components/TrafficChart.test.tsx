import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { weightTimeline } from '@/lib/migration-metrics';
import { migrationPlan } from '@/test/migration-fixtures';
import { TrafficChart } from './TrafficChart';

describe('TrafficChart', () => {
  it('서버 단계 시작 시각까지 직전 비율을 유지하는 계단선을 그린다', () => {
    render(
      <TrafficChart
        points={weightTimeline(migrationPlan(), Date.parse('2026-11-05T03:00:12Z'))}
        sourceName="AWS"
        targetName="GCP"
      />,
    );
    const chart = screen.getByRole('img', { name: 'Traffic share moving from AWS to GCP' });
    const lines = [...chart.querySelectorAll('path.fill-none')];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const path = line.getAttribute('d') ?? '';
      expect(path).toMatch(/^M[\d.]+,[\d.]+ H[\d.]+ V[\d.]+/);
      expect(path).not.toMatch(/[CLQS]/);
    }
    expect(chart.querySelectorAll('circle')).toHaveLength(5);
  });
});
