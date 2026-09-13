import { type JSX } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button, EmptyState } from '@argoniq/ui';

/**
 * Global not-found. The fallback for any unmatched route — a calm
 * EmptyState with a way back to the machines list, never a raw 404.
 */
export default function NotFound(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Compass className="size-6" aria-hidden />}
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/machines">Back to machines</Link>
          </Button>
        }
      />
    </div>
  );
}
