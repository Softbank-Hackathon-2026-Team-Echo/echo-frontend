import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { CloudCostPanel } from './CloudCostPanel';

const component = {
  name: 'EKS control plane',
  kind: 'COMPUTE',
  quantity: 1,
  unit: 'cluster',
  unitPriceUsd: 0.1,
  priceUnit: 'hour',
  hourlyUsd: 0.1,
  priceVerified: false,
  priceSource: 'aws pricing page',
  priceCheckedAt: '2026-11-05T00:00:00Z',
  note: null,
};

describe('CloudCostPanel', () => {
  it('추정과 청구를 나눠 보이고 온프레는 서버 문구를 쓴다', async () => {
    server.use(
      http.get('http://api.test/api/v1/orgs/o1/costs', () =>
        HttpResponse.json({
          success: true,
          data: {
            totalHourlyUsd: 0.9985,
            totalDailyUsd: 23.96,
            environments: [
              {
                environmentId: 'e1',
                environmentName: 'aws-tokyo',
                hourlyUsd: 0.4896,
                components: [component],
              },
            ],
            shared: [],
            excluded: [{ environmentId: 'e3', environmentName: 'onprem', note: 'no bill' }],
            billing: [
              {
                provider: 'aws',
                available: true,
                label: 'AWS account',
                note: null,
                days: [{ date: '2026-11-04', usageUsd: 12.5 }],
              },
              { provider: 'gcp', available: false, label: 'GCP', note: 'not exported', days: [] },
            ],
          },
        }),
      ),
    );
    renderRoute(<CloudCostPanel orgId="o1" />, { path: '/', url: '/' });

    expect(await screen.findByText('$0.9985/h')).toBeInTheDocument();
    expect(screen.getByText('Live estimate')).toBeInTheDocument();
    expect(screen.getByText('AWS account · billed on 2026-11-04: $12.50')).toBeInTheDocument();
    expect(screen.getByText('not exported')).toBeInTheDocument();
    expect(screen.getByText('no bill')).toBeInTheDocument();
    expect(screen.getByText('Some prices unverified')).toBeInTheDocument();

    // 단가표: 수량 × 단가 = 시간당, 월 추정은 730시간
    await userEvent.click(screen.getByRole('button', { name: 'Unit prices' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Estimated \$729\/month/)).toBeInTheDocument();
    expect(within(dialog).getByText('EKS control plane')).toBeInTheDocument();
    expect(within(dialog).getByText('$0.1000/hour')).toBeInTheDocument();
    expect(within(dialog).getByText('Price not verified')).toBeInTheDocument();
  });
});
