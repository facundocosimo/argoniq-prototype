'use client';

/**
 * Client helpers for the DEV session control (persona switch / impersonation).
 * Each posts to the dev session route, then does a FULL navigation so the RSC tree
 * re-resolves the principal from the freshly-set cookies (a client cache
 * invalidation would not re-run server-side principal resolution).
 */
async function post(body: unknown): Promise<void> {
  await fetch('/api/dev/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function reloadWorkspace(destination: '/' | '/machines' | '/platform'): void {
  // A full page load ensures the server reads the updated development session cookie.
  window.location.assign(destination);
}

export async function switchPersona(key: string): Promise<void> {
  await post({ action: 'persona', key });
  reloadWorkspace('/');
}

export async function impersonateTenant(tenantId: string, tenantName: string): Promise<void> {
  await post({ action: 'impersonate', tenantId, tenantName });
  reloadWorkspace('/machines');
}

export async function exitImpersonation(): Promise<void> {
  await post({ action: 'exit' });
  reloadWorkspace('/platform');
}
