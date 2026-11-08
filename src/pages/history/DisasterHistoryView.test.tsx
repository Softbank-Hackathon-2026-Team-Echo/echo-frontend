import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  blockedEvent,
  fixtureEvents,
  fullEvent,
  outsideEvent,
} from '@/test/disaster-history-fixture';
import { DisasterHistoryView } from './DisasterHistoryView';
import { EMPTY_HISTORY_FILTERS } from './HistoryEventList';
import { REPLAY_STEP_MS } from './useReplay';

type Props = ComponentProps<typeof DisasterHistoryView>;

function renderView(overrides: Partial<Props> = {}) {
  const props: Props = {
    scopeKey: 'org-a',
    list: { kind: 'ready', items: fixtureEvents, page: 0, hasNext: false },
    detail: { kind: 'ready', detail: fullEvent },
    selectedId: fullEvent.id,
    filters: EMPTY_HISTORY_FILTERS,
    operations: {
      liveIntakeStatus: null,
      isLiveIntakeStale: false,
      liveIntakeCheckedAt: null,
      autoMigrationEnabled: null,
    },
    onFiltersChange: vi.fn(),
    onSelect: vi.fn(),
    onPageChange: vi.fn(),
    ...overrides,
  };
  const view = (next: Props) => (
    <TooltipProvider>
      <DisasterHistoryView {...next} />
    </TooltipProvider>
  );
  const result = render(view(props));
  return {
    ...result,
    props,
    update: (next: Partial<Props>) => result.rerender(view({ ...props, ...next })),
  };
}

const currentStep = () => screen.getByRole('button', { current: 'step' });

afterEach(() => vi.useRealTimers());

describe('DisasterHistoryView', () => {
  it('서버 계약 전에는 빈 기록이 아니라 대기라고 보이고 사건을 만들지 않는다', () => {
    renderView({ list: { kind: 'contract-pending' }, detail: { kind: 'none' } });
    expect(screen.getByText('Past disaster records are not connected yet')).toBeInTheDocument();
    expect(screen.queryByText('No events match these filters')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('실제 사건과 가상 이전을 목록·상세·지도·타임라인에서 함께 구분한다', () => {
    renderView({ list: { kind: 'ready', items: [fullEvent], page: 0, hasNext: false } });
    expect(screen.getAllByText('Disaster source: real USGS record')).toHaveLength(4);
    expect(screen.getAllByText('Migration history: demo (virtual)')).toHaveLength(4);
    expect(screen.getByText('Past replay · read only')).toBeInTheDocument();
  });

  it('출처가 없으면 실제나 가상으로 넘겨짚지 않는다', () => {
    renderView({
      list: { kind: 'ready', items: [blockedEvent], page: 0, hasNext: false },
      detail: { kind: 'ready', detail: blockedEvent },
    });
    expect(screen.getAllByText("Migration history: can't confirm").length).toBeGreaterThan(0);
    expect(screen.queryByText('Migration history: real run')).not.toBeInTheDocument();
  });

  it('응답이 없으면 꺼짐으로 바꾸지 않고, 서버가 확인한 꺼짐만 꺼짐이다', () => {
    const { update, props } = renderView();
    expect(screen.getByText("Live intake: can't confirm")).toBeInTheDocument();
    expect(screen.getByText("Auto migration: can't confirm")).toBeInTheDocument();
    expect(screen.queryByText('Live intake off')).not.toBeInTheDocument();

    update({
      operations: {
        ...props.operations,
        liveIntakeStatus: 'DISABLED',
        autoMigrationEnabled: false,
      },
    });
    expect(screen.getByText('Live intake off')).toBeInTheDocument();
    expect(screen.getByText('Auto migration off')).toBeInTheDocument();

    update({
      operations: { ...props.operations, liveIntakeStatus: 'DISABLED', isLiveIntakeStale: true },
    });
    expect(screen.getByText("Live intake: can't confirm")).toBeInTheDocument();
  });

  it('반경이 있으면 출처·단위와 함께 그리고 피해 범위가 아니라고 밝힌다', () => {
    renderView();
    expect(screen.getByTestId('history-radius')).toBeInTheDocument();
    expect(screen.getByText(/Policy impact radius · 300 km/)).toBeInTheDocument();
    expect(screen.getByText(/Not the actual damage area/)).toBeInTheDocument();
    expect(screen.getByText('USGS ShakeMap: no data')).toBeInTheDocument();
  });

  it('반경이 없으면 원을 지어내지 않고 이유를 보인다', () => {
    renderView({ detail: { kind: 'ready', detail: blockedEvent } });
    expect(screen.queryByTestId('history-radius')).not.toBeInTheDocument();
    expect(screen.getByText(/No circle is drawn: fixture has no radius basis/)).toBeInTheDocument();
  });

  it('지도 범위 밖 사건과 좌표 없는 환경을 밝힌다', () => {
    renderView({ detail: { kind: 'ready', detail: outsideEvent } });
    expect(screen.getByText(/outside the map area/)).toBeInTheDocument();
    expect(screen.getByText('Not on the map: fixture-onprem')).toBeInTheDocument();
    expect(screen.getByText(/No migration history was recorded/)).toBeInTheDocument();
  });

  it('snapshot 이 없으면 그 시점 상태를 확인 불가로 둔다', () => {
    renderView({ detail: { kind: 'ready', detail: blockedEvent } });
    expect(
      screen.getByText("Can't confirm the services and environments at that time."),
    ).toBeInTheDocument();
  });

  it('실패 단계의 이유를 보이고 모르는 값은 원문으로 둔다', () => {
    renderView({ detail: { kind: 'ready', detail: blockedEvent } });
    expect(screen.getByText('Safety check failed')).toBeInTheDocument();
    expect(screen.getByText('fixture gate failed')).toBeInTheDocument();
    expect(screen.getByText('FIXTURE_NEW_KIND')).toBeInTheDocument();
    expect(screen.getByText('FIXTURE_NEW_STATUS')).toBeInTheDocument();
    expect(screen.getByText(/Time not recorded/)).toBeInTheDocument();
  });

  it('다음 단계와 탐색이 타임라인과 그 시점 가중치를 함께 바꾼다', async () => {
    const user = userEvent.setup();
    renderView();
    expect(within(currentStep()).getByText('Event occurred')).toBeInTheDocument();
    expect(screen.getByText('No traffic weight recorded yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Replay position' }), {
      target: { value: '5' },
    });
    expect(within(currentStep()).getByText('Traffic shift')).toBeInTheDocument();
    expect(screen.getByText('fixture-seoul · 50%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText('fixture-seoul · 100%')).toBeInTheDocument();
  });

  it('재생은 단계를 넘기고 끝에서 멈추며 일시정지하면 그 자리에 있다', () => {
    vi.useFakeTimers();
    renderView();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    act(() => {
      vi.advanceTimersByTime(REPLAY_STEP_MS);
    });
    expect(within(currentStep()).getByText('Policy decision')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    act(() => {
      vi.advanceTimersByTime(REPLAY_STEP_MS * 3);
    });
    expect(within(currentStep()).getByText('Policy decision')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    for (let step = 0; step < 8; step += 1) {
      act(() => {
        vi.advanceTimersByTime(REPLAY_STEP_MS);
      });
    }
    expect(within(currentStep()).getByText('Result')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('사건을 고르면 알리고, 다른 사건이나 조직이면 재생 위치를 처음으로 되돌린다', async () => {
    const user = userEvent.setup();
    const { props, update } = renderView();
    await user.click(screen.getByRole('button', { name: /Fixture event B/ }));
    expect(props.onSelect).toHaveBeenCalledWith('fixture-blocked');

    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(within(currentStep()).getByText('Policy decision')).toBeInTheDocument();
    update({ scopeKey: 'org-b' });
    expect(within(currentStep()).getByText('Event occurred')).toBeInTheDocument();
  });

  it('빈 결과 · 잘못된 사건 · 페이지 끝을 구분한다', async () => {
    const user = userEvent.setup();
    const { update, props } = renderView({
      list: { kind: 'ready', items: fixtureEvents, page: 1, hasNext: true },
      detail: { kind: 'not-found' },
    });
    expect(screen.getByText('This event was not found')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(props.onPageChange).toHaveBeenCalledWith(2);

    update({ list: { kind: 'ready', items: fixtureEvents, page: 2, hasNext: false } });
    expect(screen.getByText('Page 3 · last page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    update({ list: { kind: 'ready', items: [], page: 0, hasNext: false } });
    expect(screen.getByText('No events match these filters')).toBeInTheDocument();
  });
});
