import { router } from '../trpc.js';
import { machineRouter } from './machine.js';
import { installationRouter } from './installation.js';
import { managementRouter } from './management.js';
import { platformRouter } from './platform.js';
import { documentRouter } from './document.js';
import { caseRouter } from './case.js';
import { intelligenceRouter } from './intelligence.js';

/** The application router — the typed surface the web app consumes. */
export const appRouter = router({
  machine: machineRouter,
  installation: installationRouter,
  management: managementRouter,
  platform: platformRouter,
  document: documentRouter,
  case: caseRouter,
  intelligence: intelligenceRouter,
});

/** The contract the client infers its types from. */
export type AppRouter = typeof appRouter;
