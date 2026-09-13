import {
  AssignSerialInput,
  ContactCreateInput,
  ContactDeleteInput,
  ContactUpdateInput,
  CompanyCreateInput,
  CompanyDeleteInput,
  CompanyUpdateInput,
  InstallationCreateInput,
  InstallationDeleteInput,
  InstallationUpdateInput,
  MachineFamilyCreateInput,
  MachineFamilyDeleteInput,
  MachineFamilyUpdateInput,
  MachineModelCreateInput,
  MachineModelDeleteInput,
  MachineModelUpdateInput,
  OptionDefCreateInput,
  OptionDefDeleteInput,
  OptionDefUpdateInput,
  SerialCreateInput,
  SerialDeleteInput,
  SerialUpdateInput,
  SetSerialOptionsInput,
  SiteCreateInput,
  SiteDeleteInput,
  SiteUpdateInput,
  VariantAxisCreateInput,
  VariantAxisDeleteInput,
  VariantAxisUpdateInput,
} from '@argoniq/core-domain';
import {
  GetCompanyInput,
  GetFamilyInput,
  GetModelInput,
  GetOptionDefInput,
  GetSiteInput,
  GetVariantAxisInput,
  ListMachineModelsInput,
  ListCompaniesInput,
  ListOptionDefsInput,
  ListSitesInput,
  ListVariantAxesInput,
  GetContactInput,
  ListContactsInput,
  assignSerial,
  createContact,
  getContact,
  listContacts,
  updateContact,
  deleteContact,
  createCompany,
  createInstallation,
  createMachineFamily,
  createMachineModel,
  createOptionDef,
  createSerial,
  createSite,
  createVariantAxis,
  deleteCompany,
  deleteInstallation,
  deleteMachineFamily,
  deleteMachineModel,
  deleteOptionDef,
  deleteSerial,
  deleteSite,
  deleteVariantAxis,
  getCompany,
  getMachineFamily,
  getMachineModel,
  getOptionDef,
  getSite,
  getVariantAxis,
  listCompanies,
  listMachineFamilies,
  listMachineModels,
  listOptionDefs,
  listSites,
  listVariantAxes,
  setSerialOptions,
  updateCompany,
  updateInstallation,
  updateMachineFamily,
  updateMachineModel,
  updateOptionDef,
  updateSerial,
  updateSite,
  updateVariantAxis,
} from '../../../services/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Management router — the OEM control-center write surface: the installed base
 * (companies, sites, serials, lines) AND the product/type catalog (families, models,
 * variant axes, options). A THIN adapter: each procedure parses its input, then calls
 * the service, which re-validates and re-authorizes (`assertCan`) and audits. No logic
 * lives here. Authorization is NOT the router's job — the service is the contract, so
 * these same procedures stay correct when the auth seam replaces the dev stub.
 *
 * Reads here back the management UI's tables and form pickers; serial reads reuse
 * `machine.listSerials` / `machine.getSerial`.
 */
export const managementRouter = router({
  // ── Companies ──────────────────────────────────────────────────────────────
  listCompanies: protectedProcedure
    .input(ListCompaniesInput)
    .query(({ ctx, input }) => listCompanies(ctx.service, input)),
  getCompany: protectedProcedure
    .input(GetCompanyInput)
    .query(({ ctx, input }) => getCompany(ctx.service, input)),
  createCompany: protectedProcedure
    .input(CompanyCreateInput)
    .mutation(({ ctx, input }) => createCompany(ctx.service, input)),
  updateCompany: protectedProcedure
    .input(CompanyUpdateInput)
    .mutation(({ ctx, input }) => updateCompany(ctx.service, input)),
  deleteCompany: protectedProcedure
    .input(CompanyDeleteInput)
    .mutation(({ ctx, input }) => deleteCompany(ctx.service, input)),

  // ── Sites ──────────────────────────────────────────────────────────────────
  listSites: protectedProcedure
    .input(ListSitesInput)
    .query(({ ctx, input }) => listSites(ctx.service, input)),
  getSite: protectedProcedure
    .input(GetSiteInput)
    .query(({ ctx, input }) => getSite(ctx.service, input)),
  createSite: protectedProcedure
    .input(SiteCreateInput)
    .mutation(({ ctx, input }) => createSite(ctx.service, input)),
  updateSite: protectedProcedure
    .input(SiteUpdateInput)
    .mutation(({ ctx, input }) => updateSite(ctx.service, input)),
  deleteSite: protectedProcedure
    .input(SiteDeleteInput)
    .mutation(({ ctx, input }) => deleteSite(ctx.service, input)),

  // ── Contacts (people at a customer) ──────────────────────────────────────────
  listContacts: protectedProcedure
    .input(ListContactsInput)
    .query(({ ctx, input }) => listContacts(ctx.service, input)),
  getContact: protectedProcedure
    .input(GetContactInput)
    .query(({ ctx, input }) => getContact(ctx.service, input)),
  createContact: protectedProcedure
    .input(ContactCreateInput)
    .mutation(({ ctx, input }) => createContact(ctx.service, input)),
  updateContact: protectedProcedure
    .input(ContactUpdateInput)
    .mutation(({ ctx, input }) => updateContact(ctx.service, input)),
  deleteContact: protectedProcedure
    .input(ContactDeleteInput)
    .mutation(({ ctx, input }) => deleteContact(ctx.service, input)),

  // ── Serials (installed machines) ─────────────────────────────────────────────
  createSerial: protectedProcedure
    .input(SerialCreateInput)
    .mutation(({ ctx, input }) => createSerial(ctx.service, input)),
  updateSerial: protectedProcedure
    .input(SerialUpdateInput)
    .mutation(({ ctx, input }) => updateSerial(ctx.service, input)),
  deleteSerial: protectedProcedure
    .input(SerialDeleteInput)
    .mutation(({ ctx, input }) => deleteSerial(ctx.service, input)),
  assignSerial: protectedProcedure
    .input(AssignSerialInput)
    .mutation(({ ctx, input }) => assignSerial(ctx.service, input)),

  // ── Installations (lines / cells) ────────────────────────────────────────────
  createInstallation: protectedProcedure
    .input(InstallationCreateInput)
    .mutation(({ ctx, input }) => createInstallation(ctx.service, input)),
  updateInstallation: protectedProcedure
    .input(InstallationUpdateInput)
    .mutation(({ ctx, input }) => updateInstallation(ctx.service, input)),
  deleteInstallation: protectedProcedure
    .input(InstallationDeleteInput)
    .mutation(({ ctx, input }) => deleteInstallation(ctx.service, input)),

  // ── Product catalog: families ────────────────────────────────────────────────
  listFamilies: protectedProcedure.query(({ ctx }) => listMachineFamilies(ctx.service)),
  getFamily: protectedProcedure
    .input(GetFamilyInput)
    .query(({ ctx, input }) => getMachineFamily(ctx.service, input)),
  createFamily: protectedProcedure
    .input(MachineFamilyCreateInput)
    .mutation(({ ctx, input }) => createMachineFamily(ctx.service, input)),
  updateFamily: protectedProcedure
    .input(MachineFamilyUpdateInput)
    .mutation(({ ctx, input }) => updateMachineFamily(ctx.service, input)),
  deleteFamily: protectedProcedure
    .input(MachineFamilyDeleteInput)
    .mutation(({ ctx, input }) => deleteMachineFamily(ctx.service, input)),

  // ── Product catalog: models ──────────────────────────────────────────────────
  listModels: protectedProcedure
    .input(ListMachineModelsInput)
    .query(({ ctx, input }) => listMachineModels(ctx.service, input)),
  getModel: protectedProcedure
    .input(GetModelInput)
    .query(({ ctx, input }) => getMachineModel(ctx.service, input)),
  createModel: protectedProcedure
    .input(MachineModelCreateInput)
    .mutation(({ ctx, input }) => createMachineModel(ctx.service, input)),
  updateModel: protectedProcedure
    .input(MachineModelUpdateInput)
    .mutation(({ ctx, input }) => updateMachineModel(ctx.service, input)),
  deleteModel: protectedProcedure
    .input(MachineModelDeleteInput)
    .mutation(({ ctx, input }) => deleteMachineModel(ctx.service, input)),

  // ── Product catalog: variant axes (as-built config schema) ─────────────────────
  listVariantAxes: protectedProcedure
    .input(ListVariantAxesInput)
    .query(({ ctx, input }) => listVariantAxes(ctx.service, input)),
  getVariantAxis: protectedProcedure
    .input(GetVariantAxisInput)
    .query(({ ctx, input }) => getVariantAxis(ctx.service, input)),
  createVariantAxis: protectedProcedure
    .input(VariantAxisCreateInput)
    .mutation(({ ctx, input }) => createVariantAxis(ctx.service, input)),
  updateVariantAxis: protectedProcedure
    .input(VariantAxisUpdateInput)
    .mutation(({ ctx, input }) => updateVariantAxis(ctx.service, input)),
  deleteVariantAxis: protectedProcedure
    .input(VariantAxisDeleteInput)
    .mutation(({ ctx, input }) => deleteVariantAxis(ctx.service, input)),

  // ── Equipment option catalog + per-serial selection ──────────────────────────
  listOptionDefs: protectedProcedure
    .input(ListOptionDefsInput)
    .query(({ ctx, input }) => listOptionDefs(ctx.service, input)),
  getOptionDef: protectedProcedure
    .input(GetOptionDefInput)
    .query(({ ctx, input }) => getOptionDef(ctx.service, input)),
  createOptionDef: protectedProcedure
    .input(OptionDefCreateInput)
    .mutation(({ ctx, input }) => createOptionDef(ctx.service, input)),
  updateOptionDef: protectedProcedure
    .input(OptionDefUpdateInput)
    .mutation(({ ctx, input }) => updateOptionDef(ctx.service, input)),
  deleteOptionDef: protectedProcedure
    .input(OptionDefDeleteInput)
    .mutation(({ ctx, input }) => deleteOptionDef(ctx.service, input)),
  setSerialOptions: protectedProcedure
    .input(SetSerialOptionsInput)
    .mutation(({ ctx, input }) => setSerialOptions(ctx.service, input)),
});
