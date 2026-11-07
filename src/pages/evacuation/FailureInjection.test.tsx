import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';
import { FailureInjection, type Simulate } from './FailureInjection';

beforeAll(() => {
  // Radix Select が使う API は jsdom にない（ブラウザでは実装済み）
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.scrollIntoView = () => {};
});

function Harness() {
  const [value, onChange] = useState<Simulate | null>(null);
  return <FailureInjection value={value} onChange={onChange} />;
}

const TRAFFIC_STEPS = [
  'Step 1 · 5%',
  'Step 2 · 10%',
  'Step 3 · 25%',
  'Step 4 · 50%',
  'Step 6 · 75%',
  'Step 7 · 100%',
];

describe('FailureInjection', () => {
  it.each([
    ['Too many 5xx on the target', TRAFFIC_STEPS],
    ['Target receives no traffic', TRAFFIC_STEPS.slice(0, 2)],
    ['Health check fails', TRAFFIC_STEPS],
    ['Traffic weight cannot be applied', TRAFFIC_STEPS],
    ['Replication lag too high', ['Step 5 · data sync check']],
    ['Quiet service (passes as low traffic)', TRAFFIC_STEPS],
  ])('%s 사유는 서버가 허용하는 단계만 고른다', async (reason, expected) => {
    renderRoute(<Harness />);
    await userEvent.click(screen.getByLabelText('Inject a failure (demo)'));
    await userEvent.click(screen.getByRole('option', { name: reason }));
    await userEvent.click(screen.getByLabelText('At step'));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(expected);
    const last = expected.at(-1) ?? '';
    await userEvent.click(screen.getByRole('option', { name: last }));
    expect(screen.getByLabelText('At step')).toHaveTextContent(last);
    await userEvent.click(screen.getByLabelText('Inject a failure (demo)'));
    await userEvent.click(screen.getByRole('option', { name: 'No failure' }));
    expect(screen.queryByLabelText('At step')).not.toBeInTheDocument();
  });

  it('사유를 바꾸면 이전에 고른 단계 대신 새 사유의 첫 단계를 쓴다', async () => {
    renderRoute(<Harness />);
    await userEvent.click(screen.getByLabelText('Inject a failure (demo)'));
    await userEvent.click(screen.getByRole('option', { name: 'Replication lag too high' }));
    expect(screen.getByLabelText('At step')).toHaveTextContent('Step 5 · data sync check');
    await userEvent.click(screen.getByLabelText('Inject a failure (demo)'));
    await userEvent.click(screen.getByRole('option', { name: 'Target receives no traffic' }));
    expect(screen.getByLabelText('At step')).toHaveTextContent('Step 1 · 5%');
  });
});
