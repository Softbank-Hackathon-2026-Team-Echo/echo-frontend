import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import EvacuationPage from './EvacuationPage';

const API = 'http://api.test/api/v1';
const AT = '2026-11-08T02:30:00Z';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });

const me: Me = {
  user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
  organizations: [
    {
      id: 'o1',
      slug: 'echo-demo',
      name: 'Echo Demo',
      personal: false,
      role: 'ADMIN',
      allowSelfApproval: true,
      createdAt: AT,
    },
  ],
};

const disaster = {
  id: 'd1',
  type: 'EARTHQUAKE',
  source: 'SIMULATED',
  simulated: true,
  magnitude: 6.8,
  epicenter: { lat: 35.2, lng: 139.4 },
  radiusKm: 210,
  meetsThreshold: false,
  status: 'ACTIVE',
  affectedEnvironmentIds: ['e1'],
  safeEnvironmentIds: [],
  unknownEnvironmentIds: [],
  createdBy: { id: 'u1', login: 'echoport' },
  endedBy: null,
  startedAt: AT,
  endedAt: null,
  plans: [],
};

describe('EvacuationPage', () => {
  // 「대피 방안 보기」 첫 진입 가설 확인: 서비스 상세가 아직 오는 중이어도 화면이 터지지 않는다.
  // useServiceDetails 는 combine 으로 data 를 늘 배열로 돌려준다(오는 중이면 빈 배열)
  it('재난 중 서비스 상세가 아직 오는 중이면 오류 없이 확인 중으로 보인다', async () => {
    server.use(
      http.get(`${API}/me`, () => ok(me)),
      http.get(`${API}/orgs/o1/environments`, () =>
        ok({ items: [], total: 0, page: 0, size: 100 }),
      ),
      http.get(`${API}/orgs/o1/costs`, () => new Promise<never>(() => {})),
      http.get(`${API}/orgs/o1/services`, () =>
        ok({ items: [{ id: 's1', name: 'demo-ai' }], total: 1, page: 0, size: 100 }),
      ),
      http.get(`${API}/orgs/o1/services/s1`, () => new Promise<never>(() => {})),
      http.get(`${API}/orgs/o1/disasters/feed`, () => new Promise<never>(() => {})),
      http.get(`${API}/orgs/o1/disasters`, () =>
        ok({ items: [disaster], total: 1, page: 0, size: 50 }),
      ),
    );
    renderRoute(<EvacuationPage />, {
      path: '/o/:slug/evacuation',
      url: '/o/echo-demo/evacuation',
    });

    expect(await screen.findByText('Checking services…')).toBeInTheDocument();
  });
});
