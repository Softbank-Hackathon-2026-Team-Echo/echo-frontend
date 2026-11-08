import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorPage } from './RouteErrorPage';

const reloadPage = vi.hoisted(() => vi.fn());
vi.mock('@/lib/stale-chunk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stale-chunk')>()),
  reloadPage,
}));

afterEach(() => {
  reloadPage.mockClear();
  window.sessionStorage.clear();
});

function renderLazyFailure(error: Error) {
  const router = createMemoryRouter(
    [{ path: '/', errorElement: <RouteErrorPage />, lazy: () => Promise.reject(error) }],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
}

describe('RouteErrorPage', () => {
  // 운영 재현(11/8 11:3x): 11:19 배포 전에 연 탭이 「대피 방안 보기」를 누르면 옛 EvacuationPage 청크를 받는데,
  // 운영은 그 파일 대신 index.html(text/html)을 줘서 지연 로드가 실패하고 이 오류 화면이 떴다
  it('배포로 사라진 화면 코드를 받다 실패하면 오류 대신 새 버전 안내를 보이고 새로고침한다', async () => {
    renderLazyFailure(
      new TypeError(
        'Failed to fetch dynamically imported module: https://app.echoport.uk/assets/EvacuationPage-DNuAsCIp.js',
      ),
    );

    expect(await screen.findByText('A new version was deployed')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(reloadPage).toHaveBeenCalledOnce();
  });

  it('Safari 문구(Importing a module script failed)도 같은 안내로 본다', async () => {
    renderLazyFailure(new TypeError('Importing a module script failed.'));

    expect(await screen.findByText('A new version was deployed')).toBeInTheDocument();
  });

  it('다른 오류는 그대로 오류 화면을 보이고 새로고침하지 않는다', async () => {
    renderLazyFailure(new Error('boom'));

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
