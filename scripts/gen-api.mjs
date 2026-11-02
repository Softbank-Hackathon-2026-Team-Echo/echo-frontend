// echo-was OpenAPI 로 src/lib/api/schema.d.ts 를 만든다.
// OPENAPI_URL(예: http://localhost:8000/openapi.json)이 없으면 로컬 openapi.json 을 쓴다.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const source = process.env.OPENAPI_URL ?? './openapi.json';
if (!process.env.OPENAPI_URL && !existsSync(source)) {
  console.error(
    'OPENAPI_URL 도 로컬 openapi.json 도 없습니다. echo-was 를 띄우고 OPENAPI_URL 을 지정하세요.',
  );
  process.exit(1);
}
const result = spawnSync('openapi-typescript', [source, '-o', 'src/lib/api/schema.d.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
