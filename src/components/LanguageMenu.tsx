import { Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocale } from '@/hooks/useLocale';
import { LOCALE_LABELS, t } from '@/lib/i18n';

/** 로그인 전 화면의 언어 선택. 로그인 뒤에는 사용자 메뉴에서 고른다 */
export function LanguageMenu() {
  const { locale, locales, setLocale } = useLocale();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('Language')}>
          <Languages aria-hidden />
          {LOCALE_LABELS[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((name) => (
          <DropdownMenuItem key={name} onSelect={() => setLocale(name)}>
            <span className="flex-1">{LOCALE_LABELS[name]}</span>
            {name === locale && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
