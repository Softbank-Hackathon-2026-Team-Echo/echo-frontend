import { describe, expect, it } from 'vitest';
import { ApiError } from './api/errors';
import { isReportable, reportError } from './monitoring';

const apiError = (status: number, code = 'X') => new ApiError({ status, code, message: code });

describe('isReportable', () => {
  it('화면이 처리하는 4xx 는 보내지 않는다', () => {
    for (const status of [401, 403, 404, 409, 422]) {
      expect(isReportable(apiError(status))).toBe(false);
    }
  });

  it('5xx · 네트워크 오류 · 봉투가 아닌 응답 · 일반 오류는 보낸다', () => {
    expect(isReportable(apiError(502))).toBe(true);
    expect(isReportable(apiError(0, 'NETWORK_ERROR'))).toBe(true);
    expect(isReportable(apiError(200, 'UNEXPECTED_RESPONSE'))).toBe(true);
    expect(isReportable(new TypeError('boom'))).toBe(true);
  });
});

describe('reportError', () => {
  it('DSN 이 없으면(테스트 · 로컬) 아무 일도 하지 않는다', () => {
    expect(() => reportError(new Error('boom'))).not.toThrow();
  });
});
