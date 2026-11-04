// 화면 문구 번역. 영어 문구 자체가 키라서 영어 파일이 없고, 번역이 빠진 문구는 영어로 나온다.
// 언어를 바꾸면 App 이 화면을 다시 만들므로 컴포넌트 밖 함수(lib/status 등)도 t 를 바로 부른다
import i18next from 'i18next';

export const LOCALES = ['en', 'ko', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
};

const STORAGE_KEY = 'echoport.locale';

type Bundle = { default: Record<string, string> };
const BUNDLES: Record<Exclude<Locale, 'en'>, () => Promise<Bundle>> = {
  ko: () => import('@/locales/ko'),
  ja: () => import('@/locales/ja'),
};

i18next.init({
  lng: 'en',
  fallbackLng: false,
  initAsync: false,
  // 키가 영어 문장이라 . 과 : 을 구분자로 쓰지 않는다
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  resources: {},
});

/** 영어 문구를 지금 언어로 바꾼다. {{name}} 자리는 values 로 채운다 */
export function t(key: string, values?: Record<string, string | number>): string {
  return i18next.t(key, values ?? {});
}

/** 모듈 맨 위 표에 영어 문구를 적을 때 쓴다. 번역은 그릴 때 t(값) 으로 한다. check-i18n 이 이 표시로 문구를 찾는다 */
export function k<T extends string>(key: T): T {
  return key;
}

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// 사생활 보호 모드·저장소 차단에서는 접근만으로 예외가 나므로 실패하면 브라우저 언어를 따른다
function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** 직접 고른 언어가 먼저고, 없으면 브라우저 언어가 ko · ja 일 때만 따른다 */
export function detectLocale(stored: Locale | null, browserLanguage: string): Locale {
  if (stored) return stored;
  const language = browserLanguage.slice(0, 2);
  return isLocale(language) ? language : 'en';
}

export function currentLocale(): Locale {
  return isLocale(i18next.language) ? i18next.language : 'en';
}

async function applyLocale(locale: Locale) {
  if (locale !== 'en' && !i18next.hasResourceBundle(locale, 'translation')) {
    const bundle = await BUNDLES[locale]();
    i18next.addResourceBundle(locale, 'translation', bundle.default);
  }
  await i18next.changeLanguage(locale);
  document.documentElement.lang = locale;
}

/** 첫 렌더 전에 불러 영어가 잠깐 보이지 않게 한다 */
export async function initLocale() {
  await applyLocale(detectLocale(readStoredLocale(), navigator.language));
}

export async function changeLocale(locale: Locale) {
  await applyLocale(locale);
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // 저장하지 못해도 이번 탭에서는 바뀐 언어로 동작한다
  }
}

export function onLocaleChange(listener: () => void) {
  i18next.on('languageChanged', listener);
  return () => i18next.off('languageChanged', listener);
}
