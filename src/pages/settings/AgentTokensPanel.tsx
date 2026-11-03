import { Bot, Copy } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { FormError, FormField } from '@/components/FormField';
import { RoleButton } from '@/components/RoleButton';
import { StatusBadge } from '@/components/StatusBadge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { fieldErrors } from '@/lib/api/form-errors';
import { useAgentTokens, useIssueAgentToken, useRevokeAgentToken } from '@/lib/api/members';
import type { AgentToken, IssuedAgentToken } from '@/lib/api/types';
import { dateTime, timeAgo } from '@/lib/format';
import type { StatusView } from '@/lib/status';

// 서버 기본 30일, 최대 90일
const EXPIRY_DAYS = [7, 30, 90] as const;

function tokenState(token: AgentToken, now = Date.now()): StatusView {
  if (token.revokedAt) return { label: 'Revoked', tone: 'neutral' };
  if (new Date(token.expiresAt).getTime() <= now) return { label: 'Expired', tone: 'neutral' };
  return { label: 'Active', tone: 'success' };
}

function IssueTokenDialog({
  open,
  onOpenChange,
  orgId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}) {
  const issue = useIssueAgentToken(orgId);
  const [name, setName] = useState('');
  const [days, setDays] = useState<number>(30);
  // 원문은 이 응답에만 한 번 온다. 다이얼로그를 닫으면 버리고 다시 보여 줄 수 없다
  const [issued, setIssued] = useState<IssuedAgentToken>();
  const [copied, setCopied] = useState(false);
  const errors = fieldErrors(issue.error);

  function close(next: boolean) {
    if (!next) {
      setName('');
      setDays(30);
      setIssued(undefined);
      setCopied(false);
      issue.reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    issue.mutate({ name: name.trim(), expiresInDays: days }, { onSuccess: setIssued });
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      // 복사 권한이 없으면 사용자가 칸에서 직접 고른다
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {issued ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Copy the token now</DialogTitle>
              <DialogDescription>
                This is the only time EchoPort shows it. Store it where the agent reads its secrets.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={issued.token}
                aria-label="Agent token"
                className="font-mono text-mono"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={() => copy(issued.token)}>
                <Copy aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Issue agent token</DialogTitle>
              <DialogDescription>
                The AI agent can read this organization with it. Production changes are refused and
                logged.
              </DialogDescription>
            </DialogHeader>
            <FormField id="token-name" label="Name" error={errors.name}>
              <Input
                id="token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="echoport-agent"
                aria-invalid={Boolean(errors.name)}
                required
              />
            </FormField>
            <FormField id="token-expiry" label="Expires in" error={errors.expiresInDays}>
              <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
                <SelectTrigger id="token-expiry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_DAYS.map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormError message={errors._form} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={issue.isPending || !name.trim()}>
                Issue token
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 에이전트 토큰(개발자 이상). 읽기 전용이고, 원문은 발급할 때 한 번만 보인다 */
export function AgentTokensPanel({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const tokens = useAgentTokens(orgId, canManage);
  const revoke = useRevokeAgentToken(orgId);
  const [issueOpen, setIssueOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-title">Agent tokens</h2>
          <p className="text-small text-fg-secondary">
            For the AI agent. Read-only on this org; production changes are refused and logged.
            Shown once when issued.
          </p>
        </div>
        <RoleButton
          requires="DEVELOPER"
          variant="outline"
          size="sm"
          onClick={() => setIssueOpen(true)}
        >
          Issue token
        </RoleButton>
      </header>
      {!canManage ? (
        <p className="text-small text-fg-muted">Developers and admins can see agent tokens.</p>
      ) : tokens.isError ? (
        <ErrorState error={tokens.error} onRetry={() => tokens.refetch()} />
      ) : tokens.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : tokens.data.items.length === 0 ? (
        <p className="flex items-center gap-2 text-small text-fg-muted">
          <Bot aria-hidden className="size-4" />
          No agent tokens yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-t border-line">
          {tokens.data.items.map((token) => {
            const state = tokenState(token);
            return (
              <li key={token.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-mono text-mono">{token.name}</span>
                <StatusBadge {...state} />
                <span className="text-caption text-fg-muted">
                  …{token.last4} · issued {dateTime(token.createdAt)} · expires{' '}
                  {dateTime(token.expiresAt)} · last used{' '}
                  {token.lastUsedAt ? timeAgo(token.lastUsedAt) : 'never'}
                </span>
                {state.label === 'Active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(token.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <IssueTokenDialog open={issueOpen} onOpenChange={setIssueOpen} orgId={orgId} />
    </section>
  );
}
