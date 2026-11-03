type Rgb = [number, number, number];

const FALLBACK: Rgb = [0.5, 0.5, 0.5];

/** `--ep-color-*` 토큰(#rrggbb)을 cobe 가 받는 0~1 RGB 로 바꾼다. 테마가 바뀌면 다시 읽는다 */
export function readTokenRgb(name: string): Rgb {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!match) return FALLBACK;
  const [, r = '80', g = '80', b = '80'] = match;
  return [Number.parseInt(r, 16) / 255, Number.parseInt(g, 16) / 255, Number.parseInt(b, 16) / 255];
}
