/* Tokenization console (the merged apps/tokenization-web) — reached through
 * CORE's gateway at /api/token-console/*, which forwards to CardinalForge's
 * accounting service under a service account and checks this user's tok_*
 * permissions per endpoint (core-api: gateway/GatewayRoutes.java). The
 * browser never holds a CardinalForge session. An endpoint added here must
 * also be added to GatewayRoutes, or it answers 404.
 *
 * Responses are the accounting service's own JSON, unchanged, so the types
 * are that service's generated ones. tokenConsole/types.gen.ts is a copy of
 * apps/tokenization-web/src/lib/accounting/types.gen.ts — regenerate it
 * there (`npm run gen:types`) and copy it across; do not hand-edit it.
 *
 * Exported as one namespace rather than loose functions: the console and BO
 * Admin both have "investors", "products" and "journals", and the barrel in
 * api.ts must not end up with two different getProducts. */
import { get, post } from "./apiClient";
import type * as T from "./tokenConsole/types.gen";

const BASE = "/api/token-console/accounting";

/** Drops empty values so a blank filter is not sent as `?x=`, which the
 * service reads as an empty value rather than "unset". */
function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const seg = (id: string) => encodeURIComponent(id);

export const tokenConsole = {
  // The books
  trialBalance: () => get<T.TrialBalanceLine[]>(`${BASE}/trial-balance`),
  glBalances: () => get<T.GlBalanceRow[]>(`${BASE}/gl-balances`),
  journals: () => get<T.LedgerEntryView[]>(`${BASE}/journals`),
  reconciliation: () => get<T.ReconciliationResult[]>(`${BASE}/reconciliation`),
  unitLedger: () => get<T.UnitHoldingRow[]>(`${BASE}/unit-ledger`),
  unitLedgerActivity: () => get<T.UnitLedgerActivityView[]>(`${BASE}/unit-ledger/activity`),

  // Register
  investors: () => get<T.Investor[]>(`${BASE}/investors`),
  contracts: () => get<T.InvestorContract[]>(`${BASE}/contracts`),
  offerings: () => get<T.OfferingResponse[]>(`${BASE}/offerings`),
  complianceReviews: () => get<T.ComplianceReviewItem[]>(`${BASE}/compliance/reviews`),

  // Products
  products: () => get<T.Product[]>(`${BASE}/products`),
  createProduct: (body: T.CreateProductRequest) => post<T.Product>(`${BASE}/products`, body),
  productLimits: (productId: string) => get<T.ProductLimit[]>(`${BASE}/product-limits${qs({ productId })}`),
  createProductLimit: (body: T.CreateProductLimitRequest) => post<T.ProductLimit>(`${BASE}/product-limits`, body),
  lifecycleEvents: (productId: string) => get<T.ProductLifecycleEvent[]>(`${BASE}/lifecycle-events${qs({ productId })}`),
  createLifecycleEvent: (body: T.CreateLifecycleEventRequest) => post<T.ProductLifecycleEvent>(`${BASE}/lifecycle-events`, body),
  productGroups: () => get<T.ProductGroup[]>(`${BASE}/product-groups`),
  productCategories: () => get<T.ProductCategory[]>(`${BASE}/product-categories`),
  clientCategories: () => get<T.ClientCategory[]>(`${BASE}/client-categories`),
  dateSchemes: () => get<T.DateScheme[]>(`${BASE}/date-schemes`),
  reportTypes: () => get<T.ReportType[]>(`${BASE}/report-types`),

  // Runs and policies
  accrualRuns: () => get<T.AccrualRun[]>(`${BASE}/accrual/runs`),
  distributionRuns: () => get<T.DistributionRun[]>(`${BASE}/distribution/runs`),
  feeRuns: () => get<T.FeeRun[]>(`${BASE}/fees/runs`),
  taxRuns: () => get<T.TaxRemittanceRun[]>(`${BASE}/tax-remittance/runs`),
  accrualPolicies: () => get<T.AccrualPolicyResponse[]>(`${BASE}/policies/accrual`),
  distributionPolicies: () => get<T.DistributionPolicyResponse[]>(`${BASE}/policies/distribution`),
  schedules: () => get<T.ScheduleResponse[]>(`${BASE}/policies/schedules`),

  // Fund structure
  funds: () => get<T.FundResponse[]>(`${BASE}/funds`),
  subFunds: () => get<T.SubFundResponse[]>(`${BASE}/sub-funds`),
  ladders: () => get<T.BondLadderView[]>(`${BASE}/ladders`),
  institutions: () => get<T.Institution[]>(`${BASE}/institutions`),

  // Tariffs
  tariffDomains: () => get<T.TariffDomain[]>(`${BASE}/tariffs/domains`),
  tariffTypes: () => get<T.TariffType[]>(`${BASE}/tariffs/types`),
  tariffValues: () => get<T.TariffValue[]>(`${BASE}/tariffs/values`),

  // Reference data
  chart: () => get<T.ChartOfAccount[]>(`${BASE}/chart`),
  schemes: () => get<T.AccountingScheme[]>(`${BASE}/schemes`),
  schemeTemplates: (schemeId: string) => get<T.AccountTemplate[]>(`${BASE}/schemes/${seg(schemeId)}/templates`),
  createAccountTemplate: (body: T.CreateAccountTemplateRequest) => post<T.AccountTemplate>(`${BASE}/account-templates`, body),
  servicePackages: () => get<T.ServicePackage[]>(`${BASE}/service-packages`),
  servicePackageItems: (packageId: string) => get<T.ServicePackageItem[]>(`${BASE}/service-package-items${qs({ packageId })}`),
  createServicePackageItem: (body: T.CreateServicePackageItemRequest) => post<T.ServicePackageItem>(`${BASE}/service-package-items`, body),
  contractSubtypes: () => get<T.ContractSubtype[]>(`${BASE}/contract-subtypes`),
  createContractSubtype: (body: T.CreateContractSubtypeRequest) => post<T.ContractSubtype>(`${BASE}/contract-subtypes`, body),
  classifierTypes: () => get<T.ClassifierType[]>(`${BASE}/classifiers/types`),
  classifierValues: () => get<T.ClassifierValue[]>(`${BASE}/classifiers/values`),
  transactionTypes: () => get<T.TransactionType[]>(`${BASE}/transaction-types`),
  feeTypes: () => get<T.FeeType[]>(`${BASE}/fee-types`),
};
