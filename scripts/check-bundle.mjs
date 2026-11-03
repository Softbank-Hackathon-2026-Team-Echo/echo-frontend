// dist/assets 의 JS 청크 크기(gzip)를 예산과 비교한다. 넘으면 CI 를 실패시킨다.
// 첫 화면 청크(index-*)는 모든 화면이 받으므로 따로 엄하게 본다.
// 웹 워커(elk 토폴로지 배치)는 메인 스레드 밖에서 토폴로지를 그릴 때만 받는다
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const ASSETS = 'dist/assets';
const KB = 1024;
// 11/3 기준 첫 화면 118KB, 가장 큰 화면 청크 64KB(대시보드), elk 워커 433KB. 여유를 두고 잡았다
const ENTRY_BUDGET = 150 * KB;
const CHUNK_BUDGET = 120 * KB;
const WORKER_BUDGET = 450 * KB;

function budgetOf(name) {
  if (name.startsWith('index-')) return ENTRY_BUDGET;
  if (name.includes('worker')) return WORKER_BUDGET;
  return CHUNK_BUDGET;
}

const rows = readdirSync(ASSETS)
  .filter((name) => name.endsWith('.js'))
  .map((name) => {
    const size = gzipSync(readFileSync(join(ASSETS, name))).length;
    return { name, size, budget: budgetOf(name) };
  })
  .sort((a, b) => b.size - a.size);

const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;
for (const row of rows.slice(0, 8)) {
  console.warn(`${row.size > row.budget ? '✗' : '✓'} ${kb(row.size).padStart(9)}  ${row.name}`);
}

const over = rows.filter((row) => row.size > row.budget);
if (over.length > 0) {
  console.error(
    `\n번들 예산 초과: ${over.map((row) => `${row.name} ${kb(row.size)} > ${kb(row.budget)}`).join(', ')}`,
  );
  process.exit(1);
}
console.warn(
  `\n${rows.length}개 청크 모두 예산 안 (첫 화면 ${kb(ENTRY_BUDGET)}, 화면 ${kb(CHUNK_BUDGET)}, 워커 ${kb(WORKER_BUDGET)})`,
);
