import { describe, expect, it } from 'vitest';
import { diagnoseDeploy, findVariable } from './diagnosis';

const failed = (errorCode: string | null, errorMessage: string | null = null) =>
  ({ status: 'FAILED', errorCode, errorMessage }) as Parameters<typeof diagnoseDeploy>[0];

describe('diagnoseDeploy', () => {
  it('실패가 아니면 진단하지 않는다', () => {
    expect(diagnoseDeploy({ status: 'SUCCEEDED', errorCode: null, errorMessage: null })).toBeNull();
  });

  it('변수 이름이 보이는 시작 실패는 설정 오류이고 변수 탭으로 보낸다', () => {
    const result = diagnoseDeploy(
      failed('CONTAINER_START_FAILED', 'KeyError: environment variable DATABASE_URL is not set'),
    );
    expect(result).toMatchObject({
      category: 'CONFIG',
      fix: 'OPEN_VARIABLES',
      variable: 'DATABASE_URL',
      simulated: true,
    });
  });

  it('변수 단서가 없는 시작 실패는 실행 오류이고 되돌리기를 권한다', () => {
    expect(diagnoseDeploy(failed('CONTAINER_START_FAILED', 'segfault'))).toMatchObject({
      category: 'RUNTIME',
      fix: 'ROLLBACK',
    });
  });

  it('빌드 실패는 빌드 로그로, 플랫폼 실패는 다시 배포로 보낸다', () => {
    expect(diagnoseDeploy(failed('BUILD_FAILED'))?.fix).toBe('OPEN_BUILD_LOG');
    expect(diagnoseDeploy(failed('WORKER_LOST'))?.category).toBe('PLATFORM');
  });

  it('pydantic 칸 이름도 대문자 변수 이름으로 찾는다', () => {
    expect(
      findVariable(
        'ValidationError: 1 validation error for Settings\ndatabase_url\n  Field required',
      ),
    ).toBe('DATABASE_URL');
  });
});

describe('diagnoseDeploy 컨테이너 로그(echo-was #97)', () => {
  it('실패 코드가 DEPLOY_FAILED 여도 로그에 빠진 변수가 보이면 변수 탭으로 보내고 근거 줄을 붙인다', () => {
    const request = {
      status: 'FAILED',
      errorCode: 'DEPLOY_FAILED',
      errorMessage: 'The deployment to the environment failed.',
      failure: {
        code: 'DEPLOY_FAILED',
        message:
          'The deployment to the environment failed. Last error: ValidationError: database_url',
        exitCode: 1,
        logTail: [
          'Starting application',
          'pydantic_core._pydantic_core.ValidationError: 1 validation error for Settings',
          'database_url',
          '  Field required [type=missing, input_value={}, input_type=dict]',
        ],
        previousVersionRunning: false,
      },
    } as unknown as Parameters<typeof diagnoseDeploy>[0];
    const result = diagnoseDeploy(request);
    expect(result).toMatchObject({
      category: 'CONFIG',
      fix: 'OPEN_VARIABLES',
      variable: 'DATABASE_URL',
    });
    expect(result?.evidence[0]).toBe('database_url');
  });

  it('OOMKilled 는 메모리 부족으로 본다', () => {
    const request = {
      status: 'FAILED',
      errorCode: 'CONTAINER_START_FAILED',
      errorMessage: null,
      failure: { exitCode: 137, terminationReason: 'OOMKilled', logTail: [] },
    } as unknown as Parameters<typeof diagnoseDeploy>[0];
    expect(diagnoseDeploy(request)?.cause).toBe('The container ran out of memory and was killed.');
  });
});
