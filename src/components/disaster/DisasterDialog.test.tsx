import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import { DisasterDialog } from './DisasterDialog';

describe('DisasterDialog', () => {
  it('이전 기준(규모)과 출처(시뮬레이션 · 실제 피드 자리)를 보여 준다', async () => {
    server.use(
      http.get('http://api.test/api/v1/orgs/o1/environments', () =>
        HttpResponse.json({ success: true, data: { items: [], total: 0, page: 0, size: 100 } }),
      ),
    );
    renderRoute(<DisasterDialog open onOpenChange={() => {}} orgId="o1" />);

    expect(await screen.findByText('Magnitude 7.0 or above')).toBeInTheDocument();
    expect(screen.getByText('Manual (simulated)')).toBeInTheDocument();
    expect(screen.getByText(/Live feed \(P2P地震情報\) not connected yet/)).toBeInTheDocument();
  });
});
