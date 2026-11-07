import { describe, expect, it } from 'vitest';
import { standbyRows } from './StandbyFollowCard';

const sync = (id: string, environmentId: string, name: string, status = 'SUCCEEDED') =>
  ({ id, status, environment: { id: environmentId, name, kind: 'gcp' } }) as never;
const names = new Map([['e3', 'onprem']]);

describe('standbyRows', () => {
  it('요청 목록에 있는 환경은 이번에 요청한 예비, 없는 환경은 기존 예비 따라가기다', () => {
    const rows = standbyRows(
      { status: 'SUCCEEDED', standbyEnvironmentIds: ['e2'] },
      [sync('s1', 'e2', 'gcp-seoul'), sync('s2', 'e3', 'onprem')],
      names,
    );
    expect(rows).toMatchObject([
      { kind: 'sync', environmentId: 'e2', requested: true },
      { kind: 'sync', environmentId: 'e3', requested: false },
    ]);
  });

  it('요청했는데 따라가기가 없으면 주 배포 전에는 대기, 성공 뒤에는 건너뜀이다', () => {
    const waiting = standbyRows({ status: 'BUILDING', standbyEnvironmentIds: ['e3'] }, [], names);
    expect(waiting).toEqual([
      { kind: 'requested', environmentId: 'e3', name: 'onprem', state: 'waiting' },
    ]);
    const skipped = standbyRows({ status: 'SUCCEEDED', standbyEnvironmentIds: ['e3'] }, [], names);
    expect(skipped[0]).toMatchObject({ state: 'skipped' });
  });

  it('요청도 따라가기도 없으면 줄이 없다', () => {
    expect(standbyRows({ status: 'SUCCEEDED', standbyEnvironmentIds: [] }, [], names)).toEqual([]);
  });
});
