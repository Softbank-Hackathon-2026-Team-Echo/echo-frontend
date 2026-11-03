import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { browserNavigation } from '@/lib/api/client';
import { server } from '@/test/msw-server';
import RootRedirect from './RootRedirect';

const ME_URL = 'http://api.test/api/v1/me';

function renderRoot() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/', element: <RootRedirect /> },
      { path: '/o/:slug', element: <p>Org home</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return router;
}

describe('RootRedirect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로그인 전(/me 401)이면 로그인 화면으로 보내지 않고 소개 화면을 보여 준다', async () => {
    const assign = vi.spyOn(browserNavigation, 'assign').mockImplementation(() => {});
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ success: false, code: 'UNAUTHENTICATED' }, { status: 401 }),
      ),
    );
    renderRoot();

    expect(
      await screen.findByRole('heading', { level: 1, name: /beyond lock-in/i }),
    ).toBeInTheDocument();
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(header.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      'http://api.test/api/v1/auth/github/login?next=%2F',
    );
    expect(screen.getByText(/demo targets/i)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('로그인했으면 개인 조직으로 보낸다', async () => {
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({
          success: true,
          data: {
            user: { id: 'u1', githubLogin: 'echo', name: null, avatarUrl: null },
            organizations: [
              { id: 'o2', slug: 'team-echo', name: 'Team Echo', personal: false, role: 'ADMIN' },
              { id: 'o1', slug: 'echo', name: 'echo', personal: true, role: 'ADMIN' },
            ],
          },
        }),
      ),
    );
    const router = renderRoot();

    expect(await screen.findByText('Org home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/o/echo');
  });
});
