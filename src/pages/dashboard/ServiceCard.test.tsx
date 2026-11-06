import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DeployRequestSummary, ServiceDetail } from '@/lib/api/types';
import { ServiceCard } from './ServiceCard';

const service = {
  id: 's1',
  name: 'shop-api',
  environments: [
    {
      role: 'SERVING',
      trafficWeight: 100,
      environment: { id: 'e1', name: 'aws-tokyo', kind: 'aws' },
    },
  ],
} as unknown as ServiceDetail;

function renderCard(extra: Partial<Parameters<typeof ServiceCard>[0]> = {}) {
  render(
    <MemoryRouter>
      <ServiceCard
        orgSlug="echo-demo"
        service={service}
        latest={{ status: 'FAILED' } as DeployRequestSummary}
        changes={0}
        migrating={false}
        atRisk={false}
        {...extra}
      />
    </MemoryRouter>,
  );
}

describe('ServiceCard', () => {
  it('서비스 Overview 로 가고 서비스 중 환경 · 비율 · 최근 배포를 보인다', () => {
    renderCard();

    expect(screen.getByRole('link')).toHaveAttribute('href', '/o/echo-demo/services/s1');
    expect(screen.getByText('aws-tokyo')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('적용 전 변경 · 이전 중 · 위험을 함께 보인다', () => {
    renderCard({ changes: 2, migrating: true, atRisk: true });

    expect(screen.getByText('2 changes to apply')).toBeInTheDocument();
    expect(screen.getByText('Migrating')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();
  });
});
