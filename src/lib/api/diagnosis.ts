// 시뮬레이션: 진단 API(POST /deploy-requests/{id}/diagnosis)를 부를 수 없거나 패치가 없을 때만 쓰는 규칙 분류다.
// 고치기 버튼 하나를 고르는 데 쓰고, 이 값을 그릴 때는 항상 simulated 배지를 단다
import { k } from '@/lib/i18n';
import { type DeployRequestDetail, type DiagnosisCategory, deployFailure } from './types';

/** 고치기 버튼 하나가 하는 일. 모두 이미 있는 화면 동작으로 이어진다 */
export type DiagnosisFix =
  | 'OPEN_VARIABLES'
  | 'OPEN_SETTINGS'
  | 'OPEN_BUILD_LOG'
  | 'ROLLBACK'
  | 'REDEPLOY';

export type Diagnosis = {
  category: DiagnosisCategory;
  /** 원인 설명 (영어 문구 키) */
  cause: string;
  /** 고치는 방법 설명 (영어 문구 키) */
  remedy: string;
  fix: DiagnosisFix;
  /** 오류 문장에서 찾은 변수 이름 (예: DATABASE_URL) */
  variable: string | null;
  /** 판단 근거가 된 로그 줄(최대 3줄, 서버가 가린 그대로). 근거 없이 원인을 지어내지 않으려고 같이 보인다 */
  evidence: string[];
  simulated: true;
};

export const CATEGORY_LABELS: Record<DiagnosisCategory, string> = {
  CODE: k('Code error'),
  CONFIG: k('Config error'),
  BUILD: k('Build error'),
  RUNTIME: k('Runtime error'),
  PLATFORM: k('Platform error'),
  DEPENDENCY: k('Dependency issue'),
};

export const FIX_LABELS: Record<DiagnosisFix, string> = {
  OPEN_VARIABLES: k('Add the missing variable'),
  OPEN_SETTINGS: k('Fix service settings'),
  OPEN_BUILD_LOG: k('Open the build log'),
  ROLLBACK: k('Roll back to the last good version'),
  REDEPLOY: k('Deploy again'),
};

// 대문자 + 밑줄 이름(DATABASE_URL), 또는 pydantic 오류의 소문자 칸 이름(database_url)
const VARIABLE_PATTERN =
  /\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b|ValidationError[^a-z]*([a-z][a-z0-9]*_[a-z0-9_]+)/;
const ENV_HINT = /environment variable|env var|not set|missing|ValidationError|required/i;
const ERROR_LINE = /error|exception|traceback|panic|fatal|missing|required|not set|killed/i;

/** 근거 줄: 변수 이름이 든 줄 → 오류처럼 보이는 줄 순서로 3줄 */
function pickEvidence(lines: string[], variable: string | null): string[] {
  const lower = variable?.toLowerCase();
  const withVariable = lower ? lines.filter((line) => line.toLowerCase().includes(lower)) : [];
  const errors = lines.filter((line) => ERROR_LINE.test(line) && !withVariable.includes(line));
  return [...withVariable, ...errors].slice(0, 3);
}

export function findVariable(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = message.match(VARIABLE_PATTERN);
  // pydantic 은 칸 이름을 혼자 한 줄에 쓴다("database_url" 다음 줄 "Field required")
  const fieldLine = /ValidationError/.test(message)
    ? message.match(/^\s*([a-z][a-z0-9]*_[a-z0-9_]+)\s*$/m)
    : null;
  const name = match?.[1] ?? match?.[2] ?? fieldLine?.[1];
  return name ? name.toUpperCase() : null;
}

/** 실패한 배포 요청을 규칙으로 분류한다. 실패가 아니면 null */
export function diagnoseDeploy(
  request: Pick<DeployRequestDetail, 'status' | 'errorCode' | 'errorMessage' | 'failure'>,
): Diagnosis | null {
  if (request.status !== 'FAILED') return null;
  const failure = deployFailure(request);
  const lines = failure?.logTail ?? [];
  const message = [request.errorMessage ?? '', failure?.message ?? '', ...lines].join('\n');
  const variable = findVariable(message);
  const base = { variable, evidence: pickEvidence(lines, variable), simulated: true as const };

  // 컨테이너 로그에 변수 이름이 보이면 실패 코드와 상관없이 설정 오류다(가짜 실행기는 DEPLOY_FAILED 로 준다)
  if (variable && lines.length > 0 && ENV_HINT.test(message)) {
    return {
      ...base,
      category: 'CONFIG',
      cause: k('The app exited at start because a required variable is missing.'),
      remedy: k('Add the variable for this environment, then deploy.'),
      fix: 'OPEN_VARIABLES',
    };
  }
  if (failure?.exitCode === 137 || failure?.terminationReason === 'OOMKilled') {
    return {
      ...base,
      category: 'RUNTIME',
      cause: k('The container ran out of memory and was killed.'),
      remedy: k('Roll back now, then lower memory use or raise the limit.'),
      fix: 'ROLLBACK',
    };
  }

  switch (request.errorCode) {
    case 'ENV_SECRET_UNAVAILABLE':
      return {
        ...base,
        category: 'CONFIG',
        cause: k('A pinned variable version could not be read from the secret store.'),
        remedy: k('Save the variable again, then deploy.'),
        fix: 'OPEN_VARIABLES',
      };
    case 'CONTAINER_START_FAILED':
      if (variable || ENV_HINT.test(message)) {
        return {
          ...base,
          category: 'CONFIG',
          cause: k('The app exited at start because a required variable is missing.'),
          remedy: k('Add the variable for this environment, then deploy.'),
          fix: 'OPEN_VARIABLES',
        };
      }
      return {
        ...base,
        category: 'RUNTIME',
        cause: k('The container kept exiting after it started.'),
        remedy: k('Check the runtime log. Roll back while you fix the code.'),
        fix: 'ROLLBACK',
      };
    case 'HEALTH_CHECK_FAILED':
    case 'HEALTH_CHECK_TIMEOUT':
      return {
        ...base,
        category: 'CONFIG',
        cause: k('The app did not answer on the health check path or port.'),
        remedy: k('Check the health check path and container port.'),
        fix: 'OPEN_SETTINGS',
      };
    case 'REF_NOT_FOUND':
    case 'REPO_NOT_ACCESSIBLE':
      return {
        ...base,
        category: 'CONFIG',
        cause: k('EchoPort could not read the branch or repository.'),
        remedy: k('Check the repository URL and GitHub App access.'),
        fix: 'OPEN_SETTINGS',
      };
    case 'BUILD_FAILED':
    case 'BUILD_TIMEOUT':
    case 'BUILD_DISPATCH_FAILED':
      return {
        ...base,
        category: 'BUILD',
        cause: k('The image build did not finish.'),
        remedy: k('Read the build log for the failing step, fix it, then deploy.'),
        fix: 'OPEN_BUILD_LOG',
      };
    case 'IMAGE_PULL_FAILED':
    case 'CLUSTER_UNAUTHORIZED':
    case 'WORKER_LOST':
    case 'INTERNAL_ERROR':
    case 'SOURCE_PROVIDER_UNAVAILABLE':
      return {
        ...base,
        category: 'PLATFORM',
        cause: k('The failure came from the platform, not from your code.'),
        remedy: k('Deploy again. If it repeats, ask the platform team.'),
        fix: 'REDEPLOY',
      };
    default:
      return {
        ...base,
        category: 'RUNTIME',
        cause: k('The new version did not become healthy.'),
        remedy: k('Roll back to the last good version, then check the runtime log.'),
        fix: 'ROLLBACK',
      };
  }
}
