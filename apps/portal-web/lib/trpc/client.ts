'use client';

import { type CreateTRPCReact, createTRPCReact } from '@trpc/react-query';
import { type AppRouter } from '@argoniq/core/trpc';

/**
 * The typed tRPC React client. Its types are *inferred* from `AppRouter` — the
 * one contract defined in packages/core. There is no
 * hand-redeclared API shape here; changing a service propagates automatically.
 *
 * Client-only: the hooks (`useQuery`, etc.) run in the browser. RSC reads go
 * through the server caller in `./server.ts` instead.
 */
// Explicit annotation: tRPC's inferred client type references internal.d.ts
// paths that aren't portable across the workspace (TS2742) — name it directly.
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();
