import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RouteLoading } from './RouteLoading';

function Ready() {
  return <p>Ready</p>;
}

describe('RouteLoading', () => {
  it('지연 로드 화면의 코드를 받는 동안 빈 화면 대신 보인다', async () => {
    let finish: (value: { Component: () => React.ReactNode }) => void = () => {};
    const router = createMemoryRouter([
      {
        path: '/',
        HydrateFallback: RouteLoading,
        lazy: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument();

    finish({ Component: Ready });
    expect(await screen.findByText('Ready')).toBeInTheDocument();
  });
});
