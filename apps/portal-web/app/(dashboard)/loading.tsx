import { type JSX } from 'react';
import { PageContainer, Skeleton, Spinner, Stack, TableSkeleton } from '@argoniq/ui';

/**
 * Dashboard loading state. The standard page skeleton — a header
 * placeholder over the shared TableSkeleton — shown while a Server Component streams
 * its data. No shimmer, no layout shift. A visually hidden Spinner carries
 * `role=status` so the wait is announced to assistive tech.
 */
export default function DashboardLoading(): JSX.Element {
  return (
    <PageContainer>
      <Stack gap={6}>
        <Stack gap={2}>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </Stack>
        <TableSkeleton rows={6} columns={3} />
      </Stack>
      <span className="sr-only">
        <Spinner />
      </span>
    </PageContainer>
  );
}
