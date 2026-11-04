import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormError, FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { fieldErrors } from '@/lib/api/form-errors';
import { useCreateOrganization } from '@/lib/api/me';
import { t } from '@/lib/i18n';

// 서버 규칙과 같다: 소문자·숫자·하이픈, 하이픈은 처음·끝·연속 금지, 39자까지
const SLUG_PATTERN = '[a-z0-9](-?[a-z0-9]){0,38}';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 39)
    .replace(/-+$/, '');
}

/** 조직 만들기(O01). 만든 사람이 어드민이 되고 새 조직으로 옮겨 간다 */
export function CreateOrgDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const create = useCreateOrganization();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const errors = fieldErrors(create.error);
  // slug 충돌·예약은 409 라 칸 오류가 아니다. 칸 아래에 보여 준다
  const slugConflict =
    isApiError(create.error) && create.error.code.startsWith('ORGANIZATION_SLUG_')
      ? describeApiError(create.error)
      : undefined;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { name: name.trim(), slug },
      {
        onSuccess: (organization) => {
          onOpenChange(false);
          navigate(`/o/${organization.slug}/onboarding`);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          create.reset();
          setName('');
          setSlug('');
          setSlugEdited(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('Create organization')}</DialogTitle>
            <DialogDescription>
              {t('You become its admin. Invite teammates from Settings › Members.')}
            </DialogDescription>
          </DialogHeader>

          {!slugConflict && <FormError message={errors._form} />}

          <FormField id="org-name" label={t('Name')} error={errors.name}>
            <Input
              id="org-name"
              value={name}
              maxLength={100}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              placeholder="ACME"
              aria-invalid={Boolean(errors.name)}
              required
            />
          </FormField>
          <FormField
            id="org-slug"
            label={t('URL name')}
            hint={t("app.echoport.uk/o/{{slug}} · can't change later", { slug: slug || 'acme' })}
            error={slugConflict ?? errors.slug}
          >
            <Input
              id="org-slug"
              className="font-mono text-mono"
              value={slug}
              pattern={SLUG_PATTERN}
              maxLength={39}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              placeholder="acme"
              aria-invalid={Boolean(slugConflict ?? errors.slug)}
              required
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('Creating…') : t('Create organization')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
