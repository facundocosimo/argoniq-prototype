import { type StoredMembership } from '@argoniq/auth';
import { UserId, roleSpaceOf } from '@argoniq/core-domain';
import { listIdentityMemberships, getMembershipCompany } from '@argoniq/db';
export {
  activeMemberships,
  principalForMembership,
  resolveSelectedMembership,
} from '@argoniq/auth';

/** One identity-scoped lookup, followed by tenant-scoped customer ownership checks. */
export async function membershipsForUser(userId: string): Promise<readonly StoredMembership[]> {
  const rows = await listIdentityMemberships(UserId.parse(userId));
  const validated = await Promise.all(
    rows.map(async (row): Promise<StoredMembership | null> => {
      if (roleSpaceOf(row.role) === 'customer') {
        if (!row.companyId) return null;
        const company = await getMembershipCompany(row.tenantId, row.companyId);
        if (!company) return null;
        return { ...row, companyName: company.name };
      } else if (row.companyId) return null;
      return { ...row, companyName: null };
    }),
  );
  return validated.filter((row): row is StoredMembership => row !== null);
}
