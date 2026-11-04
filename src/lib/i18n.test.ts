import { afterEach, describe, expect, it } from 'vitest';
import { changeLocale, currentLocale, detectLocale, k, t } from './i18n';

afterEach(async () => {
  await changeLocale('en');
  window.localStorage.clear();
});

describe('detectLocale', () => {
  it('직접 고른 언어가 브라우저 언어보다 먼저다', () => {
    expect(detectLocale('en', 'ja-JP')).toBe('en');
  });

  it('고른 언어가 없으면 브라우저 언어가 ko · ja 일 때만 따른다', () => {
    expect(detectLocale(null, 'ko-KR')).toBe('ko');
    expect(detectLocale(null, 'ja')).toBe('ja');
    expect(detectLocale(null, 'fr-FR')).toBe('en');
  });
});

describe('t', () => {
  it('영어에서는 키를 그대로 쓰고 자리를 채운다', () => {
    expect(t('Migration {{id}} rolled back', { id: 'abc' })).toBe('Migration abc rolled back');
  });

  it('번역이 없는 문구는 다른 언어에서도 영어로 나온다', async () => {
    await changeLocale('ko');
    expect(t('This sentence: has no translation. {{n}}', { n: 1 })).toBe(
      'This sentence: has no translation. 1',
    );
  });

  it('k 는 표에 적은 문구를 그대로 돌려준다', () => {
    expect(k('Connected')).toBe('Connected');
  });
});

describe('changeLocale', () => {
  it('언어를 바꾸면 html lang 과 저장값이 바뀐다', async () => {
    await changeLocale('ja');
    expect(currentLocale()).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(window.localStorage.getItem('echoport.locale')).toBe('ja');
  });
});
