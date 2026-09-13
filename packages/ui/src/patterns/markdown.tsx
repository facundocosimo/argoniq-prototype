import { type JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/cn.js';

/**
 * Markdown — renders model/answer text (bold, lists, tables, code, links) as formatted
 * content instead of raw `**asterisks**`. GFM tables matter here: a grounded answer
 * often quotes a spec table (compressed-air pressures, torque specs). react-markdown is
 * XSS-safe by construction (no raw HTML), and every element is tokenized to the design
 * system so answers read as one restrained, corporate surface — never a chatbot dump.
 */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('text-text flex flex-col gap-2 text-sm leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="text-text">{children}</p>,
          strong: ({ children }) => <strong className="text-text font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 flex list-disc flex-col gap-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="ml-4 flex list-decimal flex-col gap-1">{children}</ol>
          ),
          li: ({ children }) => <li className="text-text marker:text-text-subtle">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-accent hover:underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-surface text-text rounded px-1 py-0.5 font-mono text-[0.85em]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="border-border bg-surface overflow-x-auto rounded-md border p-3 text-xs">
              {children}
            </pre>
          ),
          h1: ({ children }) => <h3 className="text-text text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-text text-sm font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-text text-sm font-semibold">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="border-border text-text-muted border-l-2 pl-3">
              {children}
            </blockquote>
          ),
          // Match the system table language: bordered container, hairline rows, no
          // vertical grid, quiet zebra, subtle header — the same look as DataTable.
          table: ({ children }) => (
            <div className="border-border overflow-x-auto rounded-lg border">
              <table className="[&_tbody_tr:nth-child(even)]:bg-surface/60 [&_tbody_tr]:border-border w-full border-collapse text-xs [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-border bg-surface border-b">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-text-muted px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="text-text px-3 py-2 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
