/** Central route builders for navigable URLs. Keep in sync with `navigation.ts`. */
export const routes = {
  home: '/',
  machines: '/machines',
  /** Machine overview and its nested answer and manual routes. */
  serial: (serialId: string): string => `/machines/${serialId}`,
  machineResolve: (serialId: string): string => `/machines/${serialId}/resolve`,
  machineManuals: (serialId: string): string => `/machines/${serialId}/manuals`,
  /** A line/cell (installation) and its station schematic. */
  line: (installationId: string): string => `/machines/lines/${installationId}`,
  /** Document viewer route used by citation links. */
  technicalDocument: (documentId: string): string => `/technical-information/${documentId}`,
  /** Support cases across machines. */
  cases: '/cases',
  manage: {
    documents: '/manage/documents',
    documentsCoverage: '/manage/documents/coverage',
    documentsResolve: '/manage/documents/resolve',
    companies: '/manage/companies',
    contacts: '/manage/contacts',
    sites: '/manage/sites',
    machines: '/manage/machines',
    lines: '/manage/lines',
    /**
     * Catalog Studio — the product/type catalog. `/manage/models` is the families
     * registry; a family opens to its models, a model to its variant axes + option
     * catalog. Options are authored in the context of their model, never standalone.
     */
    models: '/manage/models',
    modelsFamily: (id: string): string => `/manage/models/families/${id}`,
    modelsModel: (id: string): string => `/manage/models/${id}`,
    modelsAxis: (id: string): string => `/manage/models/axes/${id}`,
    modelsOption: (id: string): string => `/manage/models/options/${id}`,
  },
} as const;
