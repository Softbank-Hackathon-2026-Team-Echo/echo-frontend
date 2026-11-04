import { useSyncExternalStore } from 'react';
import { changeLocale, currentLocale, LOCALES, onLocaleChange } from '@/lib/i18n';

export function useLocale() {
  const locale = useSyncExternalStore(onLocaleChange, currentLocale);
  return { locale, locales: LOCALES, setLocale: changeLocale };
}
