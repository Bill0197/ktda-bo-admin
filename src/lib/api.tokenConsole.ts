/* Tokenization console (the absorbed apps/tokenization-web) — straight to the
 * tokenization (accounting) service through the same-origin `/tok` proxy, on
 * the signed-in user's own session (see tokApi.ts). The service enforces its
 * own rules per request; a page shows its 403 rather than guessing.
 *
 * Responses are the service's own JSON, unchanged, so the types are its
 * generated ones. tokenConsole/types.gen.ts is generated from the service's
 * /v3/api-docs — regenerate, do not hand-edit; observed corrections live in
 * tokenConsole/spec-deviations.ts.
 *
 * Exported as one namespace rather than loose functions: the console and BO
 * Admin both have "investors", "products" and "journals", and the barrel in
 * api.ts must not end up with two different getProducts. */
import { qs, tokApi } from "./tokApi";
import type * as T from "./tokenConsole/types.gen";
import type { CreateAccrualPolicyBody, CreateDistributionPolicyBody } from "./tokenConsole/spec-deviations";

const A = "/accounting";
const get = <R>(path: string) => tokApi.get<R>(`${A}${path}`);
const post = <R>(path: string, body?: unknown) => tokApi.post<R>(`${A}${path}`, body);
const seg = (id: string) => encodeURIComponent(id);

export type JournalFilter = { account?: string; product?: string; offering?: string };

export const tokenConsole = {
  // The books
  trialBalance: () => get<T.TrialBalanceLine[]>("/trial-balance"),
  glBalances: () => get<T.GlBalanceRow[]>("/gl-balances"),
  journals: (filter: JournalFilter = {}) => get<T.LedgerEntryView[]>(`/journals${qs(filter)}`),
  reconciliation: () => get<T.ReconciliationResult[]>("/reconciliation"),
  unitLedger: () => get<T.UnitHoldingRow[]>("/unit-ledger"),
  unitLedgerActivity: () => get<T.UnitLedgerActivityView[]>("/unit-ledger/activity"),

  // Investors
  investors: () => get<T.Investor[]>("/investors"),
  investor: (id: string) => get<T.InvestorView>(`/investors/${seg(id)}`),
  investorBalances: (id: string) => get<T.InvestorBalancesView>(`/investors/${seg(id)}/balances`),
  unitMovements: (id: string, product: string) =>
    get<T.UnitMovementView[]>(`/investors/${seg(id)}/unit-movements${qs({ product })}`),
  assignClassifier: (id: string, body: T.AssignClassifierRequest) =>
    post<T.InvestorView>(`/investors/${seg(id)}/classifiers`, body),
  suspendInvestor: (id: string, body: T.NoteRequest) => post<T.InvestorView>(`/investors/${seg(id)}/suspend`, body),
  reactivateInvestor: (id: string, body: T.NoteRequest) => post<T.InvestorView>(`/investors/${seg(id)}/reactivate`, body),
  offboardInvestor: (id: string, body: T.NoteRequest) => post<T.InvestorView>(`/investors/${seg(id)}/offboard`, body),

  // Compliance review queue (KYC desk)
  complianceReviews: (status?: string) => get<T.ComplianceReviewItem[]>(`/compliance/reviews${qs({ status })}`),
  clearReview: (queueId: string, body: T.NoteRequest) => post<T.InvestorView>(`/compliance/reviews/${seg(queueId)}/clear`, body),
  rejectReview: (queueId: string, body: T.NoteRequest) => post<T.InvestorView>(`/compliance/reviews/${seg(queueId)}/reject`, body),

  // Accounts (contracts) and loans
  contracts: () => get<T.InvestorContract[]>("/contracts"),
  openAccount: (body: T.OpenAccountRequest) => post<T.OpenAccountResult>("/accounts", body),
  loan: (contractId: string) => get<T.LoanView>(`/loans/${seg(contractId)}`),
  disburseLoan: (contractId: string, amount: number) => post<T.LoanView>(`/loans/${seg(contractId)}/disburse`, { amount }),
  accrueLoan: (contractId: string, days: number) => post<T.LoanView>(`/loans/${seg(contractId)}/accrue`, { days }),
  repayLoan: (contractId: string, amount: number) => post<T.RepayResult>(`/loans/${seg(contractId)}/repay`, { amount }),
  closeLoan: (contractId: string) => post<T.LoanView>(`/loans/${seg(contractId)}/close`),

  // Offerings and their order books
  offerings: () => get<T.OfferingResponse[]>("/offerings"),
  offering: (id: string) => get<T.OfferingResponse>(`/offerings/${seg(id)}`),
  openOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/open`),
  closeOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/close`),
  cancelOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/cancel`),
  holdings: (offeringId: string) => get<T.HoldingResponse[]>(`/offerings/${seg(offeringId)}/holdings`),
  subscriptions: (offeringId: string) => get<T.SubscriptionResponse[]>(`/offerings/${seg(offeringId)}/subscriptions`),
  confirmSubscription: (id: string, body: T.ConfirmSubscriptionRequest) =>
    post<T.SubscriptionResponse>(`/subscriptions/${seg(id)}/confirm`, body),
  cancelSubscription: (id: string) => post<T.SubscriptionResponse>(`/subscriptions/${seg(id)}/cancel`),
  redemptions: (offeringId: string) => get<T.RedemptionResponse[]>(`/offerings/${seg(offeringId)}/redemptions`),
  trades: (offeringId: string) => get<T.TradeResponse[]>(`/offerings/${seg(offeringId)}/trades`),

  // Products
  products: () => get<T.Product[]>("/products"),
  createProduct: (body: T.CreateProductRequest) => post<T.Product>("/products", body),
  productLimits: (productId: string) => get<T.ProductLimit[]>(`/product-limits${qs({ productId })}`),
  createProductLimit: (body: T.CreateProductLimitRequest) => post<T.ProductLimit>("/product-limits", body),
  lifecycleEvents: (productId: string) => get<T.ProductLifecycleEvent[]>(`/lifecycle-events${qs({ productId })}`),
  createLifecycleEvent: (body: T.CreateLifecycleEventRequest) => post<T.ProductLifecycleEvent>("/lifecycle-events", body),
  productGroups: () => get<T.ProductGroup[]>("/product-groups"),
  createProductGroup: (body: T.CreateProductGroupRequest) => post<T.ProductGroup>("/product-groups", body),
  productCategories: () => get<T.ProductCategory[]>("/product-categories"),
  createProductCategory: (body: T.CreateProductCategoryRequest) => post<T.ProductCategory>("/product-categories", body),
  clientCategories: () => get<T.ClientCategory[]>("/client-categories"),
  createClientCategory: (body: T.CreateClientCategoryRequest) => post<T.ClientCategory>("/client-categories", body),
  dateSchemes: () => get<T.DateScheme[]>("/date-schemes"),
  createDateScheme: (body: T.CreateDateSchemeRequest) => post<T.DateScheme>("/date-schemes", body),
  reportTypes: () => get<T.ReportType[]>("/report-types"),
  createReportType: (body: T.CreateReportTypeRequest) => post<T.ReportType>("/report-types", body),

  // Assets and token classes
  assets: (status?: string) => get<T.AssetResponse[]>(`/assets${qs({ status })}`),
  registerAsset: (body: T.RegisterAssetRequest) => post<T.AssetResponse>("/assets", body),
  tokenClasses: () => get<T.TokenClassRef[]>("/token-classes"),

  // Runs and policies
  accrualRuns: () => get<T.AccrualRun[]>("/accrual/runs"),
  distributionRuns: () => get<T.DistributionRun[]>("/distribution/runs"),
  feeRuns: () => get<T.FeeRun[]>("/fees/runs"),
  taxRuns: () => get<T.TaxRemittanceRun[]>("/tax-remittance/runs"),
  accrualPolicies: () => get<T.AccrualPolicyResponse[]>("/policies/accrual"),
  createAccrualPolicy: (body: CreateAccrualPolicyBody) => post<T.AccrualPolicyResponse>("/policies/accrual", body),
  distributionPolicies: () => get<T.DistributionPolicyResponse[]>("/policies/distribution"),
  createDistributionPolicy: (body: CreateDistributionPolicyBody) => post<T.DistributionPolicyResponse>("/policies/distribution", body),
  schedules: () => get<T.ScheduleResponse[]>("/policies/schedules"),

  // Fund structure
  funds: () => get<T.FundResponse[]>("/funds"),
  createFund: (body: T.CreateFundRequest) => post<T.FundResponse>("/funds", body),
  subFunds: () => get<T.SubFundResponse[]>("/sub-funds"),
  createSubFund: (body: T.CreateSubFundRequest) => post<T.SubFundResponse>("/sub-funds", body),
  ladders: () => get<T.BondLadderView[]>("/ladders"),
  institutions: () => get<T.Institution[]>("/institutions"),
  createInstitution: (body: T.CreateInstitutionRequest) => post<T.Institution>("/institutions", body),

  // Tariffs
  tariffDomains: () => get<T.TariffDomain[]>("/tariffs/domains"),
  createTariffDomain: (body: T.CreateTariffDomainRequest) => post<T.TariffDomain>("/tariffs/domains", body),
  tariffTypes: () => get<T.TariffType[]>("/tariffs/types"),
  tariffValues: () => get<T.TariffValue[]>("/tariffs/values"),

  // Reference data
  chart: () => get<T.ChartOfAccount[]>("/chart"),
  schemes: () => get<T.AccountingScheme[]>("/schemes"),
  createScheme: (body: T.CreateSchemeRequest) => post<T.AccountingScheme>("/schemes", body),
  schemeTemplates: (schemeId: string) => get<T.AccountTemplate[]>(`/schemes/${seg(schemeId)}/templates`),
  createAccountTemplate: (body: T.CreateAccountTemplateRequest) => post<T.AccountTemplate>("/account-templates", body),
  servicePackages: () => get<T.ServicePackage[]>("/service-packages"),
  createServicePackage: (body: T.CreatePackageRequest) => post<T.ServicePackage>("/service-packages", body),
  servicePackageItems: (packageId: string) => get<T.ServicePackageItem[]>(`/service-package-items${qs({ packageId })}`),
  createServicePackageItem: (body: T.CreateServicePackageItemRequest) => post<T.ServicePackageItem>("/service-package-items", body),
  contractSubtypes: () => get<T.ContractSubtype[]>("/contract-subtypes"),
  createContractSubtype: (body: T.CreateContractSubtypeRequest) => post<T.ContractSubtype>("/contract-subtypes", body),
  classifierTypes: () => get<T.ClassifierType[]>("/classifiers/types"),
  classifierValues: () => get<T.ClassifierValue[]>("/classifiers/values"),
  transactionTypes: () => get<T.TransactionType[]>("/transaction-types"),
  feeTypes: () => get<T.FeeType[]>("/fee-types"),

  // Tokenization users (the service's own accounts; ADMIN only, enforced there)
  adminUsers: () => tokApi.get<T.AdminUserResponse[]>("/admin/users"),
  userAction: (id: string, action: "approve" | "reject" | "enable" | "disable") =>
    tokApi.post<T.AdminUserResponse>(`/admin/users/${seg(id)}/${action}`),
  activeSessions: () => tokApi.get<T.ActiveSessionResponse[]>("/admin/active-sessions"),
  loginAudit: (limit?: number) => tokApi.get<T.LoginAuditResponse[]>(`/admin/audit${qs({ limit })}`),
};
