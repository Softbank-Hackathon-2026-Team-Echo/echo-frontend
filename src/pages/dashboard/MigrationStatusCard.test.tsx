import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { migrationPlan } from '@/test/migration-fixtures';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { MigrationStatusCard } from './MigrationStatusCard';
import { StatusPill } from './StatusPill';

const API = 'http://api.test/api/v1';
const names = new Map([
  ['e1', 'aws-tokyo-prod'],
  ['e2', 'gcp-seoul-standby'],
]);

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
