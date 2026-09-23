/* Demo switch for everything BO Admin would get from CORE API.

   CORE API (apps/core-api) is not deployed, so by default every CORE-backed
   function resolves to its in-browser demo implementation in src/mock/api.ts:
   seeded from src/mock/fixtures, writes change that in-memory state, and a
   full page reload starts over. Building with VITE_CORE_API_BASE set flips
   every one of them back to the real CORE client — no page changes.

   Each export is typed as the real client function, so a demo implementation
   whose signature drifts from CORE's fails the build instead of a page.

   A few CORE functions have no page calling them and no demo implementation;
   they reject with a clear message instead of reaching for a CORE that isn't
   there. Tokenization-backed data never comes through here — see
   api.tokenConsole.ts and api.live.ts.

   Generated from the api.<domain>.ts exports; keep it in step with them. */

import * as admin from "./api.admin";
import * as compliance from "./api.compliance";
import * as crm from "./api.crm";
import * as institutional from "./api.institutional";
import * as investment from "./api.investment";
import * as ledger from "./api.ledger";
import * as tokconduct from "./api.tokconduct";
import * as demo from "../mock/api";
import { JOURNAL_EVENT_LABELS } from "../mock";

const USE_CORE = Boolean(import.meta.env.VITE_CORE_API_BASE);

const pick = <F>(core: F, demoImpl: F): F => (USE_CORE ? core : demoImpl);

/** For demo functions whose parameters are stricter than CORE's: the mock
 * takes the acting user as a required argument (CORE reads it from the
 * session) or a narrower literal type. Every page call site passes those, so
 * only the result is checked against CORE's. */
const pickLoose = <F extends (...args: never) => unknown>(core: F, demoImpl: (...args: never) => ReturnType<F>): F =>
  USE_CORE ? core : (demoImpl as unknown as F);

/** No page calls these and the demo has no implementation for them. */
const notInDemo = (name: string) => async (..._args: unknown[]): Promise<never> => {
  throw new Error(`${name} needs CORE API, which this build is not connected to.`);
};


/* ---- Where the mock's shape and CORE's DTO differ, adapt the mock's ----
   The pages render CORE's shapes, so the demo answers in them. */

type Tariff = Awaited<ReturnType<typeof ledger.getTariffs>>[number];
type DemoTariff = Awaited<ReturnType<typeof demo.getTariffs>>[number];
type Journal = Awaited<ReturnType<typeof ledger.getJournalEntries>>[number];
type DemoJournal = Awaited<ReturnType<typeof demo.getJournalEntries>>[number];

const toTariff = (t: DemoTariff): Tariff => ({
  id: t.id, type: t.tariffTypeId, domainId: t.domainId, currency: t.currency, value: t.value,
  dayCount: t.dayCount ?? null, effectiveFrom: t.effectiveFrom, effectiveTo: t.effectiveTo, approved: t.approved,
  pendingApprovalId: t.pendingApprovalId ?? null, typeRole: t.typeRole, domainName: t.domainName,
  domainScope: t.domainScope, state: t.state, note: t.note,
});

const toJournal = (e: Omit<DemoJournal, "eventLabel" | "amount" | "balanced">): Journal => ({
  ...e,
  eventLabel: JOURNAL_EVENT_LABELS[e.eventType] ?? e.eventType,
  amount: e.lines.reduce((sum, l) => sum + l.debit, 0),
  balanced: Math.abs(e.lines.reduce((sum, l) => sum + l.debit - l.credit, 0)) < 0.005,
  status: e.status as Journal["status"],
  reversalOfId: e.reversalOfId ?? null,
  reversedById: e.reversedById ?? null,
  approvalId: e.approvalId ?? null,
});

const demoAdapted = {
  getClientComplianceDetail: async (id: string) => {
    const d = await demo.getClientComplianceDetail(id);
    return { ...d, wallet: d.wallet ?? undefined };
  },
  decideKycApplication: async (clientId: string, _decision?: string, actor = "System Admin") =>
    (await demo.decideKycApplication(clientId, "recapture", actor)).client,
  getJournalEntries: async (filter?: Parameters<typeof ledger.getJournalEntries>[0]) =>
    (await demo.getJournalEntries(filter as Parameters<typeof demo.getJournalEntries>[0])).map(toJournal),
  postCorrection: async (entryId: string, reason: string, actor = "System Admin") => toJournal(await demo.postCorrection(entryId, reason, actor)),
  getServicePackages: async () =>
    (await demo.getServicePackages()).map((p) => ({
      id: p.id, name: p.name, description: null, minSubscription: p.minSubscription, packageType: p.packageType,
      currency: p.currency, tariffDomainId: p.tariffDomainId, distributionFrequency: p.distributionFrequency,
      items: p.items.map((i) => ({
        id: i.id, label: i.label, note: i.note ?? null, transactionTypeLabel: i.transactionTypeLabel,
        feeTypeLabel: i.feeTypeLabel, tariff: i.tariff ? { id: i.tariff.id, value: i.tariff.value } : null,
      })),
    })),
  getTariffs: async () => (await demo.getTariffs()).map(toTariff),
  /** CORE answers with the staged rate; the mock with the approval it opened. */
  proposeTariffChange: async (...args: Parameters<typeof ledger.proposeTariffChange>) => {
    const approval = await demo.proposeTariffChange(...args);
    const staged = (await demo.getTariffs()).find((t) => t.pendingApprovalId === approval.id);
    if (!staged) throw new Error("The change was staged, but its rate could not be read back.");
    return toTariff(staged);
  },
};

export const getApprovalQueue = pick(admin.getApprovalQueue, demo.getApprovalQueue);
export const decideApproval = pickLoose(admin.decideApproval, demo.decideApproval);
export const getSystemUsers = pick(admin.getSystemUsers, demo.getSystemUsers);
export const getStaffDirectory = pick(admin.getStaffDirectory, demo.getStaffDirectory);
export const inviteSystemUser = pick(admin.inviteSystemUser, demo.inviteSystemUser);
export const setSystemUserStatus = pick(admin.setSystemUserStatus, demo.setSystemUserStatus);
export const updateSystemUserRole = pick(admin.updateSystemUserRole, demo.updateSystemUserRole);
export const getDepartments = pick(admin.getDepartments, demo.getDepartments);
export const getRolePermissionMatrix = pick(admin.getRolePermissionMatrix, demo.getRolePermissionMatrix);
export const setRolePageAccess = pick(admin.setRolePageAccess, demo.setRolePageAccess);
export const getPlatformSettings = pick(admin.getPlatformSettings, demo.getPlatformSettings);
export const proposeSettingChange = pick(admin.proposeSettingChange, demo.proposeSettingChange);
export const getFeatureFlags = pick(admin.getFeatureFlags, demo.getFeatureFlags);
export const setFeatureFlag = pick(admin.setFeatureFlag, demo.setFeatureFlag);
export const getAuditLog = pick(admin.getAuditLog, demo.getAuditLog);
export const verifyAuditChain = pick(admin.verifyAuditChain, demo.verifyAuditChain);
export const getIntegrations = pick(admin.getIntegrations, demo.getIntegrations);
export const setIntegrationEnvironment = pick(admin.setIntegrationEnvironment, demo.setIntegrationEnvironment);
export const getSystemJobs = pick(admin.getSystemJobs, demo.getSystemJobs);
export const setSystemJobEnabled = pick(admin.setSystemJobEnabled, demo.setSystemJobEnabled);
export const runSystemJob = pick(admin.runSystemJob, demo.runSystemJob);
export const getMaintenanceTargets = pick(admin.getMaintenanceTargets, demo.getMaintenanceTargets);
export const setMaintenanceMode = pick(admin.setMaintenanceMode, demo.setMaintenanceMode);
export const getReports = pick(admin.getReports, demo.getReports);
export const generateReport = pick(admin.generateReport, demo.generateReport);
export const getClients = pick(compliance.getClients, demo.getClients);
export const getClient = pick(compliance.getClient, notInDemo("getClient"));
export const setClientOwner = pickLoose(compliance.setClientOwner, demo.setClientOwner);
export const setClientSegment = pickLoose(compliance.setClientSegment, demo.setClientSegment);
export const setClientSuspended = pickLoose(compliance.setClientSuspended, demo.setClientSuspended);
export const getClientComplianceDetail = pick(compliance.getClientComplianceDetail, demoAdapted.getClientComplianceDetail);
export const getActivationBlockers = pick(compliance.getActivationBlockers, demo.getActivationBlockers);
export const getComplianceProfiles = pick(compliance.getComplianceProfiles, demo.getComplianceProfiles);
export const submitActivation = pickLoose(compliance.submitActivation, demo.submitActivation);
export const decideKycApplication = pick(compliance.decideKycApplication, demoAdapted.decideKycApplication);
export const completeEdd = pickLoose(compliance.completeEdd, demo.completeEdd);
export const markKycRefreshed = pickLoose(compliance.markKycRefreshed, demo.markKycRefreshed);
export const setDocumentStatus = pick(compliance.setDocumentStatus, demo.setDocumentStatus);
export const setUboStatus = pick(compliance.setUboStatus, demo.setUboStatus);
export const setRiskRating = pickLoose(compliance.setRiskRating, demo.setRiskRating);
export const getScreeningResults = pick(compliance.getScreeningResults, demo.getScreeningResults);
export const runScreening = pick(compliance.runScreening, demo.runScreening);
export const runEodScreening = pick(compliance.runEodScreening, demo.runEodScreening);
export const resolveScreeningMatch = pick(compliance.resolveScreeningMatch, demo.resolveScreeningMatch);
export const setWalletStatus = pickLoose(compliance.setWalletStatus, demo.setWalletStatus);
export const setWalletRestrictions = pickLoose(compliance.setWalletRestrictions, demo.setWalletRestrictions);
export const getRiskFactors = pick(compliance.getRiskFactors, demo.getRiskFactors);
export const addRiskFactor = pick(compliance.addRiskFactor, demo.addRiskFactor);
export const setRiskFactorEnabled = pickLoose(compliance.setRiskFactorEnabled, demo.setRiskFactorEnabled);
export const getComplianceCases = pick(compliance.getComplianceCases, demo.getComplianceCases);
export const getComplianceCase = pick(compliance.getComplianceCase, demo.getComplianceCase);
export const createCase = pick(compliance.createCase, demo.createCase);
export const addCaseNote = pickLoose(compliance.addCaseNote, demo.addCaseNote);
export const addCaseEvidence = pickLoose(compliance.addCaseEvidence, demo.addCaseEvidence);
export const assignCase = pick(compliance.assignCase, demo.assignCase);
export const setCaseStatus = pick(compliance.setCaseStatus, demo.setCaseStatus);
export const recordMlroDecision = pick(compliance.recordMlroDecision, demo.recordMlroDecision);
export const escalateToMlro = pick(compliance.escalateToMlro, demo.escalateToMlro);
export const closeCase = pickLoose(compliance.closeCase, demo.closeCase);
export const getAmlAlerts = pick(compliance.getAmlAlerts, demo.getAmlAlerts);
export const getFraudAlerts = pick(compliance.getFraudAlerts, demo.getFraudAlerts);
export const assignAmlAlert = pick(compliance.assignAmlAlert, demo.assignAmlAlert);
export const assignFraudAlert = pick(compliance.assignFraudAlert, notInDemo("assignFraudAlert"));
export const getComplaints = pick(compliance.getComplaints, demo.getComplaints);
export const updateComplaint = pick(compliance.updateComplaint, demo.updateComplaint);
export const getLeads = pick(crm.getLeads, demo.getLeads);
export const getEnquiries = pick(crm.getEnquiries, demo.getEnquiries);
export const acknowledgeEnquiry = pickLoose(crm.acknowledgeEnquiry, demo.acknowledgeEnquiry);
export const assignEnquiry = pickLoose(crm.assignEnquiry, demo.assignEnquiry);
export const resolveEnquiry = pickLoose(crm.resolveEnquiry, demo.resolveEnquiry);
export const convertEnquiryToLead = pickLoose(crm.convertEnquiryToLead, demo.convertEnquiryToLead);
export const getInteractions = pick(crm.getInteractions, demo.getInteractions);
export const getRecentInteractions = pick(crm.getRecentInteractions, demo.getRecentInteractions);
export const logInteraction = pickLoose(crm.logInteraction, demo.logInteraction);
export const getCrmTasks = pick(crm.getCrmTasks, demo.getCrmTasks);
export const createCrmTask = pickLoose(crm.createCrmTask, demo.createCrmTask);
export const setCrmTaskStatus = pickLoose(crm.setCrmTaskStatus, demo.setCrmTaskStatus);
export const getCoverageBook = pick(crm.getCoverageBook, demo.getCoverageBook);
export const getSegmentModel = pick(crm.getSegmentModel, demo.getSegmentModel);
// RelationshipPanel reads the mock profile directly; nothing calls the CORE-shaped one.
export const getClientCrmProfile = pick(crm.getClientCrmProfile, notInDemo("getClientCrmProfile"));
export const setCoverageOwner = pick(crm.setCoverageOwner, demo.setCoverageOwner);
export const setCoverageSegment = pick(crm.setCoverageSegment, demo.setCoverageSegment);
export const getCampaigns = pick(crm.getCampaigns, demo.getCampaigns);
export const getLeadsWithCampaign = pick(crm.getLeadsWithCampaign, demo.getLeadsWithCampaign);
export const getOpportunities = pick(crm.getOpportunities, demo.getOpportunities);
export const getBidCriteria = pick(crm.getBidCriteria, demo.getBidCriteria);
export const scoreOpportunity = pickLoose(crm.scoreOpportunity, demo.scoreOpportunity);
export const decideOpportunity = pickLoose(crm.decideOpportunity, demo.decideOpportunity);
export const setOpportunityStage = pickLoose(crm.setOpportunityStage, demo.setOpportunityStage);
export const getBdKpis = pick(crm.getBdKpis, demo.getBdKpis);
export const getCrmOwners = pick(crm.getCrmOwners, demo.getCrmOwners);
export const getInstitutionalClients = pick(institutional.getInstitutionalClients, demo.getInstitutionalClients);
export const getInstitutionalMandates = pick(institutional.getInstitutionalMandates, demo.getInstitutionalMandates);
export const getMandateRestrictions = pick(institutional.getMandateRestrictions, demo.getMandateRestrictions);
export const getSegregatedPortfolios = pick(institutional.getSegregatedPortfolios, demo.getSegregatedPortfolios);
export const getFeeSchedules = pick(institutional.getFeeSchedules, demo.getFeeSchedules);
export const getInstitutionalReports = pick(institutional.getInstitutionalReports, demo.getInstitutionalReports);
export const updateRestriction = pick(institutional.updateRestriction, notInDemo("updateRestriction"));
export const getMandateBreaches = pick(institutional.getMandateBreaches, demo.getMandateBreaches);
export const updateBreach = pick(institutional.updateBreach, notInDemo("updateBreach"));
export const notifyBreachClient = pick(institutional.notifyBreachClient, notInDemo("notifyBreachClient"));
export const getCounterparties = pick(institutional.getCounterparties, demo.getCounterparties);
export const reviewCounterparty = pick(institutional.reviewCounterparty, notInDemo("reviewCounterparty"));
export const screenCounterparty = pick(institutional.screenCounterparty, notInDemo("screenCounterparty"));
export const getInstitutionalClientCompliance = pick(institutional.getInstitutionalClientCompliance, demo.getInstitutionalClientCompliance);
export const reviewClientCompliance = pick(institutional.reviewClientCompliance, notInDemo("reviewClientCompliance"));
export const getInvestmentProducts = pick(investment.getInvestmentProducts, demo.getInvestmentProducts);
export const getPortfolioTrades = pick(investment.getPortfolioTrades, demo.getPortfolioTrades);
export const proposeTrade = pick(investment.proposeTrade, notInDemo("proposeTrade"));
export const recordTradeStatus = pick(investment.recordTradeStatus, notInDemo("recordTradeStatus"));
export const getHoldingsBook = pick(investment.getHoldingsBook, demo.getHoldingsBook);
export const getValuationRuns = pick(investment.getValuationRuns, demo.getValuationRuns);
export const runValuation = pick(investment.runValuation, notInDemo("runValuation"));
export const reviewValuationRun = pick(investment.reviewValuationRun, notInDemo("reviewValuationRun"));
export const releaseValuationRun = pick(investment.releaseValuationRun, notInDemo("releaseValuationRun"));
export const getRedemptionRequests = pick(investment.getRedemptionRequests, demo.getRedemptionRequests);
export const decideRedemption = pick(investment.decideRedemption, notInDemo("decideRedemption"));
export const getCorporateActions = pick(investment.getCorporateActions, demo.getCorporateActions);
export const decideCorporateAction = pick(investment.decideCorporateAction, notInDemo("decideCorporateAction"));
export const getIcApprovalQueue = pick(investment.getIcApprovalQueue, demo.getIcApprovalQueue);
export const getIcApproval = pick(investment.getIcApproval, notInDemo("getIcApproval"));
export const proposeIcApproval = pick(investment.proposeIcApproval, notInDemo("proposeIcApproval"));
export const withdrawIcApproval = pick(investment.withdrawIcApproval, notInDemo("withdrawIcApproval"));
export const castIcVote = pick(investment.castIcVote, notInDemo("castIcVote"));
export const getInvestmentMandates = pick(investment.getInvestmentMandates, demo.getInvestmentMandates);
export const getJournalEntries = pick(ledger.getJournalEntries, demoAdapted.getJournalEntries);
export const reverseJournal = pick(ledger.reverseJournal, notInDemo("reverseJournal"));
export const postCorrection = pick(ledger.postCorrection, demoAdapted.postCorrection);
export const getUnitLedger = pick(ledger.getUnitLedger, demo.getUnitLedger);
export const getAccrualRuns = pick(ledger.getAccrualRuns, demo.getAccrualRuns);
export const runAccrualBatch = pick(ledger.runAccrualBatch, notInDemo("runAccrualBatch"));
export const triggerAccrualRun = pickLoose(ledger.triggerAccrualRun, demo.triggerAccrualRun);
export const getCloseRuns = pick(ledger.getCloseRuns, demo.getCloseRuns);
export const runDayEndClose = pick(ledger.runDayEndClose, notInDemo("runDayEndClose"));
export const runClose = pickLoose(ledger.runClose, demo.runClose);
export const getNavComposition = pick(ledger.getNavComposition, demo.getNavComposition);
export const getNavHistory = pick(ledger.getNavHistory, demo.getNavHistory);
export const getFeeAccrual = pick(ledger.getFeeAccrual, demo.getFeeAccrual);
export const getSubFunds = pick(ledger.getSubFunds, demo.getSubFunds);
export const getSubFund = pick(ledger.getSubFund, notInDemo("getSubFund"));
export const getBondLadder = pick(ledger.getBondLadder, demo.getBondLadder);
export const getFacilityState = pick(ledger.getFacilityState, demo.getFacilityState);
export const getReconciliationBreaks = pick(ledger.getReconciliationBreaks, demo.getReconciliationBreaks);
export const resolveReconciliationBreak = pick(ledger.resolveReconciliationBreak, demo.resolveReconciliationBreak);
export const getUnallocatedFunds = pick(ledger.getUnallocatedFunds, demo.getUnallocatedFunds);
export const matchUnallocatedFund = pick(ledger.matchUnallocatedFund, demo.matchUnallocatedFund);
export const getTransactions = pick(ledger.getTransactions, demo.getTransactions);
export const getWithholdingPolicy = pick(ledger.getWithholdingPolicy, demo.getWithholdingPolicy);
export const getProducts = pick(ledger.getProducts, demo.getProducts);
export const getServicePackages = pick(ledger.getServicePackages, demoAdapted.getServicePackages);
export const getTariffs = pick(ledger.getTariffs, demoAdapted.getTariffs);
export const getAccountTemplates = pick(ledger.getAccountTemplates, demo.getAccountTemplates);
export const getTokenizationReadiness = pick(ledger.getTokenizationReadiness, demo.getTokenizationReadiness);
export const proposeTariffChange = pick(ledger.proposeTariffChange, demoAdapted.proposeTariffChange);
export const getFundFlows = pick(ledger.getFundFlows, demo.getFundFlows);
export const getAumTrend = pick(ledger.getAumTrend, demo.getAumTrend);
export const getCouponCalendar = pick(ledger.getCouponCalendar, demo.getCouponCalendar);
export const getOpsSnapshot = pick(ledger.getOpsSnapshot, demo.getOpsSnapshot);
export const getTokenIssuances = pick(tokconduct.getTokenIssuances, demo.getTokenIssuances);
export const getTokenIssuance = pick(tokconduct.getTokenIssuance, notInDemo("getTokenIssuance"));
export const approveTokenIssuance = pick(tokconduct.approveTokenIssuance, notInDemo("approveTokenIssuance"));
export const rejectTokenIssuance = pick(tokconduct.rejectTokenIssuance, notInDemo("rejectTokenIssuance"));
export const getLifecycleEvents = pick(tokconduct.getLifecycleEvents, demo.getLifecycleEvents);
export const authorizeLifecycleEvent = pick(tokconduct.authorizeLifecycleEvent, notInDemo("authorizeLifecycleEvent"));
export const getSmartContracts = pick(tokconduct.getSmartContracts, demo.getSmartContracts);
export const getMarketAbuseAlerts = pick(tokconduct.getMarketAbuseAlerts, demo.getMarketAbuseAlerts);
export const assignMarketAbuseAlert = pick(tokconduct.assignMarketAbuseAlert, notInDemo("assignMarketAbuseAlert"));
export const setMarketAbuseStatus = pick(tokconduct.setMarketAbuseStatus, notInDemo("setMarketAbuseStatus"));
export const reportMarketAbuseToCma = pick(tokconduct.reportMarketAbuseToCma, notInDemo("reportMarketAbuseToCma"));
export const getConflictDeclarations = pick(tokconduct.getConflictDeclarations, demo.getConflictDeclarations);
export const reviewConflict = pick(tokconduct.reviewConflict, notInDemo("reviewConflict"));
export const getEmployeeTrades = pick(tokconduct.getEmployeeTrades, demo.getEmployeeTrades);
export const decideEmployeeTrade = pick(tokconduct.decideEmployeeTrade, notInDemo("decideEmployeeTrade"));
