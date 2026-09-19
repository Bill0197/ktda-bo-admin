/* GENERATED — DO NOT EDIT BY HAND.
 * Source: http://localhost:8086/v3/api-docs
 * Regenerate: npm run gen:types
 *
 * 138 schemas, 155 operations across 25 controllers.
 *
 * Two things the spec does not say, both learned from the Java side:
 *  - BigDecimal serialises as a JSON *number*. Format it for display with
 *    Intl.NumberFormat; never do arithmetic on it in the client.
 *  - Instants are ISO-8601 UTC; `date` fields are plain calendar dates with
 *    no zone, so do NOT put them through `new Date()` and render locally —
 *    that shifts them a day for anyone west of UTC.
 */

export interface Account {
  contractId?: string;
  productId?: string;
  currency?: string;
  status?: string;
}

export interface AccountTemplate {
  /** UUID */
  templateId?: string;
  schemeId?: string;
  accountRole?: "PRINCIPAL" | "ACCRUED_INTEREST" | "TAX_WITHHELD" | "SETTLEMENT_CASH" | "BANK_CASH" | "UNALLOCATED" | "FEE_INCOME" | "LIQUIDITY_EXPENSE" | "INVESTOR_EXPENSE" | "REALIZED_GAIN_LOSS" | "LOAN_PRINCIPAL" | "LOAN_INTEREST_RECEIVABLE" | "INTEREST_INCOME" | "PENALTY_INCOME";
  accountCode?: string;
  scope?: "PER_CONTRACT" | "PER_INSTITUTION";
  availableBalance?: boolean;
}

export interface AccountView {
  contractId?: string;
  investorRef?: string;
  productId?: string;
  currency?: string;
  status?: string;
  /** ISO date (YYYY-MM-DD) */
  openedAt?: string;
  glAccounts?: GlAccountView[];
}

export interface AccountingScheme {
  schemeId?: string;
  /** UUID */
  institutionId?: string;
  name?: string;
  parentSchemeId?: string;
}

export interface AccrualEntry {
  /** UUID */
  entryId?: string;
  /** UUID */
  runId?: string;
  contractId?: string;
  tariffTypeId?: string;
  tariffDomainId?: string;
  currency?: string;
  closingBalance?: number;
  averageBalance?: number;
  annualRate?: number;
  dayCount?: string;
  dayCountBasis?: number;
  periodDays?: number;
  accruedAmount?: number;
  /** ISO date (YYYY-MM-DD) */
  valueDated?: string;
  /** UUID */
  journalId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface AccrualPolicyResponse {
  /** UUID */
  policyId?: string;
  scope?: "OFFERING" | "PRODUCT" | "GLOBAL";
  scopeRef?: string;
  method?: "SIMPLE_DAILY";
  rateSource?: "TARIFF" | "FIXED";
  fixedRate?: number;
  dayCount?: "ACTUAL_365" | "ACTUAL_360" | "THIRTY_360";
  currency?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
  active?: boolean;
  cron?: string;
  zone?: string;
  scheduleEnabled?: boolean;
  /** ISO-8601 instant */
  lastRunAt?: string;
  lastStatus?: string;
  /** ISO date (YYYY-MM-DD) */
  lastAccruedTo?: string;
  /** ISO-8601 instant */
  nextRunAt?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface AccrualRun {
  /** UUID */
  runId?: string;
  /** ISO date (YYYY-MM-DD) */
  periodStart?: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  contractCount?: number;
  failureCount?: number;
  totalAccrued?: number;
  /** ISO-8601 instant */
  startedAt?: string;
  /** ISO-8601 instant */
  completedAt?: string;
  message?: string;
}

export interface AccrualRunRequest {
  /** ISO date (YYYY-MM-DD) */
  periodStart: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
}

export interface AccrualRunSummary {
  /** UUID */
  runId?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  /** ISO date (YYYY-MM-DD) */
  periodStart?: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  contractCount?: number;
  failureCount?: number;
  totalAccrued?: number;
  message?: string;
}

export interface AccrueRequest {
  days: number;
  /** ISO date (YYYY-MM-DD) */
  asOf?: string;
}

export interface ActiveSessionResponse {
  email?: string;
  sessionCount?: number;
  /** ISO-8601 instant */
  lastRequest?: string;
}

export interface AddRungRequest {
  ladderSlot: number;
  isin?: string;
  tenorYears: number;
  couponRate: number;
  couponMonths: string;
  faceValueHeld: number;
  /** ISO date (YYYY-MM-DD) */
  acquisitionDate?: string;
  /** ISO date (YYYY-MM-DD) */
  maturityDate?: string;
}

export interface AdminUserResponse {
  /** UUID */
  id?: string;
  email?: string;
  fullName?: string;
  status?: string;
  roles?: string[];
  root?: boolean;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface AmountRequest {
  amount: number;
}

export interface AssetBackingRow {
  /** UUID */
  assetId?: string;
  name?: string;
  assetClass?: "BOND" | "EQUITY" | "FX" | "DERIVATIVE" | "MONEY_MARKET" | "INDEX" | "BALANCED" | "LOAN";
  status?: "DRAFT" | "APPROVED" | "OFFERED" | "RETIRED";
  currency?: string;
  valuation?: number;
  appreciationRate?: number;
  claims?: number;
  headroom?: number;
  utilization?: number;
  overSubscribed?: boolean;
  rungs?: Rung[];
}

export interface AssetResponse {
  /** UUID */
  assetId?: string;
  name?: string;
  assetClass?: "BOND" | "EQUITY" | "FX" | "DERIVATIVE" | "MONEY_MARKET" | "INDEX" | "BALANCED" | "LOAN";
  description?: string;
  currency?: string;
  appreciationRate?: number;
  valuationAmount?: number;
  status?: "DRAFT" | "APPROVED" | "OFFERED" | "RETIRED";
  /** ISO-8601 instant */
  createdAt?: string;
  /** ISO-8601 instant */
  updatedAt?: string;
}

export interface AssignClassifierRequest {
  valueId: string;
  /** ISO date (YYYY-MM-DD) */
  dateFrom?: string;
}

export interface AssignProductCouponTariffRequest {
  productId: string;
  tariffId: string;
}

export interface AssignSubFundRequest {
  /** UUID */
  subFundId?: string;
}

export interface BondLadderRung {
  /** UUID */
  bondId?: string;
  /** UUID */
  subFundId?: string;
  ladderSlot?: number;
  isin?: string;
  tenorYears?: number;
  couponRate?: number;
  couponMonths?: string;
  faceValueHeld?: number;
  /** ISO date (YYYY-MM-DD) */
  acquisitionDate?: string;
  /** ISO date (YYYY-MM-DD) */
  maturityDate?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface BondLadderView {
  /** UUID */
  subFundId?: string;
  subFundName?: string;
  currency?: string;
  blendedCoupon?: number;
  capacity?: number;
  claims?: number;
  headroom?: number;
  utilization?: number;
  everyMonthCovered?: boolean;
  couponMonths?: number[];
  rungs?: Rung[];
}

export interface CashLine {
  accountCode?: string;
  accountName?: string;
  balance?: number;
  owedToInvestor?: boolean;
  currency?: string;
}

export interface ChartOfAccount {
  accountCode?: string;
  accountName?: string;
  accountType?: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  normalBalance?: "DEBIT" | "CREDIT";
  sortOrder?: number;
}

export interface Classifier {
  typeId?: string;
  code?: string;
  name?: string;
  ok?: boolean;
  /** ISO date (YYYY-MM-DD) */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  dateTo?: string;
  current?: boolean;
}

export interface ClassifierType {
  classifierTypeId?: string;
  name?: string;
  appliesTo?: "INVESTOR" | "CONTRACT";
}

export interface ClassifierValue {
  valueId?: string;
  classifierTypeId?: string;
  code?: string;
  name?: string;
  ok?: boolean;
  sortOrder?: number;
}

export interface ClientCategory {
  clientCategoryId?: string;
  categoryName?: string;
}

export interface ComplianceReviewItem {
  /** UUID */
  queueId?: string;
  /** UUID */
  investorId?: string;
  reason?: string;
  status?: "OPEN" | "CLEARED" | "REJECTED";
  assignedTo?: string;
  /** ISO-8601 instant */
  openedAt?: string;
  /** ISO-8601 instant */
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ConfigResponse {
  maxConcurrentSessions?: number;
}

export interface ConfigUpdateRequest {
  maxConcurrentSessions?: number;
}

export interface ConfirmSubscriptionRequest {
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
}

export interface ContractSubtype {
  contractSubtypeId?: string;
  subtypeName?: string;
}

export interface CreateAccountTemplateRequest {
  schemeId: string;
  accountRole: "PRINCIPAL" | "ACCRUED_INTEREST" | "TAX_WITHHELD" | "SETTLEMENT_CASH" | "BANK_CASH" | "UNALLOCATED" | "FEE_INCOME" | "LIQUIDITY_EXPENSE" | "INVESTOR_EXPENSE" | "REALIZED_GAIN_LOSS" | "LOAN_PRINCIPAL" | "LOAN_INTEREST_RECEIVABLE" | "INTEREST_INCOME" | "PENALTY_INCOME";
  accountCode?: string;
  scope?: "PER_CONTRACT" | "PER_INSTITUTION";
  availableBalance?: boolean;
}

export interface CreateAccrualPolicyRequest {
  scope: "OFFERING" | "PRODUCT" | "GLOBAL";
  scopeRef?: string;
  method?: "SIMPLE_DAILY";
  rateSource?: "TARIFF" | "FIXED";
  fixedRate?: number;
  dayCount?: "ACTUAL_365" | "ACTUAL_360" | "THIRTY_360";
  currency?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
  cron?: string;
  zone?: string;
  scheduleEnabled?: boolean;
}

export interface CreateClientCategoryRequest {
  clientCategoryId: string;
  categoryName: string;
}

export interface CreateContractSubtypeRequest {
  contractSubtypeId: string;
  subtypeName: string;
}

export interface CreateDateSchemeRequest {
  dateSchemeId: string;
  schemeName: string;
  distributionFrequency?: string;
  valuationFrequency?: string;
}

export interface CreateDistributionPolicyRequest {
  scope: "OFFERING" | "PRODUCT" | "GLOBAL";
  scopeRef?: string;
  mode: "INCOME" | "GROWTH";
  whtRate?: number;
  currency?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
}

export interface CreateFundRequest {
  /** UUID */
  institutionId: string;
  name: string;
  registrationRef?: string;
}

export interface CreateInstitutionRequest {
  name: string;
  localCurrency: string;
  country: string;
  additionalCurrencies?: string[];
}

export interface CreateLifecycleEventRequest {
  eventId: string;
  productId: string;
  triggerPoint: string;
  actionRef: string;
  description?: string;
}

export interface CreateOfferingRequest {
  /** UUID */
  assetId: string;
  productId: string;
  pricePerUnit: number;
  totalUnits: number;
  minUnits?: number;
  maxUnits?: number;
}

export interface CreatePackageRequest {
  packageId: string;
  name: string;
  /** UUID */
  institutionId: string;
  packageType: "PRODUCT" | "ADDITIONAL";
  distributionFrequency?: string;
  tariffDomainId?: string;
  parentPackageId?: string;
}

export interface CreateProductCategoryRequest {
  productCategoryId: string;
  categoryName: string;
}

export interface CreateProductGroupRequest {
  productGroupId: string;
  groupName: string;
}

export interface CreateProductLimitRequest {
  productId: string;
  limitType: string;
  minValue?: number;
  maxValue?: number;
  currency?: string;
}

export interface CreateProductRequest {
  productId: string;
  name: string;
  currency: string;
  assetClass: "BOND" | "EQUITY" | "FX" | "DERIVATIVE" | "MONEY_MARKET" | "INDEX" | "BALANCED" | "LOAN";
  structureType: "POOLED_UNITIZED" | "DISCRETIONARY_MANDATE";
  schemeId: string;
  packageId: string;
  tariffDomainId?: string;
  parentProductId?: string;
  distributionType?: "INCOME" | "GROWTH";
  /** UUID */
  subFundId?: string;
  productGroupId?: string;
  productCategoryId?: string;
  clientCategoryId?: string;
  clientCategories?: string[];
  contractSubtypeId?: string;
  dateSchemeId?: string;
  reportTypeId?: string;
  baseProductId?: string;
  /** ISO date (YYYY-MM-DD) */
  activeFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  activeTo?: string;
  tags?: string[];
}

export interface CreateReportTypeRequest {
  reportTypeId: string;
  reportName: string;
  templateRef?: string;
}

export interface CreateScheduleRequest {
  jobType: "ACCRUAL" | "DISTRIBUTION" | "FEE" | "TAX_REMITTANCE" | "NAV";
  cron: string;
  zone?: string;
  enabled?: boolean;
  description?: string;
}

export interface CreateSchemeRequest {
  schemeId: string;
  name: string;
  /** UUID */
  institutionId: string;
  parentSchemeId?: string;
  templates?: TemplateSpec[];
}

export interface CreateServicePackageItemRequest {
  itemId: string;
  servicePackageId: string;
  itemRole: string;
  feeDirection?: string;
  feeCurrency?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  noticeDays?: number;
  transactionTypeId?: string;
  feeTypeId?: string;
  tariffId?: string;
  isAllowed?: boolean;
  priority?: number;
  valueDays?: number;
  fxBehavior?: string;
  maxOccurrencesPerPeriod?: number;
  periodDays?: number;
  lockInDays?: number;
  lockInWaivable?: boolean;
  forfeitsReturnsIfEarly?: boolean;
}

export interface CreateSubFundRequest {
  /** UUID */
  fundId: string;
  name: string;
  baseCurrency: string;
  /** UUID */
  assetId?: string;
  appreciationRate?: number;
  /** ISO date (YYYY-MM-DD) */
  inceptionDate?: string;
  minInvestmentAmount?: number;
  lockUpDays?: number;
  exitFeeRate?: number;
  gatePct?: number;
  facilitySize?: number;
}

export interface CreateTariffDomainRequest {
  tariffDomainId: string;
  name: string;
  /** UUID */
  institutionId: string;
  domainCategory?: string;
  parentDomainId?: string;
}

export interface CreateTariffTypeRequest {
  tariffTypeId: string;
  name: string;
  valueKind?: "PERCENTAGE";
}

export interface CreateTariffValueRequest {
  tariffTypeId: string;
  tariffDomainId: string;
  currency: string;
  rate: number;
  dayCount?: "ACTUAL_365" | "ACTUAL_360" | "THIRTY_360";
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
}

export interface CreateTradeRequest {
  /** UUID */
  sellerInvestorId: string;
  /** UUID */
  buyerInvestorId: string;
  quantity: number;
  pricePerUnit: number;
}

export interface DateScheme {
  dateSchemeId?: string;
  schemeName?: string;
  distributionFrequency?: string;
  valuationFrequency?: string;
}

export interface DistributionEntry {
  /** UUID */
  entryId?: string;
  /** UUID */
  runId?: string;
  contractId?: string;
  distributionType?: "INCOME" | "GROWTH";
  grossAccrued?: number;
  taxWithheld?: number;
  netDistributed?: number;
  /** ISO date (YYYY-MM-DD) */
  valueDated?: string;
  /** UUID */
  taxJournalId?: string;
  /** UUID */
  distributionJournalId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface DistributionPolicyResponse {
  /** UUID */
  policyId?: string;
  scope?: "OFFERING" | "PRODUCT" | "GLOBAL";
  scopeRef?: string;
  mode?: "INCOME" | "GROWTH";
  whtRate?: number;
  currency?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
  active?: boolean;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface DistributionRun {
  /** UUID */
  runId?: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  contractCount?: number;
  failureCount?: number;
  totalDistributed?: number;
  totalTax?: number;
  /** ISO-8601 instant */
  startedAt?: string;
  /** ISO-8601 instant */
  completedAt?: string;
  message?: string;
}

export interface DistributionRunRequest {
  /** ISO date (YYYY-MM-DD) */
  periodEnd: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
}

export interface DistributionRunSummary {
  /** UUID */
  runId?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  contractCount?: number;
  failureCount?: number;
  totalDistributed?: number;
  totalTax?: number;
  message?: string;
}

export interface FeeEntry {
  /** UUID */
  entryId?: string;
  /** UUID */
  runId?: string;
  contractId?: string;
  basisBalance?: number;
  annualRate?: number;
  dayCountBasis?: number;
  periodDays?: number;
  feeAmount?: number;
  /** ISO date (YYYY-MM-DD) */
  valueDated?: string;
  /** UUID */
  journalId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface FeeRun {
  /** UUID */
  runId?: string;
  /** ISO date (YYYY-MM-DD) */
  periodStart?: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  contractCount?: number;
  failureCount?: number;
  totalFee?: number;
  /** ISO-8601 instant */
  startedAt?: string;
  /** ISO-8601 instant */
  completedAt?: string;
  message?: string;
}

export interface FeeRunRequest {
  /** ISO date (YYYY-MM-DD) */
  periodStart: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
}

export interface FeeRunSummary {
  /** UUID */
  runId?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  /** ISO date (YYYY-MM-DD) */
  periodStart?: string;
  /** ISO date (YYYY-MM-DD) */
  periodEnd?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  contractCount?: number;
  failureCount?: number;
  totalFee?: number;
  message?: string;
}

export interface FeeType {
  feeTypeId?: string;
  code?: string;
  tariffTypeId?: string;
}

export interface FundResponse {
  /** UUID */
  fundId?: string;
  /** UUID */
  institutionId?: string;
  name?: string;
  registrationRef?: string;
  status?: string;
}

export interface GlAccountView {
  glAccountId?: string;
  accountCode?: string;
  balance?: number;
}

export interface GlBalanceRow {
  glAccountId?: string;
  accountCode?: string;
  accountName?: string;
  accountType?: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  normalBalance?: "DEBIT" | "CREDIT";
  ownerType?: string;
  ownerId?: string;
  ownerLabel?: string;
  currency?: string;
  totalDebit?: number;
  totalCredit?: number;
  balance?: number;
}

export interface HoldingResponse {
  /** UUID */
  holdingId?: string;
  offeringId?: string;
  /** UUID */
  assetId?: string;
  /** UUID */
  investorId?: string;
  quantity?: number;
  /** ISO-8601 instant */
  updatedAt?: string;
}

export interface Institution {
  /** UUID */
  institutionId?: string;
  name?: string;
  localCurrency?: string;
  country?: string;
  defaultTariffDomainId?: string;
}

export interface InstitutionAccount {
  institutionAccountId?: string;
  /** UUID */
  institutionId?: string;
  currency?: string;
  purpose?: "BANK_CASH" | "UNALLOCATED" | "FEE_INCOME" | "LIQUIDITY_EXPENSE" | "INVESTOR_EXPENSE" | "REALIZED_GAIN_LOSS" | "INTEREST_INCOME" | "PENALTY_INCOME";
}

export interface Investor {
  /** UUID */
  investorId?: string;
  /** UUID */
  institutionId?: string;
  externalRef?: string;
  displayName?: string;
  investorCategory?: "INDIVIDUAL" | "INSTITUTIONAL";
  lifecycleStatus?: "PROSPECT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  /** UUID */
  referredByIfaId?: string;
  /** ISO-8601 instant */
  onboardedAt?: string;
}

export interface InvestorBalancesView {
  /** UUID */
  investorId?: string;
  externalRef?: string;
  displayName?: string;
  units?: UnitLine[];
  totalUnitValue?: number;
  ledgerCash?: CashLine[];
  netLedgerCash?: number;
  walletCash?: WalletLine[];
  walletReachable?: boolean;
}

export interface InvestorContract {
  contractId?: string;
  /** UUID */
  institutionId?: string;
  investorRef?: string;
  currency?: string;
  contractStatus?: string;
  /** ISO date (YYYY-MM-DD) */
  openedAt?: string;
  productId?: string;
  /** UUID */
  investorId?: string;
}

export interface InvestorView {
  /** UUID */
  investorId?: string;
  externalRef?: string;
  displayName?: string;
  category?: "INDIVIDUAL" | "INSTITUTIONAL";
  lifecycleStatus?: "PROSPECT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  /** UUID */
  referredByIfaId?: string;
  blocked?: boolean;
  classifiers?: Classifier[];
  lifecycle?: LifecycleEvent[];
  openReviews?: Review[];
  accounts?: Account[];
}

export interface LedgerEntryView {
  /** UUID */
  journalId?: string;
  eventType?: string;
  currency?: string;
  status?: "INITIATED" | "PENDING_APPROVAL" | "POSTED";
  description?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  /** ISO-8601 instant */
  occurredAt?: string;
  /** ISO-8601 instant */
  postedAt?: string;
  referenceTxId?: string;
  contractId?: string;
  productId?: string;
  offeringId?: string;
  amount?: number;
  lines?: Line[];
}

export interface LifecycleEvent {
  fromStatus?: "PROSPECT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  toStatus?: "PROSPECT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  triggeredBy?: string;
  reason?: string;
  /** ISO-8601 instant */
  occurredAt?: string;
}

export interface Line {
  accountCode?: string;
  accountName?: string;
  glAccountId?: string;
  side?: string;
  amount?: number;
  contractId?: string;
  productId?: string;
}

export interface LinkTokenClassRequest {
  tokenClassId?: string;
}

export interface LoanView {
  contractId?: string;
  currency?: string;
  status?: string;
  outstandingPrincipal?: number;
  outstandingInterest?: number;
  totalOutstanding?: number;
}

export interface LoginAuditResponse {
  /** UUID */
  id?: string;
  email?: string;
  event?: string;
  detail?: string;
  ipAddress?: string;
  userAgent?: string;
  /** ISO-8601 instant */
  occurredAt?: string;
}

export interface MeResponse {
  email?: string;
  fullName?: string;
  roles?: string[];
  admin?: boolean;
}

export interface NavRunSummary {
  /** UUID */
  runId?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  /** ISO date (YYYY-MM-DD) */
  asOf?: string;
  productCount?: number;
  failureCount?: number;
  message?: string;
}

export interface NavSnapshotView {
  /** UUID */
  navId?: string;
  productId?: string;
  /** UUID */
  subFundId?: string;
  /** ISO date (YYYY-MM-DD) */
  asOf?: string;
  basePrice?: number;
  appreciationFactor?: number;
  unitsOutstanding?: number;
  navPerUnit?: number;
  netAssets?: number;
  status?: string;
}

export interface NavView {
  productId?: string;
  navPerUnit?: number;
}

export interface NoteRequest {
  note?: string;
}

export interface OfferingResponse {
  offeringId?: string;
  /** UUID */
  assetId?: string;
  productId?: string;
  pricePerUnit?: number;
  totalUnits?: number;
  reservedUnits?: number;
  outstandingUnits?: number;
  remainingUnits?: number;
  minUnits?: number;
  maxUnits?: number;
  currency?: string;
  status?: "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
  tokenClassId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface OnboardInvestorRequest {
  externalRef: string;
  displayName: string;
  investorCategory: "INDIVIDUAL" | "INSTITUTIONAL";
  riskTier: string;
  kycStatus: string;
  jurisdiction: string;
  /** UUID */
  referredByIfaId?: string;
}

export interface OnboardResult {
  /** UUID */
  investorId?: string;
  externalRef?: string;
  lifecycleStatus?: "PROSPECT" | "UNDER_REVIEW" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";
  autoCleared?: boolean;
  /** UUID */
  reviewQueueId?: string;
}

export interface OpenAccountRequest {
  contractId?: string;
  /** UUID */
  investorId: string;
  productId: string;
}

export interface OpenAccountResult {
  contractId?: string;
  investorRef?: string;
  productId?: string;
  currency?: string;
  createdGlAccounts?: string[];
}

export interface PostEventRequest {
  eventType: "SUBSCRIPTION" | "ACCRUAL" | "DISTRIBUTION_INCOME" | "DISTRIBUTION_GROWTH" | "TAX_WITHHELD_EVENT" | "MANAGEMENT_FEE" | "REDEMPTION" | "REDEMPTION_GAIN" | "REDEMPTION_LOSS" | "TAX_REMITTANCE" | "WITHDRAWAL" | "INTEREST_WITHDRAWAL" | "DISBURSEMENT" | "LOAN_INTEREST_ACCRUAL" | "PRINCIPAL_REPAYMENT" | "INTEREST_REPAYMENT";
  contractId: string;
  amount: number;
  referenceTxId?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  description?: string;
  idempotencyKey?: string;
}

export interface PostingReceipt {
  /** UUID */
  journalId?: string;
  status?: "INITIATED" | "PENDING_APPROVAL" | "POSTED";
  duplicate?: boolean;
}

export interface Product {
  productId?: string;
  /** UUID */
  institutionId?: string;
  name?: string;
  currency?: string;
  assetClass?: "BOND" | "EQUITY" | "FX" | "DERIVATIVE" | "MONEY_MARKET" | "INDEX" | "BALANCED" | "LOAN";
  structureType?: "POOLED_UNITIZED" | "DISCRETIONARY_MANDATE";
  schemeId?: string;
  packageId?: string;
  tariffDomainId?: string;
  parentProductId?: string;
  distributionType?: "INCOME" | "GROWTH";
  tokenClassId?: string;
  /** UUID */
  subFundId?: string;
  status?: "ACTIVE" | "INACTIVE";
  productGroupId?: string;
  productCategoryId?: string;
  clientCategoryId?: string;
  contractSubtypeId?: string;
  dateSchemeId?: string;
  reportTypeId?: string;
  baseProductId?: string;
  /** ISO date (YYYY-MM-DD) */
  activeFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  activeTo?: string;
  tags?: string;
  active?: boolean;
}

export interface ProductCategory {
  productCategoryId?: string;
  categoryName?: string;
}

export interface ProductCouponTariff {
  productId?: string;
  /** UUID */
  tariffId?: string;
}

export interface ProductGroup {
  productGroupId?: string;
  groupName?: string;
  /** UUID */
  institutionId?: string;
}

export interface ProductLifecycleEvent {
  eventId?: string;
  productId?: string;
  triggerPoint?: string;
  actionRef?: string;
  description?: string;
}

export interface ProductLimit {
  /** UUID */
  limitId?: string;
  productId?: string;
  limitType?: string;
  minValue?: number;
  maxValue?: number;
  currency?: string;
}

export interface ReconciliationResult {
  productId?: string;
  tokenClassId?: string;
  contractCount?: number;
  unitsOutstanding?: number;
  pricePerUnit?: number;
  unitLedgerValue?: number;
  glPrincipal?: number;
  difference?: number;
  matched?: boolean;
  note?: string;
}

export interface RedeemRequest {
  /** UUID */
  investorId: string;
  quantity: number;
}

export interface RedemptionResponse {
  /** UUID */
  redemptionId?: string;
  offeringId?: string;
  /** UUID */
  investorId?: string;
  quantity?: number;
  amount?: number;
  currency?: string;
  contractId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface RegisterAssetRequest {
  name: string;
  assetClass: "BOND" | "EQUITY" | "FX" | "DERIVATIVE" | "MONEY_MARKET" | "INDEX" | "BALANCED" | "LOAN";
  description?: string;
  currency: string;
  appreciationRate?: number;
  valuationAmount?: number;
}

export interface RepayResult {
  interestPaid?: number;
  principalPaid?: number;
  loan?: LoanView;
}

export interface ReportType {
  reportTypeId?: string;
  reportName?: string;
  templateRef?: string;
}

export interface ResolvedTariff {
  tariffTypeId?: string;
  tariffDomainId?: string;
  currency?: string;
  rate?: number;
  dayCount?: "ACTUAL_365" | "ACTUAL_360" | "THIRTY_360";
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
}

export interface Review {
  /** UUID */
  queueId?: string;
  reason?: string;
  status?: string;
  /** ISO-8601 instant */
  openedAt?: string;
}

export interface Rung {
  ladderSlot?: number;
  isin?: string;
  tenorYears?: number;
  couponRate?: number;
  couponMonths?: string;
  faceValueHeld?: number;
  /** ISO date (YYYY-MM-DD) */
  maturityDate?: string;
}

export interface ScheduleResponse {
  /** UUID */
  scheduleId?: string;
  jobType?: "ACCRUAL" | "DISTRIBUTION" | "FEE" | "TAX_REMITTANCE" | "NAV";
  cron?: string;
  zone?: string;
  enabled?: boolean;
  description?: string;
  /** ISO-8601 instant */
  lastRunAt?: string;
  lastStatus?: string;
  /** ISO-8601 instant */
  nextRunAt?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface ServicePackage {
  packageId?: string;
  /** UUID */
  institutionId?: string;
  name?: string;
  packageType?: "PRODUCT" | "ADDITIONAL";
  distributionFrequency?: string;
  tariffDomainId?: string;
  parentPackageId?: string;
}

export interface ServicePackageItem {
  itemId?: string;
  packageId?: string;
  itemRole?: string;
  feeDirection?: string;
  feeCurrency?: string;
  thresholdMin?: number;
  thresholdMax?: number;
  noticeDays?: number;
  transactionTypeId?: string;
  feeTypeId?: string;
  /** UUID */
  tariffId?: string;
  allowed?: boolean;
  priority?: number;
  valueDays?: number;
  fxBehavior?: string;
  maxOccurrencesPerPeriod?: number;
  periodDays?: number;
  lockInDays?: number;
  lockInWaivable?: boolean;
  forfeitsReturnsIfEarly?: boolean;
}

export interface SetAccrualScheduleRequest {
  cron: string;
  zone?: string;
  enabled?: boolean;
}

export interface SetDefaultTariffDomainRequest {
  tariffDomainId: string;
}

export interface SignupRequest {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  role: "ADMIN" | "DEVELOPER" | "ACCOUNTANT" | "DEVOPS";
}

export interface SubFundResponse {
  /** UUID */
  subFundId?: string;
  /** UUID */
  fundId?: string;
  name?: string;
  baseCurrency?: string;
  /** UUID */
  assetId?: string;
  appreciationRate?: number;
  /** ISO date (YYYY-MM-DD) */
  inceptionDate?: string;
  minInvestmentAmount?: number;
  lockUpDays?: number;
  exitFeeRate?: number;
  gatePct?: number;
  facilitySize?: number;
  status?: string;
}

export interface SubscribeRequest {
  /** UUID */
  investorId: string;
  quantity: number;
}

export interface SubscriptionResponse {
  /** UUID */
  subscriptionId?: string;
  offeringId?: string;
  /** UUID */
  investorId?: string;
  quantity?: number;
  amount?: number;
  currency?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  contractId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
  /** ISO-8601 instant */
  confirmedAt?: string;
}

export interface TariffDomain {
  tariffDomainId?: string;
  /** UUID */
  institutionId?: string;
  name?: string;
  domainCategory?: string;
  parentDomainId?: string;
}

export interface TariffType {
  tariffTypeId?: string;
  name?: string;
  valueKind?: "PERCENTAGE";
}

export interface TariffValue {
  /** UUID */
  tariffValueId?: string;
  tariffTypeId?: string;
  tariffDomainId?: string;
  currency?: string;
  rate?: number;
  dayCount?: "ACTUAL_365" | "ACTUAL_360" | "THIRTY_360";
  /** ISO date (YYYY-MM-DD) */
  effectiveFrom?: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveTo?: string;
  approved?: boolean;
}

export interface TaxRemittanceEntry {
  /** UUID */
  entryId?: string;
  /** UUID */
  runId?: string;
  contractId?: string;
  amountRemitted?: number;
  /** ISO date (YYYY-MM-DD) */
  valueDated?: string;
  /** UUID */
  journalId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface TaxRemittanceRun {
  /** UUID */
  runId?: string;
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  contractCount?: number;
  failureCount?: number;
  totalRemitted?: number;
  /** ISO-8601 instant */
  startedAt?: string;
  /** ISO-8601 instant */
  completedAt?: string;
  message?: string;
}

export interface TaxRemittanceRunRequest {
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
}

export interface TaxRemittanceRunSummary {
  /** UUID */
  runId?: string;
  status?: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  /** ISO date (YYYY-MM-DD) */
  valueDate?: string;
  contractCount?: number;
  failureCount?: number;
  totalRemitted?: number;
  message?: string;
}

export interface TemplateSpec {
  accountRole: "PRINCIPAL" | "ACCRUED_INTEREST" | "TAX_WITHHELD" | "SETTLEMENT_CASH" | "BANK_CASH" | "UNALLOCATED" | "FEE_INCOME" | "LIQUIDITY_EXPENSE" | "INVESTOR_EXPENSE" | "REALIZED_GAIN_LOSS" | "LOAN_PRINCIPAL" | "LOAN_INTEREST_RECEIVABLE" | "INTEREST_INCOME" | "PENALTY_INCOME";
  accountCode?: string;
  scope?: "PER_CONTRACT" | "PER_INSTITUTION";
  availableBalance?: boolean;
}

export interface TokenClassRef {
  tokenClassId?: string;
  name?: string;
  symbol?: string;
  parValue?: number;
  currency?: string;
  status?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface TradeResponse {
  /** UUID */
  tradeId?: string;
  offeringId?: string;
  /** UUID */
  sellerInvestorId?: string;
  /** UUID */
  buyerInvestorId?: string;
  quantity?: number;
  pricePerUnit?: number;
  parValue?: number;
  consideration?: number;
  premium?: number;
  currency?: string;
  sellerContractId?: string;
  buyerContractId?: string;
  /** UUID */
  journalId?: string;
  /** ISO-8601 instant */
  createdAt?: string;
}

export interface TransactionType {
  transactionTypeId?: string;
  code?: string;
}

export interface TrialBalanceLine {
  glAccountId?: string;
  accountCode?: string;
  accountName?: string;
  currency?: string;
  totalDebit?: number;
  totalCredit?: number;
  balance?: number;
}

export interface UnitHoldingRow {
  /** UUID */
  investorId?: string;
  investorRef?: string;
  offeringId?: string;
  productId?: string;
  tokenClassId?: string;
  source?: string;
  quantity?: number;
  pricePerUnit?: number;
  value?: number;
  currency?: string;
}

export interface UnitLedgerActivityView {
  /** ISO-8601 instant */
  occurredAt?: string;
  action?: string;
  reference?: string;
  tokenClassId?: string;
  investorRef?: string;
  counterpartyRef?: string;
  quantity?: number;
  currency?: string;
}

export interface UnitLine {
  offeringId?: string;
  productId?: string;
  tokenClassId?: string;
  source?: string;
  quantity?: number;
  pricePerUnit?: number;
  value?: number;
  currency?: string;
}

export interface UnitMovementView {
  /** ISO-8601 instant */
  occurredAt?: string;
  type?: string;
  offeringId?: string;
  quantity?: number;
  pricePerUnit?: number;
  counterpartyRef?: string;
  currency?: string;
}

export interface WalletLine {
  currency?: string;
  available?: number;
}

export interface WithdrawRequest {
  amount?: number;
}

export interface WithdrawalView {
  contractId?: string;
  settlementCash?: number;
  accruedInterest?: number;
  total?: number;
}
