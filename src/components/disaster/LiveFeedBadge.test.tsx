import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { LiveFeedBadge } from './LiveFeedBadge';

const API = 'http://api.test/api/v1';

function serve(connectionStatus: string, lastErrorCode: string | null = null) {
  server.use(
    http.get(`${API}/orgs/o1/disasters/feed`, () =>
      HttpResponse.json({
        success: true,
        data: {
          provider: 'USGS',
          connectionStatus,
          lastPolledAt: null,
          lastErrorCode,
          threshold: { minMagnitude: 6, radiusKm: 300 },
        },
      }),
    ),
  );
}

describe('LiveFeedBadge', () => {
  it.each([
    ['CONNECTED', 'Connected'],
    ['WAITING', 'Waiting'],
    ['DISABLED', 'Off'],
    ['ERROR', 'Error'],
  ])('%s 이면 %s 로 보이고 기준을 적는다', async (status, label) => {
    serve(status, status === 'ERROR' ? 'FEED_UNREACHABLE' : null);
    renderRoute(<LiveFeedBadge orgId="o1" />);

    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText('M6.0+ · 300 km')).toBeInTheDocument();
  });

  it('모르는 상태는 원래 값을 보인다', async () => {
    serve('PAUSED');
    renderRoute(<LiveFeedBadge orgId="o1" />);

    expect(await screen.findByText('PAUSED')).toBeInTheDocument();
  });
});
