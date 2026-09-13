'use client';

import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { IconButton, PageHeader, Tooltip, TooltipContent, TooltipTrigger } from '@argoniq/ui';

/** Route-owned identity and return metadata. Parent metadata selects one back
 * destination; it is never rendered as a breadcrumb trail. */
export type Crumb = { label: string; href?: string };

type Chrome = {
  pathname: string;
  title: string;
  breadcrumbs: Crumb[];
  meta: ReactNode;
  actions: ReactNode;
};
type ChromeContextValue = { chrome: Chrome; setChrome: (chrome: Chrome) => void };

const EMPTY: Chrome = { pathname: '', title: '', breadcrumbs: [], meta: null, actions: null };
const NO_CRUMBS: Crumb[] = [];
const PageChromeContext = createContext<ChromeContextValue | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [chrome, setChrome] = useState<Chrome>(EMPTY);
  return (
    <PageChromeContext.Provider value={{ chrome, setChrome }}>
      {children}
    </PageChromeContext.Provider>
  );
}

export function usePageChrome(): ChromeContextValue {
  const ctx = useContext(PageChromeContext);
  if (!ctx) throw new Error('usePageChrome must be used within <PageChromeProvider>');
  return ctx;
}

export function PageChrome({
  title,
  breadcrumbs = NO_CRUMBS,
  meta = null,
  actions = null,
}: {
  title: string;
  breadcrumbs?: Crumb[];
  meta?: ReactNode;
  actions?: ReactNode;
}): null {
  const { setChrome } = usePageChrome();
  const pathname = usePathname();
  useEffect(() => {
    setChrome({ pathname, title, breadcrumbs, meta, actions });
  }, [setChrome, pathname, title, breadcrumbs, meta, actions]);
  return null;
}

/** Do not expose a previous route's actions while the next page is streaming. */
export function TopbarActions(): JSX.Element | null {
  const { chrome } = usePageChrome();
  const pathname = usePathname();
  if (chrome.pathname !== pathname || !chrome.actions) return null;
  return <>{chrome.actions}</>;
}

/** Explicit parent destination, not browser history: direct links and new tabs
 * retain a useful return path. Existing list preferences restore at that path. */
export function RecordBackLink({ href, label }: { href: string; label: string }): JSX.Element {
  const accessibleLabel = `Back to ${label}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton asChild size="touch">
          <Link href={href} aria-label={accessibleLabel}>
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{accessibleLabel}</TooltipContent>
    </Tooltip>
  );
}

export function PageTitleBar(): JSX.Element | null {
  const { chrome } = usePageChrome();
  const pathname = usePathname();
  const { title, breadcrumbs, meta, actions } = chrome;
  if (chrome.pathname !== pathname || !title) return null;
  const parent = breadcrumbs
    .slice(0, -1)
    .filter((crumb) => crumb.href && crumb.href !== pathname)
    .at(-1);

  return (
    <PageHeader
      title={title}
      back={parent?.href ? <RecordBackLink href={parent.href} label={parent.label} /> : null}
      status={meta}
      actions={actions}
      className="px-4 sm:px-6 lg:px-8"
    />
  );
}
