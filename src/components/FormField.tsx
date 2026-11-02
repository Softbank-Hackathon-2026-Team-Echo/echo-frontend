import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type FormFieldProps = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
};

/** 라벨 · 입력칸 · 안내 · 오류 한 묶음. 입력칸에는 같은 id 와 aria-invalid 를 넘긴다 */
export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger-fg">
          {error}
        </p>
      ) : (
        hint && <p className="text-small text-fg-muted">{hint}</p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
      {message}
    </p>
  );
}
