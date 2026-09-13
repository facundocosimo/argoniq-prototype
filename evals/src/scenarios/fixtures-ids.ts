import { CompanyId, DocumentId, SerialId, TenantId } from '@argoniq/core-domain';

/**
 * Stable, hand-authored ids for the golden fixtures. Anonymized — no real
 * customer/site identifiers — but serial config is preserved.
 * Parsed through the branded schemas so fixtures are typed exactly like
 * production ids and a wrong-entity id is a compile error.
 */

/** The pilot Manufacturer. */
export const TENANT_OEM = TenantId.parse('11111111-1111-4111-8111-111111111111');
/** A *different* Manufacturer — used by the cross-tenant probe. */
export const TENANT_OTHER = TenantId.parse('22222222-2222-4222-8222-222222222222');

/** The requesting customer (owner of the serial in play). */
export const CUSTOMER_OWNER = CompanyId.parse('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
/** A different customer in the same tenant — used by the cross-customer probe. */
export const CUSTOMER_OTHER = CompanyId.parse('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

/** SC-B-2022-019: spray cabin, Model B, SW 2.1, water-curtain, pump group PG2. */
export const SERIAL_SCB = SerialId.parse('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
/** A *different* serial owned by the same customer — used by the cross-serial probe. */
export const SERIAL_OTHER = SerialId.parse('c0000000-0000-4ccc-8ccc-cccccccccccc');

/** T1 manual page (customer-citable). */
export const DOC_MANUAL = DocumentId.parse('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
/** T2 owner config/history document (customer-specific, this serial). */
export const DOC_OWNER_CONFIG = DocumentId.parse('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
/** T3 internal service bulletin SB-PG2 (reason over, never quote). */
export const DOC_SB_PG2 = DocumentId.parse('ffffffff-ffff-4fff-8fff-ffffffffffff');
