import { variableKeyProblem } from './api/variables';

export type EnvEntry = { key: string; value: string };
export type EnvProblem = {
  line: number;
  key: string | null;
  reason: 'syntax' | 'invalid' | 'reserved';
};

/**
 * 붙여 넣은 .env 를 키 · 값으로 나눈다. 주석과 빈 줄은 건너뛰고 `export ` 는 뗀다.
 * 따옴표 값은 여러 줄을 받는다. 같은 키가 또 나오면 뒤의 값이 이긴다
 */
export function parseEnvFile(text: string): { entries: EnvEntry[]; problems: EnvProblem[] } {
  const lines = text.split(/\r?\n/);
  const values = new Map<string, string>();
  const problems: EnvProblem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = (lines[index] ?? '').trim();
    if (!raw || raw.startsWith('#')) continue;
    const line = index + 1;
    const assignment = raw.replace(/^export\s+/, '');
    const equals = assignment.indexOf('=');
    if (equals < 1) {
      problems.push({ line, key: null, reason: 'syntax' });
      continue;
    }
    const key = assignment.slice(0, equals).trim();
    let value = assignment.slice(equals + 1).trim();
    const quote = value[0] === '"' || value[0] === "'" ? value[0] : null;
    if (quote) {
      let rest = value.slice(1);
      while (!rest.includes(quote) && index + 1 < lines.length) {
        index += 1;
        rest += `\n${lines[index] ?? ''}`;
      }
      const end = rest.indexOf(quote);
      value = end === -1 ? rest : rest.slice(0, end);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    const problem = variableKeyProblem(key);
    if (problem) {
      problems.push({ line, key, reason: problem });
      continue;
    }
    if (!value) {
      problems.push({ line, key, reason: 'syntax' });
      continue;
    }
    values.set(key, value);
  }

  return { entries: [...values].map(([key, value]) => ({ key, value })), problems };
}
