import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canaryPlan, migrationPlan, step } from '@/test/migration-fixtures';
import { mockReducedMotion } from '@/test/motion';
import { LiveTab } from './LiveTab';

beforeEach(() => {
  vi.useFakeTimers();
  mockReducedMotion();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const props = { sourceName: 'AWS', targetName: 'GCP', now: Date.parse('2026-11-05T03:01:00Z') };
const planAt = (weight: number) => canaryPlan({ steps: [step(1, 'SHIFT', weight, 'RUNNING')] });

function bars() {
  const section = screen.getByText('Traffic weight').closest('section');
  if (!section) throw new Error('Traffic weight 영역 없음');
  return [...section.querySelectorAll<HTMLElement>('span[style]')];
}

describe('LiveTab', () => {
  it('비율 막대 2개를 유지하고 700ms 전환과 숫자 중간값을 보인다', () => {
    const { rerender } = render(<LiveTab {...props} plan={planAt(0)} />);
    const initial = bars();
    expect(initial).toHaveLength(2);
    expect(initial[1]).toHaveStyle({ flexGrow: 0 });
    rerender(<LiveTab {...props} plan={planAt(50)} />);
    expect(bars()).toEqual(initial);
    for (const bar of bars()) {
      expect(bar).toHaveClass(
        'transition-[flex-grow]',
        'duration-700',
        'ease-out',
        'motion-reduce:transition-none',
      );
      expect(bar).toHaveStyle({ flexGrow: 50 });
    }
    act(() => vi.advanceTimersByTime(350));
    const section = screen.getByText('Traffic weight').closest('section');
    expect(section).not.toHaveTextContent('GCP 0%');
    expect(section).not.toHaveTextContent('GCP 50%');
    act(() => vi.advanceTimersByTime(370));
    expect(
      within(screen.getByText('Traffic weight').closest('section') as HTMLElement).getAllByText(
        '50%',
      ),
    ).toHaveLength(2);
    rerender(<LiveTab {...props} plan={planAt(100)} />);
    expect(bars()[0]).toBe(initial[0]);
    expect(bars()[0]).toHaveStyle({ flexGrow: 0 });
    rerender(<LiveTab {...props} plan={canaryPlan({ status: 'ROLLED_BACK' })} />);
    expect(bars()[1]).toBe(initial[1]);
    expect(bars()[1]).toHaveStyle({ flexGrow: 0 });
  });

  it('움직임 줄이기면 비율 숫자를 즉시 바꾼다', () => {
    mockReducedMotion(true);
    const { rerender } = render(<LiveTab {...props} plan={planAt(5)} />);
    rerender(<LiveTab {...props} plan={planAt(75)} />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('옛 5단계 계획의 현재 50%와 다음 100% 단계를 그대로 보인다', () => {
    render(<LiveTab {...props} plan={migrationPlan()} />);
    expect(
      within(screen.getByText('Traffic weight').closest('section') as HTMLElement).getAllByText(
        '50%',
      ),
    ).toHaveLength(2);
    expect(screen.getByText(/Next step to 0 \/ 100 once GCP/)).toBeInTheDocument();
    expect(bars()).toHaveLength(2);
  });
});
