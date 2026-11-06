import type { VariableColumn } from '@/lib/api/variables';

/** 값을 넣을 환경을 고른다 */
export function EnvironmentChecks({
  columns,
  picked,
  onChange,
  label,
}: {
  columns: VariableColumn[];
  picked: string[];
  onChange: (picked: string[]) => void;
  label: string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="text-small text-fg-secondary">
        {label}
      </span>
      {columns.map(({ link }) => {
        const { id, name } = link.environment;
        return (
          <label key={id} className="flex items-center gap-1.5 text-body">
            <input
              type="checkbox"
              className="accent-brand"
              checked={picked.includes(id)}
              onChange={(event) =>
                onChange(
                  event.target.checked ? [...picked, id] : picked.filter((item) => item !== id),
                )
              }
            />
            {name}
          </label>
        );
      })}
    </fieldset>
  );
}
