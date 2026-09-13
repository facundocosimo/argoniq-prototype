import { type ReactNode, type JSX } from 'react';
import { LogoMark } from '@argoniq/ui';
import { ThemeToggle } from '../../components/theme-toggle.js';

export default function AuthLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="bg-bg text-text grid min-h-dvh lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
      <aside className="bg-surface text-sidebar-text border-border hidden flex-col justify-between border-r p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <LogoMark size={34} glow={false} />
          <span className="text-lg font-semibold tracking-tight">ArgonIQ</span>
        </div>
        <div className="max-w-sm py-16">
          <p className="text-sidebar-text-subtle mb-6 font-mono text-xs tracking-[0.2em] uppercase">
            OEM / Aftersales
          </p>
          <h2 className="text-4xl leading-tight font-medium tracking-tight xl:text-5xl">
            The right context.
            <br />
            For every machine.
          </h2>
          <div className="divide-sidebar-border border-sidebar-border mt-10 divide-y border-y">
            {['Machine records', 'Technical documentation', 'Service conversations'].map(
              (label, index) => (
                <div
                  key={label}
                  className="text-sidebar-text-muted flex items-center gap-5 py-4 text-sm"
                >
                  <span className="text-sidebar-text-subtle font-mono text-xs">0{index + 1}</span>
                  {label}
                </div>
              ),
            )}
          </div>
        </div>
        <p className="text-sidebar-text-subtle font-mono text-xs">ArgonIQ · Service workspace</p>
      </aside>
      <div className="flex min-w-0 flex-col px-6 pt-5 pb-8 sm:px-10">
        <header className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 lg:invisible">
            <LogoMark size={27} glow={false} />
            <span className="text-sm font-semibold">ArgonIQ</span>
          </span>
          <ThemeToggle />
        </header>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
        <p className="text-text-subtle text-center text-xs">
          Your OEM workspace. Your authorized machine records.
        </p>
      </div>
    </main>
  );
}
