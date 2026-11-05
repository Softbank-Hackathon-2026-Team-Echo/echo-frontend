import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { AiResidencySummary } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { AiResidencyPanel } from './AiResidencyPanel';

const AT = '2026-11-05T00:00:00Z';

const summary = (
  verdict: AiResidencySummary['sensitiveExternalTransfer']['verdict'],
  runs: number,
): AiResidencySummary => ({
  from: AT,
  to: AT,
  policy: { source: 'DEFAULT', allowedModelRegions: [], forbidExternalForClasses: [] },
  runs: {
    total: 5,
    recorded: 2,
    unrecorded: 3,
    sandboxed: 2,
    externalTransfer: 1,
    truncated: false,
  },
  byProvider: [],
  byModel: [],
  byLocation: [],
  byModelRegion: [],
  byDataClass: [],
  externalTransferBytes: 0,
  sensitiveExternalTransfer: { classes: [], runs, verdict },
  violations: [],
  recentRuns: [],
});

function renderPanel(data: AiResidencySummary) {
  server.use(
    http.get('http://api.test/api/v1/orgs/o1/ai/residency', () =>
      HttpResponse.json({ success: true, data }),
    ),
  );
  renderRoute(<AiResidencyPanel orgId="o1" />, { path: '/', url: '/' });
}

describe('AiResidencyPanel', () => {
  it('기록 없는 실행이 있으면 0건이라고 단정하지 않는다', async () => {
    renderPanel(summary('ZERO_WITH_UNRECORDED', 0));

    expect(await screen.findByText('0 in recorded runs · 3 without a record')).toBeInTheDocument();
    expect(screen.queryByText('No sensitive data left the platform')).not.toBeInTheDocument();
  });

  it('감지되면 건수를 밝힌다', async () => {
    renderPanel(summary('DETECTED', 2));

    expect(await screen.findByText('2 sensitive transfers detected')).toBeInTheDocument();
  });
});
