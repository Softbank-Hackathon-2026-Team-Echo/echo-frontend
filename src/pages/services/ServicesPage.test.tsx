import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/lib/api/types';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import ServicesPage from './ServicesPage';

const API = 'http://api.test/api/v1/orgs/o1';
const AT = '2026-11-08T00:00:00Z';
const URL = 'https://shop-demo.echoport.app';
const ok = <T,>(data: T) => HttpResponse.json({ success: true, data });
const page = <T,>(items: T[]) => ({ items, total: items.length, page: 0, size: 100 });

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

const service = {
  id: 's1',
  name: 'shop',
  description: null,
  repoUrl: 'https://github.com/echo/shop',
  private: false,
  healthCheckPath: '/health',
  healthCheckTimeoutSeconds: 30,
  containerPort: 8080,
  url: URL,
  status: 'ACTIVE',
  createdAt: AT,
};

describe('ServicesPage', () => {
  it('공개 URL 칸은 주소 글자 없이 새 탭으로 여는 「Open site」 버튼만 보인다', async () => {
    server.use(
      http.get('http://api.test/api/v1/me', () => ok(me)),
      http.get(`${API}/services`, () => ok(page([service]))),
      http.get(`${API}/services/s1`, () => ok({ ...service, environments: [] })),
      http.get(`${API}/services/s1/deploy-requests`, () => ok(page([]))),
    );
    renderRoute(<ServicesPage />, { path: '/o/:slug/services', url: '/o/echo-demo/services' });

    const link = await screen.findByRole('link', { name: 'Open shop in a new tab' });
    expect(link).toHaveAttribute('href', URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('Open site');
    expect(link).not.toHaveAttribute('title');
    // 화면 글자·title·aria 어디에도 주소가 없다(href 만 가진다)
    const table = screen.getByRole('table');
    expect(table.textContent).not.toContain('shop-demo.echoport.app');
    expect(table.innerHTML.replace(`href="${URL}"`, '')).not.toContain('shop-demo.echoport.app');
  });
});
