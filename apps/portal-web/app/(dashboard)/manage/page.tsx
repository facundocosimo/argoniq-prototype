import { redirect } from 'next/navigation';
import { routes } from '../../../lib/routes.js';

/** `/manage` lands on the companies registry — the root of the installed base. */
export default function ManageIndexPage(): never {
  redirect(routes.manage.companies);
}
