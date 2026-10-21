import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./ui";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./lib/ProtectedRoute";
import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Leads = lazy(() => import("./pages/Leads"));
const Suitability = lazy(() => import("./pages/Suitability"));
const KycQueue = lazy(() => import("./pages/KycQueue"));
const KycPeriodic = lazy(() => import("./pages/KycPeriodic"));
const KycDynamic = lazy(() => import("./pages/KycDynamic"));
const KycOnboardingDetail = lazy(() => import("./pages/KycOnboardingDetail"));
const KycPeriodicDetail = lazy(() => import("./pages/KycPeriodicDetail"));
const KycDynamicDetail = lazy(() => import("./pages/KycDynamicDetail"));
const SuitabilityDetail = lazy(() => import("./pages/SuitabilityDetail"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const Screening = lazy(() => import("./pages/Screening"));
const Complaints = lazy(() => import("./pages/Complaints"));
const AmlAlerts = lazy(() => import("./pages/AmlAlerts"));
const FraudAlerts = lazy(() => import("./pages/FraudAlerts"));
const FraudCases = lazy(() => import("./pages/FraudCases"));
const Approvals = lazy(() => import("./pages/Approvals"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const UnallocatedFunds = lazy(() => import("./pages/UnallocatedFunds"));
const Nav = lazy(() => import("./pages/Nav"));
const Distributions = lazy(() => import("./pages/Distributions"));
const Liquidity = lazy(() => import("./pages/Liquidity"));
const BondLadder = lazy(() => import("./pages/BondLadder"));
const UsersAdmin = lazy(() => import("./pages/UsersAdmin"));
const Reports = lazy(() => import("./pages/Reports"));
const PlatformSettings = lazy(() => import("./pages/PlatformSettings"));
const FeatureFlags = lazy(() => import("./pages/FeatureFlags"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const System = lazy(() => import("./pages/System"));
const Catalogue = lazy(() => import("./pages/Catalogue"));
const Ledger = lazy(() => import("./pages/Ledger"));
const Enquiries = lazy(() => import("./pages/Enquiries"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Coverage = lazy(() => import("./pages/Coverage"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const BdPerformance = lazy(() => import("./pages/BdPerformance"));
const TokenIssuance = lazy(() => import("./pages/tokenization/TokenIssuance"));
const TokenLifecycle = lazy(() => import("./pages/tokenization/TokenLifecycle"));
const SmartContracts = lazy(() => import("./pages/tokenization/SmartContracts"));
const TokenConsoleOverview = lazy(() => import("./pages/tokenconsole/Overview"));
const TokenConsoleInvestors = lazy(() => import("./pages/tokenconsole/Investors"));
const TokenConsoleAccounts = lazy(() => import("./pages/tokenconsole/Accounts"));
const TokenConsoleOfferings = lazy(() => import("./pages/tokenconsole/Offerings"));
const TokenConsoleProducts = lazy(() => import("./pages/tokenconsole/Products"));
const TokenConsoleMarket = lazy(() => import("./pages/tokenconsole/Market"));
const TokenConsoleJournals = lazy(() => import("./pages/tokenconsole/Journals"));
const TokenConsoleTrialBalance = lazy(() => import("./pages/tokenconsole/TrialBalance"));
const TokenConsoleUnitLedger = lazy(() => import("./pages/tokenconsole/UnitLedger"));
const TokenConsoleReconciliation = lazy(() => import("./pages/tokenconsole/Reconciliation"));
const TokenConsoleRuns = lazy(() => import("./pages/tokenconsole/Runs"));
const TokenConsolePolicies = lazy(() => import("./pages/tokenconsole/Policies"));
const TokenConsoleCompliance = lazy(() => import("./pages/tokenconsole/Compliance"));
const TokenConsoleChanges = lazy(() => import("./pages/tokenconsole/Changes"));
const TokenConsoleFunds = lazy(() => import("./pages/tokenconsole/Funds"));
const TokenConsoleTariffs = lazy(() => import("./pages/tokenconsole/Tariffs"));
const TokenConsoleConfiguration = lazy(() => import("./pages/tokenconsole/Configuration"));
const TokenConsoleLoans = lazy(() => import("./pages/tokenconsole/Loans"));
const TokenConsoleKyc = lazy(() => import("./pages/tokenconsole/Kyc"));
const TokenConsoleCustomers = lazy(() => import("./pages/tokenconsole/Customers"));
const TokenConsoleCustomerApprovals = lazy(() => import("./pages/tokenconsole/CustomerApprovals"));
const TokenConsoleTransactions = lazy(() => import("./pages/tokenconsole/Transactions"));
const TokenConsoleUsers = lazy(() => import("./pages/tokenconsole/Users"));
const TokenConsoleNav = lazy(() => import("./pages/tokenconsole/Nav"));
const TokenConsoleAssets = lazy(() => import("./pages/tokenconsole/Assets"));
const MarketAbuse = lazy(() => import("./pages/conduct/MarketAbuse"));
const ConflictsOfInterest = lazy(() => import("./pages/conduct/ConflictsOfInterest"));
const EmployeeTrading = lazy(() => import("./pages/conduct/EmployeeTrading"));
const InvProducts = lazy(() => import("./pages/investment/Products"));
const InvOrders = lazy(() => import("./pages/investment/Orders"));
const InvPortfolio = lazy(() => import("./pages/investment/PortfolioManagement"));
const InvHoldings = lazy(() => import("./pages/investment/Holdings"));
const InvValuations = lazy(() => import("./pages/investment/Valuations"));
const InvRedemptions = lazy(() => import("./pages/investment/Redemptions"));
const InvCorporateActions = lazy(() => import("./pages/investment/CorporateActions"));
const InvIcApprovals = lazy(() => import("./pages/investment/IcApprovals"));
const InvMandates = lazy(() => import("./pages/investment/Mandates"));
const InstClients = lazy(() => import("./pages/institutional/Clients"));
const InstMandates = lazy(() => import("./pages/institutional/Mandates"));
const InstPortfolios = lazy(() => import("./pages/institutional/Portfolios"));
const InstFees = lazy(() => import("./pages/institutional/Fees"));
const InstReporting = lazy(() => import("./pages/institutional/Reporting"));
const InstBreaches = lazy(() => import("./pages/instcompliance/Breaches"));
const InstRestrictions = lazy(() => import("./pages/instcompliance/Restrictions"));
const InstCounterparties = lazy(() => import("./pages/instcompliance/Counterparties"));
const InstClientCompliance = lazy(() => import("./pages/instcompliance/ClientCompliance"));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
      <Route path="/suitability" element={<ProtectedRoute><Suitability /></ProtectedRoute>} />
      <Route path="/kyc-queue" element={<ProtectedRoute><KycQueue /></ProtectedRoute>} />
      <Route path="/kyc-queue/:id" element={<ProtectedRoute><KycOnboardingDetail /></ProtectedRoute>} />
      <Route path="/kyc-periodic" element={<ProtectedRoute><KycPeriodic /></ProtectedRoute>} />
      <Route path="/kyc-periodic/:id" element={<ProtectedRoute><KycPeriodicDetail /></ProtectedRoute>} />
      <Route path="/kyc-dynamic" element={<ProtectedRoute><KycDynamic /></ProtectedRoute>} />
      <Route path="/kyc-dynamic/:id" element={<ProtectedRoute><KycDynamicDetail /></ProtectedRoute>} />
      <Route path="/suitability/:id" element={<ProtectedRoute><SuitabilityDetail /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><Cases /></ProtectedRoute>} />
      <Route path="/cases/:id" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
      <Route path="/screening" element={<ProtectedRoute><Screening /></ProtectedRoute>} />
      <Route path="/complaints" element={<ProtectedRoute><Complaints /></ProtectedRoute>} />
      <Route path="/aml-alerts" element={<ProtectedRoute><AmlAlerts /></ProtectedRoute>} />
      <Route path="/fraud-alerts" element={<ProtectedRoute><FraudAlerts /></ProtectedRoute>} />
      <Route path="/fraud-cases" element={<ProtectedRoute><FraudCases /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
      <Route path="/unallocated-funds" element={<ProtectedRoute><UnallocatedFunds /></ProtectedRoute>} />
      <Route path="/nav" element={<ProtectedRoute><Nav /></ProtectedRoute>} />
      <Route path="/distributions" element={<ProtectedRoute><Distributions /></ProtectedRoute>} />
      <Route path="/liquidity" element={<ProtectedRoute><Liquidity /></ProtectedRoute>} />
      <Route path="/bond-ladder" element={<ProtectedRoute><BondLadder /></ProtectedRoute>} />
      <Route path="/catalogue" element={<ProtectedRoute><Catalogue /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/enquiries" element={<ProtectedRoute><Enquiries /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/coverage" element={<ProtectedRoute><Coverage /></ProtectedRoute>} />
      <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
      <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
      <Route path="/bd-performance" element={<ProtectedRoute><BdPerformance /></ProtectedRoute>} />
      <Route path="/tokenization/issuance" element={<ProtectedRoute><TokenIssuance /></ProtectedRoute>} />
      <Route path="/tokenization/lifecycle" element={<ProtectedRoute><TokenLifecycle /></ProtectedRoute>} />
      <Route path="/tokenization/smart-contracts" element={<ProtectedRoute><SmartContracts /></ProtectedRoute>} />
      {/* Baracel Unyt, the merged tokenization console. The bare prefix is not a page: its
          overview lives one level down so a grant on it cannot cover the
          console's other pages (see canAccess in lib/auth.tsx). */}
      <Route path="/token-console" element={<Navigate to="/token-console/overview" replace />} />
      <Route path="/token-console/overview" element={<ProtectedRoute><TokenConsoleOverview /></ProtectedRoute>} />
      <Route path="/token-console/investors" element={<ProtectedRoute><TokenConsoleInvestors /></ProtectedRoute>} />
      <Route path="/token-console/accounts" element={<ProtectedRoute><TokenConsoleAccounts /></ProtectedRoute>} />
      <Route path="/token-console/offerings" element={<ProtectedRoute><TokenConsoleOfferings /></ProtectedRoute>} />
      <Route path="/token-console/products" element={<ProtectedRoute><TokenConsoleProducts /></ProtectedRoute>} />
      <Route path="/token-console/market" element={<ProtectedRoute><TokenConsoleMarket /></ProtectedRoute>} />
      <Route path="/token-console/journals" element={<ProtectedRoute><TokenConsoleJournals /></ProtectedRoute>} />
      <Route path="/token-console/trial-balance" element={<ProtectedRoute><TokenConsoleTrialBalance /></ProtectedRoute>} />
      <Route path="/token-console/unit-ledger" element={<ProtectedRoute><TokenConsoleUnitLedger /></ProtectedRoute>} />
      <Route path="/token-console/reconciliation" element={<ProtectedRoute><TokenConsoleReconciliation /></ProtectedRoute>} />
      <Route path="/token-console/runs" element={<ProtectedRoute><TokenConsoleRuns /></ProtectedRoute>} />
      <Route path="/token-console/policies" element={<ProtectedRoute><TokenConsolePolicies /></ProtectedRoute>} />
      <Route path="/token-console/compliance" element={<ProtectedRoute><TokenConsoleCompliance /></ProtectedRoute>} />
      <Route path="/token-console/changes" element={<ProtectedRoute><TokenConsoleChanges /></ProtectedRoute>} />
      <Route path="/token-console/funds" element={<ProtectedRoute><TokenConsoleFunds /></ProtectedRoute>} />
      <Route path="/token-console/tariffs" element={<ProtectedRoute><TokenConsoleTariffs /></ProtectedRoute>} />
      <Route path="/token-console/configuration" element={<ProtectedRoute><TokenConsoleConfiguration /></ProtectedRoute>} />
      <Route path="/token-console/loans" element={<ProtectedRoute><TokenConsoleLoans /></ProtectedRoute>} />
      <Route path="/token-console/kyc" element={<ProtectedRoute><TokenConsoleKyc /></ProtectedRoute>} />
      <Route path="/token-console/customers" element={<ProtectedRoute><TokenConsoleCustomers /></ProtectedRoute>} />
      <Route path="/token-console/customer-approvals" element={<ProtectedRoute><TokenConsoleCustomerApprovals /></ProtectedRoute>} />
      <Route path="/token-console/transactions" element={<ProtectedRoute><TokenConsoleTransactions /></ProtectedRoute>} />
      {/* Identity checks merged into the KYC desk; old links still land. */}
      <Route path="/token-console/identity" element={<Navigate to="/token-console/kyc" replace />} />
      <Route path="/token-console/users" element={<ProtectedRoute><TokenConsoleUsers /></ProtectedRoute>} />
      <Route path="/token-console/nav" element={<ProtectedRoute><TokenConsoleNav /></ProtectedRoute>} />
      <Route path="/token-console/assets" element={<ProtectedRoute><TokenConsoleAssets /></ProtectedRoute>} />
      <Route path="/market-conduct/market-abuse" element={<ProtectedRoute><MarketAbuse /></ProtectedRoute>} />
      <Route path="/market-conduct/conflicts" element={<ProtectedRoute><ConflictsOfInterest /></ProtectedRoute>} />
      <Route path="/market-conduct/employee-trading" element={<ProtectedRoute><EmployeeTrading /></ProtectedRoute>} />
      <Route path="/investment/products" element={<ProtectedRoute><InvProducts /></ProtectedRoute>} />
      <Route path="/investment/orders" element={<ProtectedRoute><InvOrders /></ProtectedRoute>} />
      <Route path="/investment/portfolio" element={<ProtectedRoute><InvPortfolio /></ProtectedRoute>} />
      <Route path="/investment/holdings" element={<ProtectedRoute><InvHoldings /></ProtectedRoute>} />
      <Route path="/investment/valuations" element={<ProtectedRoute><InvValuations /></ProtectedRoute>} />
      <Route path="/investment/redemptions" element={<ProtectedRoute><InvRedemptions /></ProtectedRoute>} />
      <Route path="/investment/corporate-actions" element={<ProtectedRoute><InvCorporateActions /></ProtectedRoute>} />
      <Route path="/investment/ic-approvals" element={<ProtectedRoute><InvIcApprovals /></ProtectedRoute>} />
      <Route path="/investment/mandates" element={<ProtectedRoute><InvMandates /></ProtectedRoute>} />
      <Route path="/institutional/clients" element={<ProtectedRoute><InstClients /></ProtectedRoute>} />
      <Route path="/institutional/mandates" element={<ProtectedRoute><InstMandates /></ProtectedRoute>} />
      <Route path="/institutional/portfolios" element={<ProtectedRoute><InstPortfolios /></ProtectedRoute>} />
      <Route path="/institutional/fees" element={<ProtectedRoute><InstFees /></ProtectedRoute>} />
      <Route path="/institutional/reporting" element={<ProtectedRoute><InstReporting /></ProtectedRoute>} />
      <Route path="/institutional-compliance/breaches" element={<ProtectedRoute><InstBreaches /></ProtectedRoute>} />
      <Route path="/institutional-compliance/restrictions" element={<ProtectedRoute><InstRestrictions /></ProtectedRoute>} />
      <Route path="/institutional-compliance/counterparties" element={<ProtectedRoute><InstCounterparties /></ProtectedRoute>} />
      <Route path="/institutional-compliance/clients" element={<ProtectedRoute><InstClientCompliance /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UsersAdmin /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><PlatformSettings /></ProtectedRoute>} />
      <Route path="/feature-flags" element={<ProtectedRoute><FeatureFlags /></ProtectedRoute>} />
      <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/system" element={<ProtectedRoute><System /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary appName="Investcent BO Admin">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}
