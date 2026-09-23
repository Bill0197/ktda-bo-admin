/* Barrel re-export — pages import from "../lib/api" uniformly, same as the
 * single "../mock" import they replace. The actual implementations live in
 * one file per domain (api.compliance.ts, api.crm.ts, api.admin.ts,
 * api.ledger.ts) so parallel wiring passes don't collide on one file. */
export * from "./api.compliance";
export * from "./api.crm";
export * from "./api.admin";
export * from "./api.ledger";
export * from "./api.investment";
export * from "./api.institutional";
export * from "./api.tokconduct";
export * from "./api.tokenConsole";
export { ApiError } from "./apiClient";

/* Everything CORE API would serve runs on the in-browser demo until CORE is
 * deployed (see api.demo.ts). These named re-exports shadow the same names
 * from the star exports above. */
export {
  getApprovalQueue, decideApproval, getSystemUsers, getStaffDirectory, inviteSystemUser, setSystemUserStatus,
  updateSystemUserRole, getDepartments, getRolePermissionMatrix, setRolePageAccess, getPlatformSettings,
  proposeSettingChange, getFeatureFlags, setFeatureFlag, getAuditLog, verifyAuditChain, getIntegrations,
  setIntegrationEnvironment, getSystemJobs, setSystemJobEnabled, runSystemJob, getMaintenanceTargets,
  setMaintenanceMode, getReports, generateReport, getClients, getClient, setClientOwner, setClientSegment,
  setClientSuspended, getClientComplianceDetail, getActivationBlockers, getComplianceProfiles,
  submitActivation, decideKycApplication, completeEdd, markKycRefreshed, setDocumentStatus, setUboStatus,
  setRiskRating, getScreeningResults, runScreening, runEodScreening, resolveScreeningMatch, setWalletStatus,
  setWalletRestrictions, getRiskFactors, addRiskFactor, setRiskFactorEnabled, getComplianceCases,
  getComplianceCase, createCase, addCaseNote, addCaseEvidence, assignCase, setCaseStatus, recordMlroDecision,
  escalateToMlro, closeCase, getAmlAlerts, getFraudAlerts, assignAmlAlert, assignFraudAlert, getComplaints,
  updateComplaint, getLeads, getEnquiries, acknowledgeEnquiry, assignEnquiry, resolveEnquiry,
  convertEnquiryToLead, getInteractions, getRecentInteractions, logInteraction, getCrmTasks, createCrmTask,
  setCrmTaskStatus, getCoverageBook, getSegmentModel, getClientCrmProfile, setCoverageOwner,
  setCoverageSegment, getCampaigns, getLeadsWithCampaign, getOpportunities, getBidCriteria, scoreOpportunity,
  decideOpportunity, setOpportunityStage, getBdKpis, getCrmOwners, getInstitutionalClients,
  getInstitutionalMandates, getMandateRestrictions, getSegregatedPortfolios, getFeeSchedules,
  getInstitutionalReports, updateRestriction, getMandateBreaches, updateBreach, notifyBreachClient,
  getCounterparties, reviewCounterparty, screenCounterparty, getInstitutionalClientCompliance,
  reviewClientCompliance, getInvestmentProducts, getInvestmentOrders, getPortfolioTrades, proposeTrade,
  recordTradeStatus, getHoldingsBook, getValuationRuns, runValuation, reviewValuationRun,
  releaseValuationRun, getRedemptionRequests, decideRedemption, getCorporateActions, decideCorporateAction,
  getIcApprovalQueue, getIcApproval, proposeIcApproval, withdrawIcApproval, castIcVote,
  getInvestmentMandates, getJournalEntries, reverseJournal, postCorrection, getUnitLedger, getAccrualRuns,
  runAccrualBatch, triggerAccrualRun, getCloseRuns, runDayEndClose, runClose, getNavComposition,
  getNavHistory, getFeeAccrual, getSubFunds, getSubFund, getBondLadder, getFacilityState,
  getReconciliationBreaks, resolveReconciliationBreak, getUnallocatedFunds, matchUnallocatedFund,
  getTransactions, getWithholdingPolicy, getProducts, getServicePackages, getTariffs, getAccountTemplates,
  getTokenizationReadiness, proposeTariffChange, getFundFlows, getAumTrend, getCouponCalendar,
  getOpsSnapshot, getTokenIssuances, getTokenIssuance, approveTokenIssuance, rejectTokenIssuance,
  getLifecycleEvents, authorizeLifecycleEvent, getSmartContracts, getMarketAbuseAlerts,
  assignMarketAbuseAlert, setMarketAbuseStatus, reportMarketAbuseToCma, getConflictDeclarations,
  reviewConflict, getEmployeeTrades, decideEmployeeTrade,
} from "./api.demo";
