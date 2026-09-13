import { type JSX } from 'react';
import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { Button, EmptyState } from '@argoniq/ui';

/**
 * Serial not-found. Reached when the requested serial does not
 * exist or is out of the actor's scope (the service 404s either case — it never
 * reveals which). A calm EmptyState with the way back, never a raw error page.
 */
export default function SerialNotFound(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Boxes className="size-6" aria-hidden />}
        title="Machine not found"
        description="This serial does not exist or is not in your scope."
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/machines">Back to machines</Link>
          </Button>
        }
      />
    </div>
  );
}
