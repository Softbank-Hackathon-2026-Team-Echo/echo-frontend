// 코드의 t('…') · k('…') 문구가 ko · ja 번역 파일에 모두 있는지 본다. 빠지면 CI 를 실패시킨다.
// 영어 문구가 키라서 빠져도 화면은 깨지지 않지만, 시연 중 영어가 섞이지 않게 막는다
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP = new Set(['locales', 'test', 'dev']);
const CALL = /(?<![\w.])[tk]\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP.has(name) ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.|\.d\.ts$/.test(name) ? [path] : [];
  });
}

const unquote = (text) => text.replace(/\\(['"`\\])/g, '$1');
const keys = new Map();
const dynamic = [];
for (const path of sources('src')) {
  for (const match of readFileSync(path, 'utf8').matchAll(CALL)) {
    const key = unquote(match[1] ?? match[2] ?? match[3]);
    if (match[3] !== undefined && key.includes('${')) dynamic.push(`${path}: ${key}`);
    else keys.set(key, path);
  }
}

function bundle(locale) {
  const dir = join('src/locales', locale);
  return Object.assign(
    {},
    ...readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))),
  );
}

const vars = (text) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort().join();
let failed = false;
for (const locale of ['ko', 'ja']) {
  const messages = bundle(locale);
  const missing = [...keys].filter(([key]) => !messages[key]);
  const broken = [...keys].filter(([key]) => messages[key] && vars(messages[key]) !== vars(key));
  for (const [key, path] of missing) console.error(`${locale} 번역 없음: "${key}" (${path})`);
  for (const [key] of broken) console.error(`${locale} 자리표시 다름: "${key}"`);
  failed ||= missing.length + broken.length > 0;
}
for (const item of dynamic) console.error(`t 안에 \${} 를 쓰지 않는다: ${item}`);
if (failed || dynamic.length > 0) process.exit(1);
console.warn(`문구 ${keys.size}개 모두 ko · ja 번역 있음`);
