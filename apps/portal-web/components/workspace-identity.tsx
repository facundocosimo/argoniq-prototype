import { type JSX } from 'react';
import { LogoMark } from '@argoniq/ui';

export type WorkspaceIdentityProps = {
  companyName: string;
  accountType: 'OEM' | 'Customer' | 'Platform';
  workspaceLabel: string;
};

/** Persistent account context. Workspace actions belong in the user menu. */
export function WorkspaceIdentity({
  companyName,
  accountType,
  workspaceLabel,
}: WorkspaceIdentityProps): JSX.Element {
  return (
    <div className="flex min-h-11 min-w-0 items-center gap-2 px-1 py-1">
      <span className="flex size-7 shrink-0 items-center justify-center" aria-hidden>
        <LogoMark size={25} glow={false} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-text text-base leading-5 font-semibold break-words">
          {companyName}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4">
          {accountType !== 'Customer' ? (
            <span className="bg-accent-subtle text-accent rounded-sm px-1.5 py-0.5 font-semibold">
              {accountType}
            </span>
          ) : null}
          <span className="text-text-muted font-medium">{workspaceLabel}</span>
        </span>
      </div>
    </div>
  );
}
