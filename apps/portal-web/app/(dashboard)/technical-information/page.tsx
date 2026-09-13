import { redirect } from 'next/navigation';
import { routes } from '../../../lib/routes.js';

/**
 * Legacy redirect. Technical information is now machine-scoped ("Manuals" at
 * `/machines/{serial}/manuals`, Asset-360). The global list is gone; the document
 * VIEWER lives on at `/technical-information/{documentId}` (cited deep-links). Send the
 * bare list to the installed base to pick a machine.
 */
export default function TechnicalInformationRedirect(): never {
  redirect(routes.machines);
}
