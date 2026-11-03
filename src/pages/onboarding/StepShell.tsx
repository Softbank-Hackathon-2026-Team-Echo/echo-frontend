import type { ReactNode } from 'react';

/** 단계 화면 머리: 큰 제목 + 리드 문단(Figma O01~O03) */
export function StepShell({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3">
      <h1 className="text-h1">{title}</h1>
      <p className="text-lead text-fg-secondary">{lead}</p>
      <div className="mt-1 flex flex-col gap-3">{children}</div>
    </section>
  );
}
