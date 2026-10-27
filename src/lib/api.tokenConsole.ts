/* Baracel Unyt (the absorbed apps/tokenization-web) — straight to the
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
import type { AssetBackingRowActual, CreateAccrualPolicyBody, CreateDistributionPolicyBody } from "./tokenConsole/spec-deviations";
import type { ChangePayload, ChangeStatus, ChangeType, ConfigChange } from "./tokenConsole/configChanges";
import type { BondTerms, MarketQuote } from "./tokenConsole/prices";

const A = "/accounting";
const get = <R>(path: string) => tokApi.get<R>(`${A}${path}`);
const post = <R>(path: string, body?: unknown) => tokApi.post<R>(`${A}${path}`, body);
const put = <R>(path: string, body?: unknown) => tokApi.put<R>(`${A}${path}`, body);
const del = <R>(path: string) => tokApi.del<R>(`${A}${path}`);
const seg = (id: string) => encodeURIComponent(id);

export type JournalFilter = { account?: string; product?: string; offering?: string };

export const tokenConsole = {
  // The books
  trialBalance: () => get<T.TrialBalanceLine[]>("/trial-balance"),
  /** Every bond's terms, with the desk's price where one is set. */
  bondTerms: () => get<BondTerms[]>("/bond-terms"),
  /** The live two-way quote of every open priced bond. */
  quotes: () => get<MarketQuote[]>("/quotes"),
  glBalances: () => get<T.GlBalanceRow[]>("/gl-balances"),
  journals: (filter: JournalFilter = {}) => get<T.LedgerEntryView[]>(`/journals${qs(filter)}`),
  reconciliation: () => get<T.ReconciliationResult[]>("/reconciliation"),
  unitLedger: () => get<T.UnitHoldingRow[]>("/unit-ledger"),
  unitLedgerActivity: () => get<T.UnitLedgerActivityView[]>("/unit-ledger/activity"),
  journal: (journalId: string) => get<T.LedgerEntryView>(`/journals/${seg(journalId)}`),
  approveJournal: (journalId: string) => post<T.PostingReceipt>(`/journals/${seg(journalId)}/approve`),
  /** Post a business event; the posting rules turn it into a balanced journal. */
  postEvent: (body: T.PostEventRequest) => post<T.PostingReceipt>("/events", body),
  reconciliationFor: (productId: string) => get<T.ReconciliationResult>(`/reconciliation/${seg(productId)}`),

  // Investors
  investors: () => get<T.Investor[]>("/investors"),
  onboardInvestor: (body: T.OnboardInvestorRequest) => post<T.OnboardResult>("/investors", body),
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
  account: (contractId: string) => get<T.AccountView>(`/accounts/${seg(contractId)}`),
  withdrawable: (contractId: string) => get<T.WithdrawalView>(`/accounts/${seg(contractId)}/withdrawable`),
  withdraw: (contractId: string, body: T.WithdrawRequest) => post<T.WithdrawalView>(`/accounts/${seg(contractId)}/withdrawals`, body),
  freezeAccount: (contractId: string) => post<T.AccountView>(`/accounts/${seg(contractId)}/freeze`),
  unfreezeAccount: (contractId: string) => post<T.AccountView>(`/accounts/${seg(contractId)}/unfreeze`),
  closeAccount: (contractId: string) => post<T.AccountView>(`/accounts/${seg(contractId)}/close`),
  loan: (contractId: string) => get<T.LoanView>(`/loans/${seg(contractId)}`),
  disburseLoan: (contractId: string, amount: number) => post<T.LoanView>(`/loans/${seg(contractId)}/disburse`, { amount }),
  accrueLoan: (contractId: string, days: number) => post<T.LoanView>(`/loans/${seg(contractId)}/accrue`, { days }),
  repayLoan: (contractId: string, amount: number) => post<T.RepayResult>(`/loans/${seg(contractId)}/repay`, { amount }),
  closeLoan: (contractId: string) => post<T.LoanView>(`/loans/${seg(contractId)}/close`),

  // Offerings and their order books
  offerings: () => get<T.OfferingResponse[]>("/offerings"),
  offering: (id: string) => get<T.OfferingResponse>(`/offerings/${seg(id)}`),
  createOffering: (body: T.CreateOfferingRequest) => post<T.OfferingResponse>("/offerings", body),
  connectUnitLedger: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/connect-unit-ledger`),
  openOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/open`),
  closeOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/close`),
  cancelOffering: (id: string) => post<T.OfferingResponse>(`/offerings/${seg(id)}/cancel`),
  holdings: (offeringId: string) => get<T.HoldingResponse[]>(`/offerings/${seg(offeringId)}/holdings`),
  subscriptions: (offeringId: string) => get<T.SubscriptionResponse[]>(`/offerings/${seg(offeringId)}/subscriptions`),
  subscribe: (offeringId: string, body: T.SubscribeRequest) => post<T.SubscriptionResponse>(`/offerings/${seg(offeringId)}/subscriptions`, body),
  subscription: (id: string) => get<T.SubscriptionResponse>(`/subscriptions/${seg(id)}`),
  confirmSubscription: (id: string, body: T.ConfirmSubscriptionRequest) =>
    post<T.SubscriptionResponse>(`/subscriptions/${seg(id)}/confirm`, body),
  cancelSubscription: (id: string) => post<T.SubscriptionResponse>(`/subscriptions/${seg(id)}/cancel`),
  redemptions: (offeringId: string) => get<T.RedemptionResponse[]>(`/offerings/${seg(offeringId)}/redemptions`),
  redeem: (offeringId: string, body: T.RedeemRequest) => post<T.RedemptionResponse>(`/offerings/${seg(offeringId)}/redemptions`, body),
  redemption: (id: string) => get<T.RedemptionResponse>(`/redemptions/${seg(id)}`),
  trades: (offeringId: string) => get<T.TradeResponse[]>(`/offerings/${seg(offeringId)}/trades`),
  createTrade: (offeringId: string, body: T.CreateTradeRequest) => post<T.TradeResponse>(`/offerings/${seg(offeringId)}/trades`, body),
  allTrades: () => get<T.TradeResponse[]>("/trades"),

  // Products
  products: () => get<T.Product[]>("/products"),
  createProduct: (body: T.CreateProductRequest) => post<T.Product>("/products", body),
  activateProduct: (productId: string) => post<T.Product>(`/products/${seg(productId)}/activate`),
  deactivateProduct: (productId: string) => post<T.Product>(`/products/${seg(productId)}/deactivate`),

  // Maker-checker (see tokenConsole/configChanges.ts). The console stages every
  // controlled write here. The direct calls for those writes (products above;
  // coupon tariff, tariffs, schemes, templates, packages, items and an
  // institution's default domain below) now answer 202 with a change request
  // and stay for reference only.
  configChanges: (status?: ChangeStatus) => get<ConfigChange[]>(`/config/changes${qs({ status })}`),
  configChange: (requestId: string) => get<ConfigChange>(`/config/changes/${seg(requestId)}`),
  /** 202 with the staged request; nothing is applied until someone else approves it. */
  stageChange: <K extends ChangeType>(type: K, payload: ChangePayload[K], summary?: string) =>
    post<ConfigChange>("/config/changes", { type, payload, summary }),
  /** 409 if you made it, it is no longer pending, or the engine refuses the replay (it is then FAILED). */
  approveChange: (requestId: string, note?: string) => post<ConfigChange>(`/config/changes/${seg(requestId)}/approve`, { note }),
  rejectChange: (requestId: string, note: string) => post<ConfigChange>(`/config/changes/${seg(requestId)}/reject`, { note }),
  /** Only the maker can withdraw their own pending request. */
  cancelChange: (requestId: string) => post<ConfigChange>(`/config/changes/${seg(requestId)}/cancel`),
  linkTokenClass: (productId: string, body: T.LinkTokenClassRequest) => post<T.Product>(`/products/${seg(productId)}/token-class`, body),
  assignSubFund: (productId: string, body: T.AssignSubFundRequest) => post<T.Product>(`/products/${seg(productId)}/sub-fund`, body),
  productCouponTariffs: () => get<T.ProductCouponTariff[]>("/product-coupon-tariffs"),
  assignCouponTariff: (body: T.AssignProductCouponTariffRequest) => post<T.ProductCouponTariff>("/product-coupon-tariff", body),
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
  asset: (assetId: string) => get<T.AssetResponse>(`/assets/${seg(assetId)}`),
  approveAsset: (assetId: string) => post<T.AssetResponse>(`/assets/${seg(assetId)}/approve`),
  retireAsset: (assetId: string) => post<T.AssetResponse>(`/assets/${seg(assetId)}/retire`),
  /** The live rows' `rungs` are offering claims, not bond rungs — see spec-deviations. */
  assetBacking: () => get<AssetBackingRowActual[]>("/asset-backing"),
  tokenClasses: () => get<T.TokenClassRef[]>("/token-classes"),

  // Runs and policies
  accrualRuns: () => get<T.AccrualRun[]>("/accrual/runs"),
  distributionRuns: () => get<T.DistributionRun[]>("/distribution/runs"),
  feeRuns: () => get<T.FeeRun[]>("/fees/runs"),
  taxRuns: () => get<T.TaxRemittanceRun[]>("/tax-remittance/runs"),
  runAccrual: (body: T.AccrualRunRequest) => post<T.AccrualRunSummary>("/accrual/runs", body),
  runDistribution: (body: T.DistributionRunRequest) => post<T.DistributionRunSummary>("/distribution/runs", body),
  runFees: (body: T.FeeRunRequest) => post<T.FeeRunSummary>("/fees/runs", body),
  runTaxRemittance: (body: T.TaxRemittanceRunRequest) => post<T.TaxRemittanceRunSummary>("/tax-remittance/runs", body),
  accrualEntries: (runId: string) => get<T.AccrualEntry[]>(`/accrual/runs/${seg(runId)}/entries`),
  distributionEntries: (runId: string) => get<T.DistributionEntry[]>(`/distribution/runs/${seg(runId)}/entries`),
  feeEntries: (runId: string) => get<T.FeeEntry[]>(`/fees/runs/${seg(runId)}/entries`),
  taxEntries: (runId: string) => get<T.TaxRemittanceEntry[]>(`/tax-remittance/runs/${seg(runId)}/entries`),
  nav: (productId: string) => get<T.NavView>(`/nav/${seg(productId)}`),
  navHistory: (productId: string) => get<T.NavSnapshotView[]>(`/nav/${seg(productId)}/history`),
  runNav: (asOf?: string) => post<T.NavRunSummary>(`/nav/run${qs({ asOf })}`),
  accrualPolicies: () => get<T.AccrualPolicyResponse[]>("/policies/accrual"),
  createAccrualPolicy: (body: CreateAccrualPolicyBody) => post<T.AccrualPolicyResponse>("/policies/accrual", body),
  distributionPolicies: () => get<T.DistributionPolicyResponse[]>("/policies/distribution"),
  createDistributionPolicy: (body: CreateDistributionPolicyBody) => post<T.DistributionPolicyResponse>("/policies/distribution", body),
  schedules: () => get<T.ScheduleResponse[]>("/policies/schedules"),
  setAccrualPolicyActive: (policyId: string, value: boolean) => post<T.AccrualPolicyResponse>(`/policies/accrual/${seg(policyId)}/active${qs({ value })}`),
  setAccrualPolicySchedule: (policyId: string, value: boolean) => post<T.AccrualPolicyResponse>(`/policies/accrual/${seg(policyId)}/schedule${qs({ value })}`),
  configureAccrualSchedule: (policyId: string, body: T.SetAccrualScheduleRequest) =>
    post<T.AccrualPolicyResponse>(`/policies/accrual/${seg(policyId)}/schedule-config`, body),
  setDistributionPolicyActive: (policyId: string, value: boolean) =>
    post<T.DistributionPolicyResponse>(`/policies/distribution/${seg(policyId)}/active${qs({ value })}`),
  createSchedule: (body: T.CreateScheduleRequest) => post<T.ScheduleResponse>("/policies/schedules", body),
  setScheduleEnabled: (scheduleId: string, value: boolean) => post<T.ScheduleResponse>(`/policies/schedules/${seg(scheduleId)}/enabled${qs({ value })}`),

  // Fund structure
  funds: () => get<T.FundResponse[]>("/funds"),
  createFund: (body: T.CreateFundRequest) => post<T.FundResponse>("/funds", body),
  subFunds: () => get<T.SubFundResponse[]>("/sub-funds"),
  createSubFund: (body: T.CreateSubFundRequest) => post<T.SubFundResponse>("/sub-funds", body),
  ladders: () => get<T.BondLadderView[]>("/ladders"),
  ladder: (subFundId: string) => get<T.BondLadderView>(`/sub-funds/${seg(subFundId)}/ladder`),
  addRung: (subFundId: string, body: T.AddRungRequest) => post<T.BondLadderRung>(`/sub-funds/${seg(subFundId)}/ladder`, body),
  sampleLadder: (subFundId: string) => post<T.BondLadderView>(`/sub-funds/${seg(subFundId)}/ladder/sample`),
  clearLadder: (subFundId: string) => del<void>(`/sub-funds/${seg(subFundId)}/ladder`),
  institutions: () => get<T.Institution[]>("/institutions"),
  createInstitution: (body: T.CreateInstitutionRequest) => post<T.Institution>("/institutions", body),
  institutionAccounts: () => get<T.InstitutionAccount[]>("/institution-accounts"),
  setDefaultTariffDomain: (institutionId: string, body: T.SetDefaultTariffDomainRequest) =>
    put<T.Institution>(`/institutions/${seg(institutionId)}/default-tariff-domain`, body),

  // Tariffs
  tariffDomains: () => get<T.TariffDomain[]>("/tariffs/domains"),
  createTariffDomain: (body: T.CreateTariffDomainRequest) => post<T.TariffDomain>("/tariffs/domains", body),
  tariffTypes: () => get<T.TariffType[]>("/tariffs/types"),
  tariffValues: () => get<T.TariffValue[]>("/tariffs/values"),
  createTariffType: (body: T.CreateTariffTypeRequest) => post<T.TariffType>("/tariffs/types", body),
  createTariffValue: (body: T.CreateTariffValueRequest) => post<T.TariffValue>("/tariffs/values", body),
  resolveTariff: (contractId: string, type: string, date?: string) => get<T.ResolvedTariff>(`/tariffs/resolve${qs({ contractId, type, date })}`),

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
  adminConfig: () => tokApi.get<T.ConfigResponse>("/admin/config"),
  updateAdminConfig: (body: T.ConfigUpdateRequest) => tokApi.put<T.ConfigResponse>("/admin/config", body),
};
