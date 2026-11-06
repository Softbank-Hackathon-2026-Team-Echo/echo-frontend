import { describe, expect, it } from 'vitest';
import { parseEnvFile } from './env-file';

describe('parseEnvFile', () => {
  it('주석 · 빈 줄 · export · 따옴표를 처리한다', () => {
    const { entries, problems } = parseEnvFile(
      '# db\n\nexport DATABASE_URL=postgres://a:b@c/d\nAPI_KEY="x y"\nMODE=demo # 시연\n',
    );

    expect(entries).toEqual([
      { key: 'DATABASE_URL', value: 'postgres://a:b@c/d' },
      { key: 'API_KEY', value: 'x y' },
      { key: 'MODE', value: 'demo' },
    ]);
    expect(problems).toEqual([]);
  });

  it('따옴표 값은 여러 줄을 받고 같은 키는 뒤가 이긴다', () => {
    const { entries } = parseEnvFile('PEM="a\nb"\nMODE=one\nMODE=two');

    expect(entries).toEqual([
      { key: 'PEM', value: 'a\nb' },
      { key: 'MODE', value: 'two' },
    ]);
  });

  it('형식 오류 · 잘못된 이름 · 예약 이름 · 빈 값은 줄 번호와 함께 뺀다', () => {
    const { entries, problems } = parseEnvFile('nonsense\nlower=1\nPORT=80\nEMPTY=\nOK=1');

    expect(entries).toEqual([{ key: 'OK', value: '1' }]);
    expect(problems).toEqual([
      { line: 1, key: null, reason: 'syntax' },
      { line: 2, key: 'lower', reason: 'invalid' },
      { line: 3, key: 'PORT', reason: 'reserved' },
      { line: 4, key: 'EMPTY', reason: 'syntax' },
    ]);
  });
});
