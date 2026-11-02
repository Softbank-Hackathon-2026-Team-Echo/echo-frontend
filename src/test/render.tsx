import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';

/** 테스트마다 새 QueryClient(재시도 없음)와 메모리 라우터로 그린다 */
export function renderRoute(
  element: ReactElement,
  {
    path = '/',
    url = '/',
    queryClient,
  }: { path?: string; url?: string; queryClient?: QueryClient } = {},
) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path, element }], { initialEntries: [url] });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}
