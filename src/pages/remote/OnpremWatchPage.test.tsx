import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { renderRoute } from '@/test/render';
import OnpremWatchPage from './OnpremWatchPage';

type Probe = { ok: boolean; status: number | null; ms: number; body: object | null; error: null };

function serve(guest: () => Probe, watcher: () => Probe) {
  const hosts: string[] = [];
  server.use(
    http.get('*/onprem-probe', ({ request }) => {
      const url = new URL(request.url);
      hosts.push(`${url.searchParams.get('host')}${url.searchParams.get('path')}`);
      return HttpResponse.json(url.searchParams.get('path') === '/state' ? watcher() : guest());
    }),
  );
  return hosts;
}

const renderPage = (url = '/o/echo-demo/remote/onprem') =>
  renderRoute(<OnpremWatchPage />, { path: '/o/:slug/remote/onprem', url });

describe('OnpremWatchPage', () => {
  it('손님 주소 응답 환경을 크게 보이고 띠에 칠한다', async () => {
    const hosts = serve(
      () => ({ ok: true, status: 200, ms: 40, body: { environment: 'onprem' }, error: null }),
      () => ({
        ok: true,
        status: 200,
        ms: 50,
        body: { state: 'NORMAL', epoch: 0, armed: true },
        error: null,
      }),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('watch-environment')).toHaveTextContent('On-prem'),
    );
    expect(screen.getByTestId('watch-strip').querySelectorAll('[data-kind="onprem"]')).toHaveLength(
      1,
    );
    expect(await screen.findByText('NORMAL')).toBeInTheDocument();
    expect(screen.getByText(/armed/)).toBeInTheDocument();
    expect(hosts).toContain('demo-laptop-nwjs7inr.echoport.uk/api/info');
    expect(hosts).toContain('watch-laptopdr-nwjs7inr.echoport.uk/state');
  });

  it('실패하면 실패 수를 세고 이유를 보인다. 감시자에 닿지 않으면 그렇게 적는다', async () => {
    serve(
      () => ({ ok: false, status: 530, ms: 30, body: null, error: null }),
      () => ({ ok: false, status: 530, ms: 30, body: null, error: null }),
    );
    renderPage('/o/echo-demo/remote/onprem?guest=demo-laptop-abc.echoport.uk');

    expect(await screen.findByText(/The last request failed \(HTTP 530\)/)).toBeInTheDocument();
    expect(screen.getByTestId('watch-strip').querySelectorAll('[data-kind="fail"]')).toHaveLength(
      1,
    );
    expect(await screen.findByText('Watcher not reachable (HTTP 530).')).toBeInTheDocument();
  });
});
