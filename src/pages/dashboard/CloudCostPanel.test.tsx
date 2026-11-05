import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { CloudCostPanel } from './CloudCostPanel';

const component = { priceVerified: false };

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
  });
});
