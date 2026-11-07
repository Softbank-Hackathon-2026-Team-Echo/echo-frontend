import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import RemoteShakeRedirect from './RemoteShakeRedirect';

const organization = (slug: string, personal: boolean) => ({
  id: slug,
  slug,
  name: slug,
  personal,
  role: 'DEVELOPER',
});

function Target() {
  const { slug } = useParams();
  return <p>shake {slug}</p>;
}

function renderRedirect(organizations: ReturnType<typeof organization>[]) {
  server.use(
    http.get('http://api.test/api/v1/me', () =>
      HttpResponse.json({
        success: true,
        data: {
          user: { id: 'u1', githubLogin: 'echoport', name: null, avatarUrl: null },
          organizations,
        },
      }),
    ),
  );
  const router = createMemoryRouter(
    [
      { path: '/remote', element: <RemoteShakeRedirect /> },
      { path: '/o/:slug/remote/shake', element: <Target /> },
    ],
    { initialEntries: ['/remote'] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('RemoteShakeRedirect', () => {
  it('개인 조직이 있어도 시연 조직으로 보낸다', async () => {
    renderRedirect([organization('me', true), organization('echo-demo', false)]);

    expect(await screen.findByText('shake echo-demo')).toBeInTheDocument();
  });

  it('시연 조직이 없으면 기본 조직으로 보낸다', async () => {
    renderRedirect([organization('team', false), organization('me', true)]);

    expect(await screen.findByText('shake me')).toBeInTheDocument();
  });
});
