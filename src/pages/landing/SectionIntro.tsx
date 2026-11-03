import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

type SectionIntroProps = {
  id: string;
  title: ReactNode;
  description: string;
  link?: { label: string; to: string };
};

/** 섹션 머리: 왼쪽 큰 제목 + 오른쪽 설명·링크 (L01 ③ ④ ⑤ 공통) */
export function SectionIntro({ id, title, description, link }: SectionIntroProps) {
  return (
    <div className="grid grid-cols-2 gap-x-16 gap-y-4 max-compact:grid-cols-1">
      <h2 id={id} className="scroll-mt-20 text-h1 compact:text-headline">
        {title}
      </h2>
      <div className="flex flex-col items-start gap-4 pt-2">
        <p className="text-lead-sm text-fg-secondary">{description}</p>
        {link &&
          (link.to.startsWith('#') ? (
            <a
              href={link.to}
              className="flex items-center gap-1.5 text-body-medium text-brand hover:underline"
            >
              {link.label}
              <ArrowRight aria-hidden className="size-4" />
            </a>
          ) : (
            <Link
              to={link.to}
              className="flex items-center gap-1.5 text-body-medium text-brand hover:underline"
            >
              {link.label}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ))}
      </div>
    </div>
  );
}
