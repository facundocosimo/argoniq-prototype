/**
 * Canonical storage-key builders. Centralized so the upload mutation, the ingestion
 * worker, and the download route all agree on layout — keys are tenant-prefixed so a
 * future bucket policy / RLS-analog can scope by prefix. Revisions are immutable, so
 * a document id (which is per-revision) owns its own folder.
 */

/** The source PDF for a document revision. */
export function documentSourceKey(tenantId: string, documentId: string, ext = 'pdf'): string {
  return `tenants/${tenantId}/documents/${documentId}/source.${ext}`;
}

/** A rendered page image (1-based page) for the gated vision read. */
export function pageImageKey(
  tenantId: string,
  documentId: string,
  page: number,
  ext = 'webp',
): string {
  return `tenants/${tenantId}/documents/${documentId}/pages/${page}.${ext}`;
}
