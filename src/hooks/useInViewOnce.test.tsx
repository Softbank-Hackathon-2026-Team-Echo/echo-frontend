import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInViewOnce } from './useInViewOnce';

let notify: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;

class FakeObserver {
  constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    notify = callback;
  }
  observe() {}
  disconnect() {}
}

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref);
  return <div ref={ref}>{seen ? 'seen' : 'waiting'}</div>;
}

afterEach(() => vi.unstubAllGlobals());

describe('useInViewOnce', () => {
  it('화면에 들어오기 전에는 false, 들어온 뒤에는 나가도 true 로 남는다', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(<Probe />);
    expect(screen.getByText('waiting')).toBeInTheDocument();

    act(() => notify?.([{ isIntersecting: true }]));
    expect(screen.getByText('seen')).toBeInTheDocument();

    act(() => notify?.([{ isIntersecting: false }]));
    expect(screen.getByText('seen')).toBeInTheDocument();
  });

  it('IntersectionObserver 가 없으면 처음부터 보인다고 본다', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe />);
    expect(screen.getByText('seen')).toBeInTheDocument();
  });
});
